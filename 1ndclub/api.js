/* 첫밤 사망자 클럽 — 계정 서버 레이어
   kvdb.io 버킷 하나를 저장소로 쓴다. 서버를 따로 돌리지 않아도 되고 무료다.
   (봉은사 벙 앱이 쓰던 버킷과 같은 곳. 키 앞에 botc: 를 붙여 섞이지 않게 했다)

   저장 구조
     botc:u:<uid>        계정 JSON  { uid, nick, aliases[], salt, hash, admin, joined }
     botc:n:<닉네임소문자> uid        — 닉네임 중복 검사와 로그인에 쓰는 색인

   ⚠️ 알고 있어야 할 것
     이 버킷은 주소를 아는 사람이면 읽고 쓸 수 있는 공개 저장소다.
     그래서 비밀번호는 원문을 절대 올리지 않고, 사용자마다 다른 소금(salt)을 섞어
     PBKDF2로 10만 번 늘려 만든 값만 저장한다. 값이 새어도 원래 비밀번호를 되돌리기 어렵다.
     그래도 은행 수준의 보호는 아니므로, 다른 곳에서 쓰는 비밀번호는 쓰지 않게 안내한다.
*/

const KV = 'https://kvdb.io/DJQNWiVLSeiXfWCAYSyAZz';
const K_USER = uid  => `botc:u:${uid}`;
const K_NICK = nick => `botc:n:${nick.toLowerCase()}`;
const K_SEQ  = 'botc:seq:member';   // 다음에 발급할 회원번호(정수). 한 번 준 번호는 탈퇴해도 재사용하지 않는다

/* ── 저수준 ── */
async function kvGet(key){
  const r = await fetch(`${KV}/${encodeURIComponent(key)}`);
  return r.ok ? await r.text() : null;
}
async function kvPut(key, val){
  const r = await fetch(`${KV}/${encodeURIComponent(key)}`, {method:'PUT', body:val});
  if(!r.ok) throw new Error('저장에 실패했어요 (' + r.status + ')');
}
async function kvDel(key){
  await fetch(`${KV}/${encodeURIComponent(key)}`, {method:'DELETE'});
}
/* 주의: 목록 조회는 방금 쓴 값이 1초쯤 늦게 반영된다(측정값).
   회원관리 화면에 새로고침 버튼을 둔 이유다. 개별 키 조회는 즉시 반영된다. */
async function kvList(prefix){
  const r = await fetch(`${KV}/?prefix=${encodeURIComponent(prefix)}&values=true&format=json`);
  if(!r.ok) return [];
  try { return await r.json(); } catch(e){ return []; }
}

/* ── 비밀번호 ── */
const hex = buf => [...new Uint8Array(buf)].map(x=>x.toString(16).padStart(2,'0')).join('');

function newSalt(){
  const a = new Uint8Array(16); crypto.getRandomValues(a); return hex(a);
}
async function hashPw(pw, salt){
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name:'PBKDF2', salt:new TextEncoder().encode(salt), iterations:100000, hash:'SHA-256' }, key, 256);
  return hex(bits);
}
async function sha256(s){
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
}

function newUid(){
  return crypto.randomUUID ? crypto.randomUUID()
       : 'xxxxxxxx-xxxx-4xxx-yxxx'.replace(/[xy]/g,()=>((Math.random()*16)|0).toString(16));
}

/* 회원번호는 가입 순서를 계산해서 매기지 않고, 발급 즉시 계정에 고정으로 박아둔다.
   그래야 중간에 누가 탈퇴해도 남은 사람 번호가 밀리지 않는다 — 탈퇴한 자리는 그냥 빈 번호로 남는다.
   ⚠️ kvdb에 원자적 증가가 없어 동시가입이 겹치면 같은 번호가 나갈 수 있지만,
   이 규모의 클럽에서 같은 순간에 두 명이 동시가입할 확률은 무시 가능하다고 봤다. */
async function nextMemberNo(){
  const cur = await kvGet(K_SEQ);
  const n = cur ? parseInt(cur,10) : 1;
  await kvPut(K_SEQ, String(n+1));
  return n;
}

