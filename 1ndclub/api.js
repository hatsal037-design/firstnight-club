/* 첫밤 사망자 클럽 — 계정 서버 레이어 v2 (Supabase)
   kvdb(공개 버킷)에서 Supabase(서버가 접근제어를 강제)로 이사한 버전.
   함수 이름과 계정 모양(acc.uid/nick/admin/…)은 옛 api.js와 최대한 같게 유지해서
   index.html 수정을 최소화했다. DB 컬럼명(is_admin, scribe_ready…)과의 변환은 여기서만.

   로그인: Supabase Auth의 카카오 OAuth. 비밀번호 로그인은 폐지(카카오 전용).
   세션: supabase-js가 localStorage에 알아서 관리. 우리가 uid를 직접 저장하지 않는다. */

/* 서버 주소·공개키는 tunel.js 한 곳에만 둔다 — 여기서 다시 적으면 값이 갈라진다.
   클라이언트도 하나여야 한다 (둘이면 로그인이 꼬인다 — 2026-08-20에 겪음).
   tunel.js 를 먼저 불러온 뒤 이 파일을 부른다. */
const sb = TUNEL.sb();

/* ── 행 → 앱 계정 모양 변환 ── */
function rowToAcc(row, payname){
  if(!row) return null;
  return {
    uid: row.id, nick: row.nick, aliases: row.aliases || [],
    admin: row.is_admin, role: row.role || undefined,
    scribe: row.scribe, scribeReady: row.scribe_ready, scribeHello: row.scribe_hello,
    joined: row.joined, joinedAt: row.joined_at, no: row.no,
    favs: row.favs || [],
    payname: payname !== undefined ? payname : row.member_private?.payname,
  };
}
function accPatch(acc){   // API.save가 본인이 고칠 수 있는 컬럼만 반영
  return { nick: acc.nick, aliases: acc.aliases || [],
           scribe_ready: !!acc.scribeReady, scribe_hello: !!acc.scribeHello };
}
const T = (name) => sb.from(name);
function throwErr(error, msg){ if(error) throw new Error(msg + ' (' + (error.message||error.code) + ')'); }

const API = {};

/* ══ 인증 ══ */
API.kakaoAuthorize = function(){
  sb.auth.signInWithOAuth({ provider:'kakao',
    options:{ redirectTo: location.origin + location.pathname } });
};
API.logout = async function(){ await sb.auth.signOut(); };
API.hasSession = async function(){
  const { data } = await sb.auth.getSession();
  return !!data?.session;
};
/* 세션 → 내 회원. 기존 회원이면 자동 연결(claim), 아니면 null(가입 필요) */
API.myMember = async function(){
  if(!await API.hasSession()) return null;
  const { data: mid } = await sb.rpc('claim_my_account');
  if(!mid) return null;
  return await API.get(mid);
};
API.signupMember = async function(nick, payname){
  const { data, error } = await sb.rpc('signup_member', { p_nick: nick, p_payname: payname });
  throwErr(error, '가입에 실패했어요');
  return await API.get(data);
};

/* ══ 회원 ══ */
API.nickTaken = async function(nick){
  const { data } = await T('members').select('id').or(`nick.eq.${nick},aliases.cs.${JSON.stringify([nick])}`).limit(1);
  return !!(data && data.length);
};
API.get = async function(uid){
  const { data } = await T('members').select('*, member_private(payname)').eq('id', uid).maybeSingle();
  return rowToAcc(data);
};
API.save = async function(acc){
  const { error } = await T('members').update(accPatch(acc)).eq('id', acc.uid);
  throwErr(error, '저장에 실패했어요');
  return acc;
};
/* 닉변은 서버 RPC 로만 — 6개월 제한과 운영진 알림을 서버가 강제한다.
   (2026-08-20 정책. members.nick 직접 update 권한은 회수됨) */
