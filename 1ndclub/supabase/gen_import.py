#!/usr/bin/env python3
# kvdb(현재 서버) → Supabase import SQL 생성기
# 실행할 때마다 kvdb의 "지금" 데이터를 읽어 import_data.sql을 새로 만든다.
# 컷오버 날 최종 동기화 때도 이걸 다시 돌리면 됨.
# 생성된 SQL은 idempotent — 우리 표를 비우고 다시 넣는다 (Supabase SQL Editor에서 실행).
import json, urllib.request, datetime

KV = 'https://kvdb.io/DJQNWiVLSeiXfWCAYSyAZz'

def fetch_all():
    with urllib.request.urlopen(f'{KV}/?prefix=botc:&values=true&format=json') as r:
        return json.load(r)

def q(s):  # SQL 문자열 이스케이프
    if s is None: return 'null'
    return "'" + str(s).replace("'", "''") + "'"

def jq(obj):  # jsonb 리터럴
    return q(json.dumps(obj, ensure_ascii=False)) + '::jsonb'

rows = fetch_all()
d = {}
for k, v in rows:
    d[k] = v

members, privates, pasts, picks, rsvps, owners, notices, reads, pfps, crushes = [],[],[],[],[],[],[],[],[],[]
seq_next = int(d.get('botc:seq:member', '1'))

# 실제 회원 uid 명단 — 여기 없는 uid를 참조하는 데이터(테스트 잔재·탈퇴자 흔적)는 건너뛴다
member_uids = { json.loads(v)['uid'] for k, v in d.items() if k.startswith('botc:u:') }
skipped = []
def known(uid, key):
    if uid in member_uids: return True
    skipped.append(key); return False

for k, v in d.items():
    parts = k.split(':')
    kind = parts[1]
    if kind == 'u':
        a = json.loads(v)
        members.append(
            f"insert into members (id, nick, aliases, no, is_admin, role, scribe, scribe_ready, scribe_hello, joined, joined_at) values ("
            f"{q(a['uid'])}, {q(a['nick'])}, {jq(a.get('aliases',[]))}, {a.get('no','null')}, "
            f"{str(bool(a.get('admin'))).lower()}, {q(a['role']) if a.get('role') else 'null'}, "
            f"{str(bool(a.get('scribe'))).lower()}, {str(bool(a.get('scribeReady'))).lower()}, {str(bool(a.get('scribeHello'))).lower()}, "
            f"{q(a.get('joined'))}, {q(a.get('joinedAt') or (a.get('joined','2026-08-10')+'T00:00:00Z'))});")
        privates.append(
            f"insert into member_private (member_id, payname, kakao) values ("
            f"{q(a['uid'])}, {q(a.get('payname'))}, {q(a.get('kakao')) if a.get('kakao') else 'null'});")
    elif kind == 'past':
        p = json.loads(v)
        pasts.append(
            f"insert into past_meetings (d, dow, s, e, r, kind, place, addr, memo, fee, after, people, played) values ("
            f"{q(p['d'])}, {q(p.get('dow'))}, {q(p.get('s'))}, {q(p.get('e'))}, {p.get('r') or 'null'}, {q(p.get('kind')) if p.get('kind') else 'null'}, "
            f"{q(p.get('place'))}, {q(p.get('addr'))}, {q(p.get('memo'))}, {q(p.get('fee'))}, {q(p.get('after'))}, "
            f"{jq(p.get('people',[]))}, {jq(p.get('played',[]))});")
    elif kind == 'p':      # botc:p:<date>:<uid>
        date, uid = parts[2], parts[3]
        if not known(uid, k): continue
        picks.append(f"insert into picks (d, member_id, games) values ({q(date)}, {q(uid)}, {jq(json.loads(v))});")
    elif kind == 'a':      # botc:a:<date>:<uid>
        date, uid = parts[2], parts[3]
        if not known(uid, k): continue
        rsvps.append(f"insert into rsvps (d, member_id, v) values ({q(date)}, {q(uid)}, {q(v)});")
    elif kind == 'owner':  # botc:owner:<게임명>
        game = k[len('botc:owner:'):]
        if not known(v, k): continue
        owners.append(f"insert into game_owners (game, owner_id) values ({q(game)}, {q(v)});")
    elif kind == 'notice':
        n = json.loads(v)
        notices.append(
            f"insert into notices (id, title, body, target, round_d, by_id, at) values ("
            f"{q(n['id'])}, {q(n.get('title'))}, {q(n.get('body'))}, {q(n.get('target','all'))}, "
            f"{q(n.get('roundDate')) if n.get('roundDate') else 'null'}, null, {q(n.get('at'))});")
    elif kind == 'read':
        uid = parts[2]
        if not known(uid, k): continue
        reads.append(f"insert into notice_reads (member_id, read_ids) values ({q(uid)}, {jq(json.loads(v))});")
    elif kind == 'pfp':
        uid = parts[2]
        if not known(uid, k): continue
        pfps.append(f"insert into profiles (member_id, pfp) values ({q(uid)}, {q(v)});")
    elif kind == 'crush':
        uid = parts[2]
        if not known(uid, k): continue
        c = json.loads(v)
        crushes.append(
            f"insert into crush (member_id, h, e, c, ts, off) values ({q(uid)}, {q(c.get('h'))}, {q(c.get('e'))}, "
            f"{q(c.get('c'))}, {q(c.get('ts'))}, false);")
    elif kind == 'crushoff':
        uid = parts[2]
        if not known(uid, k): continue
        crushes.append(
            f"insert into crush (member_id, off) values ({q(uid)}, true) "
            f"on conflict (member_id) do update set off = true;")

now = datetime.datetime.now().strftime('%Y-%m-%d %H:%M')
out = [f"-- kvdb → Supabase 데이터 이전 ({now} 생성, 소스: 실시간 kvdb)",
       "-- 우리 표를 비우고 다시 넣는다. 몇 번을 다시 실행해도 같은 결과.",
       "begin;",
       "truncate members, member_private, profiles, past_meetings, picks, rsvps, game_owners, notices, notice_reads, crush cascade;"]
for group in (members, privates, pasts, picks, rsvps, owners, notices, reads, pfps, crushes):
    out += group
out.append(f"select setval('member_no_seq', {seq_next - 1}, true);  -- 다음 가입자 번호가 {seq_next}이 되게")
out.append("commit;")

path = __file__.rsplit('/',1)[0] + '/import_data.sql'
open(path, 'w', encoding='utf-8').write('\n'.join(out) + '\n')
print(f"생성 완료: {path}")
if skipped: print("건너뜀(유령 데이터):", skipped)
print(f"회원 {len(members)} · 지난모임 {len(pasts)} · 픽 {len(picks)} · RSVP {len(rsvps)} · 소유자 {len(owners)} · 공지 {len(notices)} · 읽음 {len(reads)} · 사진 {len(pfps)} · 좋알람 {len(crushes)} · 다음번호 {seq_next}")