/* ── 계정 ── */
const API = {
  /* 닉네임이 이미 쓰이고 있는가 */
  async nickTaken(nick){
    return !!(await kvGet(K_NICK(nick)));
  },

  async signup(nick, pw, payname='', admin=false){
    if(await API.nickTaken(nick)) throw new Error(`'${nick}'은(는) 이미 쓰고 있는 닉네임이에요.`);
    const salt = newSalt();
    const acc = {
      uid: newUid(), nick, aliases: [], salt,
      hash: await hashPw(pw, salt), admin,
      payname,                                   // 입금자명 — 관리자만 본다
      joined: new Date().toISOString().slice(0,10),
      joinedAt: new Date().toISOString(),         // 가입 순번 정렬용 — joined는 날짜만이라 동일자 가입 순서를 못 가림
      no: await nextMemberNo(),                   // 고정 회원번호 — 탈퇴자가 생겨도 재배정하지 않는다
    };
    await kvPut(K_USER(acc.uid), JSON.stringify(acc));
    await kvPut(K_NICK(nick), acc.uid);
    return acc;
  },

  async login(nick, pw){
    const uid = await kvGet(K_NICK(nick));
    if(!uid) throw new Error('그 닉네임으로 가입한 기록이 없어요.');
    const acc = await API.get(uid);
    if(!acc) throw new Error('계정을 못 찾았어요. 관리자에게 말씀해주세요.');
    if(await hashPw(pw, acc.salt) !== acc.hash) throw new Error('비밀번호가 달라요.');
    return acc;
  },

  async get(uid){
    const t = await kvGet(K_USER(uid));
    try { return t ? JSON.parse(t) : null; } catch(e){ return null; }
  },

  async save(acc){
    await kvPut(K_USER(acc.uid), JSON.stringify(acc));
    return acc;
  },

  /* 닉네임 변경 — 옛 이름은 aliases 에 남겨서 지난 활동이 계속 잡히게 한다 */
  async rename(acc, newNick){
    if(newNick === acc.nick) return acc;
    if(await API.nickTaken(newNick)) throw new Error(`'${newNick}'은(는) 이미 쓰고 있는 닉네임이에요.`);
    const old = acc.nick;
    if(old && !acc.aliases.includes(old)) acc.aliases.unshift(old);
    acc.nick = newNick;
    await kvPut(K_NICK(newNick), acc.uid);
    await kvDel(K_NICK(old));
    return await API.save(acc);
  },

  async setPw(acc, pw){
    acc.salt = newSalt();
    acc.hash = await hashPw(pw, acc.salt);
    return await API.save(acc);
  },

  async list(){
    const rows = await kvList('botc:u:');
    return rows.map(([,v]) => { try { return JSON.parse(v); } catch(e){ return null; } })
               .filter(Boolean)
               .sort((a,b)=> (a.joinedAt||a.joined||'').localeCompare(b.joinedAt||b.joined||'') || a.nick.localeCompare(b.nick,'ko'));
  },

  async remove(acc){
    await kvDel(K_USER(acc.uid));
    await kvDel(K_NICK(acc.nick));
    for(const a of (acc.aliases||[])) await kvDel(K_NICK(a));
  },

  /* ── 회차별 게임 선택 ──
     botc:p:<회차날짜>:<uid> = ["달무티","아발론"]
     관리자는 회차 전체를 긁어 집계한다. */
  async setPicks(date, uid, arr){
    const key = `botc:p:${date}:${uid}`;
    if(arr.length) await kvPut(key, JSON.stringify(arr));
    else           await kvDel(key);
  },
  async getMyPicks(date, uid){
    const t = await kvGet(`botc:p:${date}:${uid}`);
    try { return t ? JSON.parse(t) : []; } catch(e){ return []; }
  },
  /* [{uid, games[]}] 형태로 그 회차의 모든 선택을 돌려준다 */
  async allPicks(date){
    const rows = await kvList(`botc:p:${date}:`);
    return rows.map(([k,v])=>{
      try { return { uid:k.split(':').pop(), games:JSON.parse(v) }; } catch(e){ return null; }
    }).filter(Boolean);
  },
};

/* ── 지난 모임 기록 (서버) ──
   botc:past:<날짜> = 기록 JSON. past.js 는 씨앗 데이터이고, 서버 기록이 같은 날짜면 덮어쓴다.
   관리자가 앱에서 저장하면 그 자리에서 모두에게 보인다. */
API.pastList = async function(){
  const rows = await kvList('botc:past:');
  return rows.map(([k,v])=>{ try { return JSON.parse(v); } catch(e){ return null; } }).filter(Boolean);
};
API.pastSave = async function(rec){
  await kvPut(`botc:past:${rec.d}`, JSON.stringify(rec));
};
API.pastDelete = async function(d){
  await kvDel(`botc:past:${d}`);
};

/* ── 참석 여부 (RSVP) ──
   botc:a:<날짜>:<uid> = "yes" | "no"  (미응답은 키 없음) */
API.setRsvp = async function(date, uid, v){
  const key = `botc:a:${date}:${uid}`;
  if(v) await kvPut(key, v); else await kvDel(key);
};
API.getMyRsvp = async function(date, uid){
  return await kvGet(`botc:a:${date}:${uid}`);
};
API.allRsvp = async function(date){
  const rows = await kvList(`botc:a:${date}:`);
  return rows.map(([k,v])=>({ uid:k.split(':').pop(), v }));
};