API.rename = async function(acc, newNick){
  const { error } = await sb.rpc('rename_me', { p_nick: newNick });
  throwErr(error, '닉네임 변경 실패');
  return await API.get(acc.uid);
};
API.list = async function(){
  const { data } = await T('members').select('*, member_private(payname)').order('no');
  return (data||[]).map(r=>rowToAcc(r));
};
/* ══ 항목 참조(catalog) — 게임 이름 ↔ 고정키 변환 ══
   2026-08-20 회원 활동 통합. 통계·기록은 이름이 아니라 catalog_items 참조로 잇는다.
   설계: 브랜드/회원활동_설계.md */
let _items = null, _itemsP = null;
async function itemsMap(){
  if(_items) return _items;
  /* 약속을 캐시한다 — 여러 곳이 동시에 부르면 결과 캐시만으로는 catalog_items 를 중복해서 받는다 */
  if(_itemsP) return _itemsP;
  _itemsP = (async () => {
  const { data } = await sb.from('catalog_items').select('id,key,name').eq('line', LINE);
  _items = { byName:{}, byId:{} };
  (data||[]).forEach(r => { _items.byName[r.name] = r; _items.byId[r.id] = r; });
  /* 도감에서 이름이 바뀐 게임(games.js old:[…]) — 서버 항목은 옛 이름 그대로일 수 있으니 새 이름으로도 찾게 잇는다 */
  try{ (typeof GAMES!=='undefined'?GAMES:[]).forEach(g => (g.old||[]).forEach(o => {
    if(!_items.byName[g.n] && _items.byName[o]) _items.byName[g.n] = _items.byName[o]; })); }catch(e){}
  return _items;
  })();
  return _itemsP;
}

/* 즐겨찾기 — members.favs(빠른 부팅용) + member_items(통계·통합용) 이중 기록 */
API.setFavs = async function(uid, arr){
  const { error } = await T('members').update({ favs: arr }).eq('id', uid);
  throwErr(error, '즐겨찾기 저장 실패');
  try{
    const im = await itemsMap();
    const ids = arr.map(n => im.byName[n]?.id).filter(Boolean);
    let q = sb.from('member_items').update({ fav:false }).eq('member_id', uid).eq('fav', true);
    if(ids.length) q = q.not('item_id', 'in', '(' + ids.join(',') + ')');
    await q;
    if(ids.length){
      await sb.from('member_items').upsert(
        ids.map(id => ({ member_id:uid, item_id:id, fav:true })),
        { onConflict:'member_id,item_id' });
    }
  }catch(e){ console.warn('찜 참조 동기화 실패', e); }
};

/* 게임별 찜 수 — member_items 집계 (회원끼리 서로 보인다) */
API.favCounts = async function(){
  const im = await itemsMap();
  const { data } = await sb.from('member_items').select('item_id').eq('fav', true);
  const m = {};
  (data||[]).forEach(r => { const n = im.byId[r.item_id]?.name; if(n) m[n] = (m[n]||0)+1; });
  return m;
};
/* 관리 조작 — 전부 서버 RPC가 관리자 여부를 재검증한다 */
API.adminSetRole   = async function(uid, role){ const {error}=await sb.rpc('admin_set_role',{p_mid:uid,p_role:role}); throwErr(error,'등급 변경 실패'); };
API.adminSetScribe = async function(uid, on){ const {error}=await sb.rpc('admin_set_scribe',{p_mid:uid,p_on:on}); throwErr(error,'서기 설정 실패'); };
API.adminUpdate    = async function(uid, nick, payname){ const {error}=await sb.rpc('admin_update_member',{p_mid:uid,p_nick:nick,p_payname:payname}); throwErr(error,'수정 실패'); };
API.remove         = async function(acc){ const {error}=await sb.rpc('admin_delete_member',{p_mid:acc.uid}); throwErr(error,'삭제 실패'); };

