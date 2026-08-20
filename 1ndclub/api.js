/* 첫밤 사망자 클럽 — 계정 서버 레이어 v2 (Supabase)
   kvdb(공개 버킷)에서 Supabase(서버가 접근제어를 강제)로 이사한 버전.
   함수 이름과 계정 모양(acc.uid/nick/admin/…)은 옛 api.js와 최대한 같게 유지해서
   index.html 수정을 최소화했다. DB 컬럼명(is_admin, scribe_ready…)과의 변환은 여기서만.

   로그인: Supabase Auth의 카카오 OAuth. 비밀번호 로그인은 폐지(카카오 전용).
   세션: supabase-js가 localStorage에 알아서 관리. 우리가 uid를 직접 저장하지 않는다. */

const SB_URL = 'https://yguvfogtzazoawtclqvf.supabase.co';
const SB_KEY = 'sb_publishable_KeezD9hmEnxSTEWA_w8x-A_Tgk3roUf';   // 공개용 키 (노출 정상)
const sb = window.supabase.createClient(SB_URL, SB_KEY);

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
API.rename = async function(acc, newNick){
  if(newNick === acc.nick) return acc;
  if(await API.nickTaken(newNick)) throw new Error(`'${newNick}'은(는) 이미 쓰고 있는 닉네임이에요.`);
  const old = acc.nick;
  if(old && !acc.aliases.includes(old)) acc.aliases.unshift(old);
  acc.nick = newNick;
  return await API.save(acc);
};
API.list = async function(){
  const { data } = await T('members').select('*, member_private(payname)').order('no');
  return (data||[]).map(r=>rowToAcc(r));
};
/* ══ 항목 참조(catalog) — 게임 이름 ↔ 고정키 변환 ══
   2026-08-20 회원 활동 통합. 통계·기록은 이름이 아니라 catalog_items 참조로 잇는다.
   설계: 브랜드/회원활동_설계.md */
let _items = null;
async function itemsMap(){
  if(_items) return _items;
  const { data } = await sb.from('catalog_items').select('id,key,name').eq('line', LINE);
  _items = { byName:{}, byId:{} };
  (data||[]).forEach(r => { _items.byName[r.name] = r; _items.byId[r.id] = r; });
  return _items;
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

/* 회차 전체 — 앱이 쓰던 ROUNDS 모양으로 돌려준다 (schedule.js 대체) */
API.roundsList = async function(){
  const { data } = await sb.from('meetings').select('*')
    .eq('line', LINE).order('d', { ascending:true });
  return (data||[]).map(m => ({
    r: m.r ?? null, d: m.d, dow: m.dow || '', s: m.s || '', e: m.e || '',
    h: (m.data && m.data.h) ?? null,
    st: m.status === 'open' ? 'open' : m.status === 'done' ? 'done'
        : m.status === 'cancelled' ? 'cancelled' : 'soon',
    place: m.place || '', addr: m.addr || '',
    mapq: (m.data && m.data.mapq) || null,
    cap: (m.data && m.data.cap) ?? null,
    fee: m.fee || '', note: m.memo || '', after: m.after || null
  }));
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
  const { data } = await T('notices').select('*').order('at', {ascending:false});
  return (data||[]).map(r=>({ id:r.id, title:r.title, body:r.body, target:r.target,
                              roundDate:r.round_d, by:r.by_id, at:r.at }));
};
API.noticeCreate = async function(n){
  const { data, error } = await T('notices')
    .insert({ title:n.title, body:n.body, target:n.target, round_d:n.roundDate||null, by_id:n.by||null })
    .select().single();
  throwErr(error, '공지 저장 실패');
  return data;
};
API.noticeDelete = async function(id){ await T('notices').delete().eq('id', id); };
API.getRead = async function(uid){
  const { data } = await T('notice_reads').select('read_ids').eq('member_id', uid).maybeSingle();
  return data?.read_ids || [];
};
API.setRead = async function(uid, ids){
  await T('notice_reads').upsert({ member_id:uid, read_ids:ids });
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