/* ── 카카오 로그인 ──
   흐름: 버튼 → kauth 인가(리다이렉트) → ?code= 받아 토큰 교환 → 회원번호(kakao id) 획득
   매핑: botc:kk:<카카오회원번호> = uid   (카카오 계정 1개 = 클럽 계정 1개)
   ※ REST 키·시크릿이 소스에 있지만, 등록된 리다이렉트 URI(tunel.kr)로만 코드가 떨어지므로
     타 사이트가 이 앱 행세를 할 수는 없다. */
const KAKAO = {
  restKey: '48a2b31b13cafa57e7dae415e7a38383',
  secret:  'cHhtNvBgktotgmxo8ovFR91wV7JL62fr',
  redirect: 'https://tunel.kr/1ndclub/',
};

API.kakaoAuthorize = function(){
  const u = new URLSearchParams({
    client_id: KAKAO.restKey, redirect_uri: KAKAO.redirect, response_type: 'code',
  });
  location.href = 'https://kauth.kakao.com/oauth/authorize?' + u.toString();
};

/* 인가 코드 → 카카오 회원번호 */
API.kakaoExchange = async function(code){
  const body = new URLSearchParams({
    grant_type:'authorization_code', client_id:KAKAO.restKey,
    redirect_uri:KAKAO.redirect, code, client_secret:KAKAO.secret,
  });
  const tr = await fetch('https://kauth.kakao.com/oauth/token', {
    method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded;charset=utf-8'}, body,
  });
  if(!tr.ok) throw new Error('카카오 인증에 실패했어요 ('+tr.status+')');
  const tok = await tr.json();
  const ur = await fetch('https://kapi.kakao.com/v2/user/me', {
    headers:{ Authorization:'Bearer '+tok.access_token },
  });
  if(!ur.ok) throw new Error('카카오 정보 조회 실패 ('+ur.status+')');
  const me = await ur.json();
  return String(me.id);
};

const K_KAKAO = kid => `botc:kk:${kid}`;

API.findByKakao = async function(kid){
  const uid = await kvGet(K_KAKAO(kid));
  return uid ? await API.get(uid) : null;
};
API.linkKakao = async function(kid, uid){
  await kvPut(K_KAKAO(kid), uid);
};
/* 카카오로 새 계정 만들기 — 비밀번호가 없는 계정 */
API.signupKakao = async function(kid, nick, payname=''){
  if(await API.nickTaken(nick)) throw new Error(`'${nick}'은(는) 이미 쓰고 있는 닉네임이에요.`);
  const acc = { uid:newUid(), nick, aliases:[], salt:'', hash:'', kakao:kid, admin:false,
                payname, joined:new Date().toISOString().slice(0,10), joinedAt:new Date().toISOString(),
                no: await nextMemberNo() };
  await kvPut(K_USER(acc.uid), JSON.stringify(acc));
  await kvPut(K_NICK(nick), acc.uid);
  await API.linkKakao(kid, acc.uid);
  return acc;
};

/* ── 게임 소유자 (서버) ──
   botc:owner:<게임이름> = uid   관리자가 지정. games.js의 own(씨앗)을 덮어쓴다.
   소유자 본인과 관리자만 볼 수 있게 표시 제어는 화면(index.html)에서. */
API.ownerMap = async function(){
  const rows = await kvList('botc:owner:');
  const m = {};
  rows.forEach(([k,v]) => { m[k.slice('botc:owner:'.length)] = v; });   // {게임이름: uid}
  return m;
};
API.setOwner = async function(gameName, uid){
  const key = `botc:owner:${gameName}`;
  if(uid) await kvPut(key, uid);
  else    await kvDel(key);
};

/* ── 공지 (앱 자체 알림) ──
   botc:notice:<id> = { id, title, body, target, roundDate, by, at }
     target: 'all' | 'rsvp' | 'picks'  (특정 회차 참석자 / 게임 고른 사람)
   읽음 표시는 사람별로: botc:read:<uid> = [noticeId, ...]  (내 기기+서버 동기화) */
API.noticeList = async function(){
  const rows = await kvList('botc:notice:');
  return rows.map(([,v])=>{ try{return JSON.parse(v);}catch(e){return null;} })
             .filter(Boolean).sort((a,b)=>(b.at||'').localeCompare(a.at||''));
};
API.noticeCreate = async function(n){
  const id = 'n' + Date.now().toString(36);
  const rec = { id, ...n };
  await kvPut(`botc:notice:${id}`, JSON.stringify(rec));
  return rec;
};
API.noticeDelete = async function(id){ await kvDel(`botc:notice:${id}`); };

API.getRead = async function(uid){
  const t = await kvGet(`botc:read:${uid}`);
  try{ return t ? JSON.parse(t) : []; }catch(e){ return []; }
};
API.setRead = async function(uid, ids){
  await kvPut(`botc:read:${uid}`, JSON.stringify(ids));
};