/* ══ 회차별 게임 선택 ══ */
/* 회차별 게임 선택 — meeting_items(role=picked). 옛 picks 테이블은 동결 */
async function meetingIdOf(date){
  const { data } = await sb.from('meetings').select('id')
    .eq('line', LINE).eq('d', date).maybeSingle();
  return data?.id || null;
}
API.setPicks = async function(date, uid, arr){
  const mid = await meetingIdOf(date); if(!mid) throw new Error('회차를 못 찾았어요');
  const im = await itemsMap();
  await sb.from('meeting_items').delete()
    .eq('meeting_id', mid).eq('role','picked').eq('member_id', uid);
  const rows = arr.map(n => im.byName[n]?.id).filter(Boolean)
    .map(id => ({ meeting_id:mid, item_id:id, role:'picked', member_id:uid }));
  if(rows.length){ const { error } = await sb.from('meeting_items').insert(rows); throwErr(error,'저장 실패'); }
};
API.getMyPicks = async function(date, uid){
  const mid = await meetingIdOf(date); if(!mid) return [];
  const im = await itemsMap();
  const { data } = await sb.from('meeting_items').select('item_id')
    .eq('meeting_id', mid).eq('role','picked').eq('member_id', uid);
  return (data||[]).map(r => im.byId[r.item_id]?.name).filter(Boolean);
};
/* 내가 게임을 고른 회차 id 전부 — 한 번에. 회차마다 되묻던 것을 대신한다 */
API.myPickedMeetings = async function(uid){
  const { data } = await sb.from('meeting_items').select('meeting_id')
    .eq('role','picked').eq('member_id', uid);
  return new Set((data||[]).map(r => r.meeting_id));
};
API.allPicks = async function(date){
  const mid = await meetingIdOf(date); if(!mid) return [];
  const im = await itemsMap();
  const { data } = await sb.from('meeting_items').select('member_id,item_id')
    .eq('meeting_id', mid).eq('role','picked');
  const by = {};
  (data||[]).forEach(r => { (by[r.member_id] = by[r.member_id]||[]).push(im.byId[r.item_id]?.name); });
  return Object.entries(by).map(([uid, games]) => ({ uid, games: games.filter(Boolean) }));
};

/* ══ 지난 모임 ══
   2026-08-19 통합 구조로 이사했다. 저장소는 meetings + attendance (line='botc').
   앱이 쓰던 모양({d,dow,s,e,r,kind,place,n,fee,played,people,…})은 그대로 유지해서
   index.html 은 손대지 않는다. 옛 past_meetings 테이블은 백업으로만 남아 있다.
   설계: 브랜드/통합구조_설계.md */
const LINE = 'botc';

/* meetings 행 + 참석자 → 앱이 쓰던 지난 모임 모양 */
function rowToPast(m, atts){
  const people = (atts||[]).map(a =>
    a.member_id ? { uid:a.member_id, label:a.who } : (a.guest_name || a.who));
  return {
    d:m.d, dow:m.dow, s:m.s, e:m.e,
    r:m.r ?? null, kind:m.kind === 'regular' ? null : m.kind,
    place:m.place ?? '', addr:m.addr ?? '', memo:m.memo ?? '',
    fee:m.fee ?? '', after:m.after ?? '',
    n: people.length || null,
    played: (m.data && m.data.played) || [],
    people,
    _id: m.id
  };
}

/* ══ 회차 — 허브(tunel.kr)와 같은 자료를 그대로 받는다 ══
   TUNEL.meetings() 가 주는 원본(v_meetings)을 손대지 않고 돌려주고,
   앱이 쓰던 짧은 이름(st·cap·note…)만 덧붙인다.
   티켓·상세는 이 객체를 그대로 받으므로 두 화면이 어긋날 수 없다.
   (2026-08-23 통합. 예전엔 여기서 모양을 바꿔 넘기다가 필드가 자꾸 빠졌다) */
API.roundsList = async function(){
  const rows = await TUNEL.meetings({ line: LINE });
  return rows.map(m => Object.assign(m, {
    st  : m.status === 'open' ? 'open' : m.status === 'done' ? 'done'
        : m.status === 'cancelled' ? 'cancelled' : 'soon',
    cap : m.data?.cap ?? null,
    h   : m.data?.h ?? null,
    mapq: m.data?.mapq || null,
    route  : m.data?.route || null,
    special: m.data?.special || null,
    note: m.memo || '',
  })).sort((a,b) => a.d.localeCompare(b.d));
};

API.pastList = async function(){
  const today = new Date(); today.setHours(0,0,0,0);
  const { data: ms } = await sb.from('meetings').select('*')
    .eq('line', LINE).order('d', { ascending:false });
  const rows = (ms||[]).filter(m =>
    m.status === 'done' || (m.status !== 'cancelled' && new Date(m.d) < today));
  if(!rows.length) return [];
  const { data: atts } = await sb.from('v_attendance')
    .select('meeting_id,member_id,guest_name,who')
    .in('meeting_id', rows.map(m=>m.id));
  const by = {};
  (atts||[]).forEach(a => (by[a.meeting_id] = by[a.meeting_id] || []).push(a));
  return rows.map(m => rowToPast(m, by[m.id]));
};

API.pastSave = async function(rec){
  /* 회차 본체 */
  const row = { line:LINE, d:rec.d, dow:rec.dow ?? null, s:rec.s ?? null, e:rec.e ?? null,
                r:rec.r ?? null, kind:rec.kind || 'regular',
                place:rec.place ?? null, addr:rec.addr ?? null, memo:rec.memo ?? null,
                fee:rec.fee ?? null, after:rec.after ?? null,
                status:'done', data:{ played: rec.played || [] } };
  const { data: saved, error } = await sb.from('meetings')
    .upsert(row, { onConflict:'line,d' }).select('id').single();
  throwErr(error, '기록 저장 실패');

  /* 참석자 — 통째로 다시 쓴다 (편집 화면이 전체 목록을 넘겨준다) */
  const mid = saved.id;
  await sb.from('attendance').delete().eq('meeting_id', mid);

  /* 그날 한 게임 → 참조 계층 동기화 (단체로 돌린 게임만 적는 게 운영 방침) */
  try{
    const im = await itemsMap();
    await sb.from('meeting_items').delete().eq('meeting_id', mid).eq('role','done');
    const rowsG = (rec.played || []).map(n => im.byName[n]?.id).filter(Boolean)
      .map(id => ({ meeting_id:mid, item_id:id, role:'done' }));
    if(rowsG.length) await sb.from('meeting_items').insert(rowsG);
  }catch(e){ console.warn('게임 참조 동기화 실패', e); }
  const rowsA = (rec.people || []).map(p =>
    typeof p === 'object' && p.uid
      ? { meeting_id:mid, member_id:p.uid }
      : { meeting_id:mid, guest_name:String(p) })
    .filter(r => r.member_id || (r.guest_name && r.guest_name.trim()));
  if(rowsA.length){
    const { error: e2 } = await sb.from('attendance').insert(rowsA);
    throwErr(e2, '참석자 저장 실패');
  }
};

API.pastDelete = async function(d){
  await sb.from('meetings').delete().eq('line', LINE).eq('d', d);
};

/* ══ 참석 여부 (RSVP) ══ */
API.setRsvp = async function(date, uid, v){
  if(v){ const {error}=await T('rsvps').upsert({d:date, member_id:uid, v}); throwErr(error,'저장 실패'); }
  else await T('rsvps').delete().eq('d',date).eq('member_id',uid);
};
API.getMyRsvp = async function(date, uid){
  const { data } = await T('rsvps').select('v').eq('d',date).eq('member_id',uid).maybeSingle();
  return data?.v || null;
};
/* 내 참석 응답 전부 — 한 번에. { '2026-08-29': 'yes', … } */
API.myRsvpMap = async function(uid){
  const { data } = await T('rsvps').select('d, v').eq('member_id', uid);
  const by = {}; (data||[]).forEach(r => { by[r.d] = r.v; });
  return by;
};
API.allRsvp = async function(date){
  const { data } = await T('rsvps').select('member_id, v').eq('d', date);
  return (data||[]).map(r=>({ uid:r.member_id, v:r.v }));
};

/* ══ 게임 소유자 — member_items.own (옛 game_owners 는 동결) ══ */
API.ownerMap = async function(){
  const im = await itemsMap();
  const { data } = await sb.from('member_items').select('item_id, member_id').eq('own', true);
  const m = {};
  (data||[]).forEach(r => { const n = im.byId[r.item_id]?.name; if(n) m[n] = r.member_id; });
  return m;
};
API.setOwner = async function(gameName, uid){
  const im = await itemsMap();
  const it = im.byName[gameName]; if(!it) throw new Error('도감에 없는 게임: ' + gameName);
  await sb.from('member_items').update({ own:false }).eq('item_id', it.id).eq('own', true);
  if(uid){
    const { error } = await sb.from('member_items')
      .upsert({ member_id:uid, item_id:it.id, own:true }, { onConflict:'member_id,item_id' });
    throwErr(error, '저장 실패');
  }
};

/* ══ 공지 ══ */
API.noticeList = async function(){
  /* 알림은 투넬 전체가 한 곳(messages)에서 돈다 — 메인 허브 알림함과 같은 자료.
     여기 공지는 kind='notice' · line='botc' 로 들어가고, 대상·회차는 payload에 담는다.
     (옛 notices 테이블은 2026-08-23 통합 때 이관 후 읽기만 남겨 뒀다) */
  const { data } = await sb.from('messages').select('*')
    .eq('kind','notice').or(`line.eq.${LINE},line.is.null`)
    .order('created_at', {ascending:false}).limit(100);
  return (data||[]).map(r=>({ id:r.id, title:r.title, body:r.body, to:r.to_member,
                              target:(r.payload&&r.payload.target)||'all',
                              roundDate:(r.payload&&r.payload.round_d)||null,
                              by:r.from_member, at:r.created_at }));
};
API.noticeCreate = async function(n){
  const payload = { target:n.target||'all', round_d:n.roundDate||null };
  const base = { kind:'notice', line:LINE, title:n.title, body:n.body, from_member:n.by||null, payload };
  /* 전체 공지는 한 줄, 대상이 정해진 공지는 그 사람들에게 한 줄씩 —
     그래야 메인 허브 알림함에서도 "내게 온 것"만 정확히 보인다 */
  let rows = [base];
  if(n.target === 'rsvp' && n.roundDate){
    const ids = (await API.allRsvp(n.roundDate)).filter(x=>x.v==='yes').map(x=>x.member_id);
    rows = ids.map(id => ({ ...base, to_member:id }));
  } else if(n.target === 'picks' && n.roundDate){
    const ids = [...new Set((await API.allPicks(n.roundDate)).map(x=>x.member_id || x.uid).filter(Boolean))];
    rows = ids.map(id => ({ ...base, to_member:id }));
  }
  if(!rows.length) throw new Error('이 조건에 해당하는 회원이 없어요.');
  const { data, error } = await sb.from('messages').insert(rows).select();
  throwErr(error, '공지 저장 실패');
  return data;
};
API.noticeDelete = async function(id){ await sb.from('messages').delete().eq('id', id); };
/* 읽음 표시도 메인 허브와 같은 표(message_reads)를 쓴다 — 한 곳에서 읽으면 양쪽 다 읽음 */
API.getRead = async function(uid){
  const { data } = await sb.from('message_reads').select('message_id').eq('member_id', uid);
  return (data||[]).map(x=>x.message_id);
};
API.setRead = async function(uid, ids){
  if(!ids || !ids.length) return;
  await sb.from('message_reads').upsert(
    ids.map(id=>({ message_id:id, member_id:uid })),
    { onConflict:'message_id,member_id', ignoreDuplicates:true });
};

/* ══ 프로필 사진 ══ */
API.pfpGet = async function(uid){
  const { data } = await T('profiles').select('pfp').eq('member_id', uid).maybeSingle();
  return data?.pfp || null;
};
API.pfpSet = async function(uid, dataUrl){
  const { error } = await T('profiles').upsert({ member_id:uid, pfp:dataUrl });
  throwErr(error, '사진 저장 실패');
};
API.pfpDel = async function(uid){ await T('profiles').delete().eq('member_id', uid); };

/* ══ 좋알람 ══
   내용(누가 누굴)은 예전처럼 해시+암호문이라 서버에도 평문이 없다.
   여기에 더해 이제 RLS로 회원만 읽을 수 있다(로그아웃 상태론 아예 접근 불가). */
const CRUSH_PEPPER = 'tunel-joalarm-v1';
const hex = buf => [...new Uint8Array(buf)].map(x=>x.toString(16).padStart(2,'0')).join('');
async function sha256(s){ return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))); }
async function crushAesKey(uid){
  const bits = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('joalarm|'+uid+'|'+CRUSH_PEPPER));
  return await crypto.subtle.importKey('raw', bits, 'AES-GCM', false, ['encrypt','decrypt']);
}
async function crushPairKey(a, b){
  const seed = 'joalarm-pair|' + [a,b].sort().join('|') + '|' + CRUSH_PEPPER;
  const bits = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(seed));
  return await crypto.subtle.importKey('raw', bits, 'AES-GCM', false, ['encrypt','decrypt']);
}
API.crushHash = async function(fromUid, toUid){ return await sha256(`${fromUid}->${toUid}|${CRUSH_PEPPER}`); };
API.crushEncTarget = async function(uid, targetUid){
  const key = await crushAesKey(uid);
  const iv = new Uint8Array(12); crypto.getRandomValues(iv);
  const ct = await crypto.subtle.encrypt({name:'AES-GCM', iv}, key, new TextEncoder().encode(targetUid));
  return hex(iv)+':'+hex(new Uint8Array(ct));
};
API.crushDecTarget = async function(uid, enc){
  try{
    const un = s => new Uint8Array(s.match(/../g).map(x=>parseInt(x,16)));
    const [ivh, cth] = enc.split(':');
    const key = await crushAesKey(uid);
    const pt = await crypto.subtle.decrypt({name:'AES-GCM', iv:un(ivh)}, key, un(cth));
    return new TextDecoder().decode(pt);
  }catch(e){ return null; }
};
API.crushEncContact = async function(a, b, text){
  const key = await crushPairKey(a, b);
  const iv = new Uint8Array(12); crypto.getRandomValues(iv);
  const ct = await crypto.subtle.encrypt({name:'AES-GCM', iv}, key, new TextEncoder().encode(text));
  return hex(iv)+':'+hex(new Uint8Array(ct));
};
API.crushDecContact = async function(a, b, enc){
  try{
    const un = s => new Uint8Array(s.match(/../g).map(x=>parseInt(x,16)));
    const [ivh, cth] = enc.split(':');
    const key = await crushPairKey(a, b);
    const pt = await crypto.subtle.decrypt({name:'AES-GCM', iv:un(ivh)}, key, un(cth));
    return new TextDecoder().decode(pt);
  }catch(e){ return null; }
};
API.crushGet = async function(uid){
  const { data } = await T('crush').select('*').eq('member_id', uid).maybeSingle();
  if(!data) return null;
  return { h:data.h, e:data.e, c:data.c, ts:data.ts, off:data.off };
};
API.crushSave = async function(uid, rec){
  const { error } = await T('crush').upsert({ member_id:uid,
    h:rec.h??null, e:rec.e??null, c:rec.c??null, ts:rec.ts??null, off:rec.off??false });
  throwErr(error, '저장 실패');
};
API.crushClear = async function(uid){ await T('crush').delete().eq('member_id', uid); };
API.crushOffGet = async function(uid){
  const r = await API.crushGet(uid);
  return !!r?.off;
};
API.crushOffSet = async function(uid, off){
  const cur = await API.crushGet(uid) || {};
  await API.crushSave(uid, { ...cur, off });
};
API.crushOffList = async function(){
  const { data } = await T('crush').select('member_id').eq('off', true);
  return (data||[]).map(r=>r.member_id);
};
