/* 첫밤 사망자 클럽 — 사람 — 참여자 표기·프로필·서기 각성·좋알람
   index.html 한 파일에 있던 것을 2026-08-23에 나눴다.
   순수 스크립트라 전역이 그대로 이어진다 — index.html 의 실행 순서를 바꾸지 말 것. */
/* ══ 참여자 표기 ══
   people 배열의 항목은 두 종류다.
     "이름"        수기 기록 — 그대로 보여준다
     { uid:"..." }  회원 태그 — 지금 닉네임을 찾아 보여준다. 닉변해도 따라간다 */
/* 게임 소유자 — 서버 지정(uid)이 우선, 없으면 games.js의 own(씨앗 이름) */
function ownerUid(g){ return OWNERS[g.n] || null; }
function ownerName(g){
  const uid = ownerUid(g);
  if(uid){ const m=MEMBERS.find(m=>m.uid===uid); return m ? m.nick : '(탈퇴한 회원)'; }
  return g.own || '';
}
/* 이 게임 소유자 정보를 볼 수 있는가 — 관리자·운영진이거나, 내가 그 소유자이거나 */
function canSeeOwner(g){
  if(isStaff()) return true;
  const uid = ownerUid(g);
  if(uid && acc && uid===acc.uid) return true;
  // 씨앗 이름(문자열) 소유는 내 닉네임과 일치할 때만
  if(!uid && g.own && acc && myNames().includes(g.own)) return true;
  return false;
}

/* 참여자 항목 → 회원 찾기. 이름 문자열로 기록됐어도 그 닉네임(옛 닉 포함)을
   쓰는 회원이 있으면 회원으로 본다 — 나중에 가입해도 자동으로 연결된다 */
function pMember(x){
  if(typeof x === 'object') return MEMBERS.find(m=>m.uid===x.uid) || null;
  return MEMBERS.find(m=>m.nick===x || (m.aliases||[]).includes(x)) || null;
}
function pName(x){
  const m = pMember(x);
  if(m) return m.nick;
  return typeof x === 'string' ? x : (x.label || '(탈퇴한 회원)');
}
function pIsMe(x){
  if(!acc) return false;
  if(typeof x === 'object') return x.uid === acc.uid;
  return myNames().includes(x);
}
/* ══ 프로필 (썸네일 + 카드) ══ */
const PFP = {};   // uid → dataURL(사진) 또는 null(없음). 세션 캐시
async function loadPfps(uids){
  await Promise.all([...new Set(uids)].filter(u=>!(u in PFP)).map(async u=>{
    try{ PFP[u] = await API.pfpGet(u); }catch(e){ PFP[u]=null; }
  }));
}
function avColor(key){
  let h=0; for(const c of key) h=(h*31+c.charCodeAt(0))%360;
  return `hsl(${h},45%,42%)`;
}
/* 칩 안에 들어가는 작은 동그라미 — 사진 있으면 사진, 없으면 색+첫글자 */
function avHtml(uid, nick){
  const p = PFP[uid];
  return p ? `<i style="background:url('${p}') center/cover"></i>`
           : `<i style="background:${avColor(uid)}">${(nick||'?')[0]}</i>`;
}
/* 참석자 프로필 카드 */
async function openProfile(key, backD){
  const m = MEMBERS.find(x=>x.uid===key);
  const back = backD ? `<div class="mbtns"><button class="mbtn ghost" onclick="openPast('${backD}')">← 모임으로</button></div>` : '';
  if(!m){
    document.getElementById('modal').innerHTML=`
      <h2>${key}</h2>
      <div class="mdesc">비회원 참가자예요. 아직 앱에 가입하지 않아서 프로필이 없어요.</div>
      ${back}<button class="mclose" onclick="closeM()">닫기</button>`;
    document.getElementById('ov').style.display='flex';
    return;
  }
  await loadPfps([m.uid]);
  const list = pastList();
  const att = list.filter(p=>(p.people||[]).some(x=>
    (typeof x==='object' && x.uid===m.uid) || (typeof x==='string' && [m.nick,...(m.aliases||[])].includes(x)))).length;
  const met = (acc && acc.uid!==m.uid) ? metTimes(m.uid) : null;
  const ph = PFP[m.uid];
  document.getElementById('modal').innerHTML=`
    <h2>프로필</h2>
    <div class="pfcard">
      <div class="av" style="${ph?`background:url('${ph}') center/cover`:`background:${avColor(m.uid)}`}">${ph?'':m.nick[0]}</div>
      <div>
        <div class="nm3">${m.nick}</div>
        <div class="sb3">No. ${m.no!=null?String(m.no).padStart(4,'0'):'—'}${m.admin?' · 관리자':m.role==='staff'?' · 운영진':m.scribe?' · 서기':''}</div>
      </div>
    </div>
    <div style="margin-top:12px">
      <div class="mrow"><div class="k">참석</div><div>${att?att+'번':'아직 기록 없음'}</div></div>
      <div class="mrow"><div class="k">가입일</div><div>${(m.joined||'').replace(/-/g,'.')||'—'}</div></div>
      ${met!=null?`<div class="mrow"><div class="k">나와</div><div>${met?`${met}번 같이 했어요`:'아직 같은 회차가 없었어요'}</div></div>`:''}
    </div>
    ${back}<button class="mclose" onclick="closeM()">닫기</button>`;
  document.getElementById('ov').style.display='flex';
}
function meetKeyOf(x){
  if(typeof x==='object') return x.uid;
  const m = MEMBERS.find(m=>m.nick===x || (m.aliases||[]).includes(x));
  return m ? m.uid : x;
}
function myMeetCounts(){
  if(!acc) return {};
  const counts = {};
  pastList().forEach(p=>{
    const ppl = p.people||[];
    if(!ppl.some(pIsMe)) return;             // 내가 안 간 회차는 제외
    ppl.forEach(x=>{
      if(pIsMe(x)) return;                   // 나 자신 제외
      const key = meetKeyOf(x);
      counts[key] = (counts[key]||0)+1;
    });
  });
  return counts;
}
/* 특정 회원을 몇 번 만났나 (표기용 헬퍼 — 나중에 UI 붙일 때 이걸 쓰면 됨) */
function metTimes(uidOrName){
  return myMeetCounts()[uidOrName] || 0;
}

/* ══ 서기 각성 ══
   참석 10회를 채우면 본인에게 "능력이 깨어날 준비가 됐다"는 카드가 한 번 뜨고,
   관리자가 회원관리에서 승인하면 진짜 권한(지난모임 기록)이 붙는다.
   acc.scribeReady: 알림 봤음 / acc.scribe: 승인됨 / acc.scribeHello: 임명 축하 봤음 */
async function checkScribe(){
  if(!acc || acc.admin || acc.role==='staff') return;
  if(acc.scribe && !acc.scribeHello){
    acc.scribeHello = true;
    try{ await API.save(acc); }catch(e){}
    scribeModal(true);
  } else if(!acc.scribe && !acc.scribeReady && myAttendance() >= SCRIBE_MIN){
    acc.scribeReady = true;
    try{ await API.save(acc); }catch(e){}
    scribeModal(false);
  }
}
function scribeModal(appointed){
  document.getElementById('modal').innerHTML = appointed ? `
    <h2 style="text-align:center">📜</h2>
    <div class="hero" style="margin:10px 0 0;text-align:center">
      <div class="dt">서기로 임명되었습니다</div>
      <div class="tm">이제 정모일정 탭에서 지난 모임을 기록할 수 있어요.<br>
        그날 한 게임과 참여자를 남겨주세요 — 참석 기록·만난 횟수가 전부 여기서 나옵니다.</div>
    </div>
    <button class="mclose" onclick="closeM();renderSched()">시작하기</button>` : `
    <h2 style="text-align:center">🌙</h2>
    <div class="hero" style="margin:10px 0 0;text-align:center">
      <div class="dt">밤이 지나고… 능력이 깨어날 준비가 되었습니다</div>
      <div class="tm">${SCRIBE_MIN}번의 밤을 살아남은 당신에게 <b style="color:var(--red-lite)">서기</b>의 자격이 생겼어요.<br>
        촌장의 승인이 떨어지면 능력이 활성화됩니다.</div>
    </div>
    <button class="mclose" onclick="closeM()">기다리기</button>`;
  document.getElementById('ov').style.display='flex';
}

/* ══ 좋알람 (히든) ══
   들어가는 길: 마이페이지 참석 뱃지를 2초 안에 5번 연타.
   어디에도 버튼·배지·알림이 없다 — 아는 사람만 여는 기능. */
const JA_MIN_MEET = 5;      // 이만큼 이상 만난 사람만 지정 가능
const JA_MIN_ATT  = 5;      // 본인 참석이 이만큼 이상이어야 기능 자체가 열림
let jaTapN=0, jaTapT=0;
function jaTap(){
  const now=Date.now();
  if(now-jaTapT>2000) jaTapN=0;
  jaTapT=now;
  if(++jaTapN>=5){ jaTapN=0; openJoalarm(); }
}
const JA_COOLDOWN = 30*24*3600*1000;   // 지정 쿨다운 30일 — 마지막으로 "지정한 시점" 기준. 중간에 거둬도 시계는 계속 간다
function jaDaysLeft(rec){
  if(!rec?.ts) return 0;
  const left = JA_COOLDOWN - (Date.now() - Date.parse(rec.ts));
  return left>0 ? Math.ceil(left/86400000) : 0;
}
async function openJoalarm(){
  if(!acc) return;
  if(myAttendance() < JA_MIN_ATT) return;   // 5회 미만 참석자에겐 5연타해도 아무 일 없음 — 존재 자체를 숨긴다
  document.getElementById('modal').innerHTML=`<h2>🔔</h2><div class="mdesc"><span class="spin"></span> 여는 중…</div>`;
  document.getElementById('ov').style.display='flex';

  const [off, offList, rec] = await Promise.all([
    API.crushOffGet(acc.uid), API.crushOffList(), API.crushGet(acc.uid)]);

  let target=null, tNick='', matched=false, freed=false, tContact=null;
  if(!off && rec?.e){
    target = await API.crushDecTarget(acc.uid, rec.e);
    if(target && offList.includes(target)){
      // 상대가 좋알람을 껐으면 내 슬롯은 통째로 해제 — 쿨다운도 안 남긴다 (내 잘못이 아니니까)
      await API.crushClear(acc.uid); target=null; freed=true;
    }
    if(target){
      const m=MEMBERS.find(m=>m.uid===target); tNick=m?m.nick:'(탈퇴한 회원)';
      const trec = await API.crushGet(target);
      if(trec?.h) matched = trec.h === await API.crushHash(target, acc.uid);
      if(matched && trec.c) tContact = await API.crushDecContact(acc.uid, target, trec.c);
    }
  }
  const daysLeft = freed ? 0 : jaDaysLeft(rec);
  const canSet = daysLeft===0;
  const counts = myMeetCounts();
  const eligible = MEMBERS.filter(m =>
    m.uid!==acc.uid && !offList.includes(m.uid) && (counts[m.uid]||0)>=JA_MIN_MEET);

  document.getElementById('modal').innerHTML=`
    <h2>🔔 좋알람</h2>
    <div class="mdesc">${JA_MIN_MEET}번 이상 함께한 멤버 한 명을 조용히 가리켜둘 수 있어요.
      상대는 모르고, <b style="color:var(--red-lite)">서로 가리키고 있을 때만</b> 둘 다에게 울립니다.
      새로 가리키는 건 마지막 지정으로부터 30일에 한 번.</div>
    ${off ? `
      <div class="notice" style="margin:14px 0 0">좋알람이 꺼져 있어요. 다른 사람이 나를 가리킬 수도 없는 상태예요.</div>
      <div class="mbtns"><button class="mbtn" onclick="jaToggleOff()">다시 켜기</button></div>
    ` : `
      ${matched ? `<div class="hero" style="margin:14px 0 0;text-align:center">
          <div style="font-size:34px">🎉</div>
          <div class="dt">서로예요!</div>
          <div class="tm"><b style="color:var(--red-lite)">${tNick}</b> 님도 나를 가리키고 있어요.</div>
          ${tContact?`<div class="rows" style="text-align:left"><div class="rw"><div class="k">연락처</div><div><b style="color:var(--red-lite)">${tContact}</b><br><span style="font-size:11px;color:var(--sub)">${tNick} 님이 남긴 연락처예요. 먼저 인사해보세요.</span></div></div></div>`
            :`<div class="tm" style="margin-top:8px;font-size:11.5px">상대가 연락처를 안 남겼어요. 모임에서 살짝 물어보세요.</div>`}
        </div>`
      : target ? `<div class="notice" style="margin:14px 0 0">지금 <b style="color:var(--red-lite)">${tNick}</b> 님을 가리키는 중이에요. 상대는 몰라요.
          ${canSet?'':`<br>다른 사람으로 바꾸는 건 ${daysLeft}일 후부터 가능해요.`}</div>`
      : freed ? `<div class="notice" style="margin:14px 0 0">가리키던 분이 좋알람을 꺼서 슬롯이 비워졌어요. 바로 다시 정할 수 있어요.</div>`
      : daysLeft?`<div class="notice" style="margin:14px 0 0">지금은 미지정 상태예요. 새로 가리키는 건 ${daysLeft}일 후부터 가능해요.</div>`
      : ''}
      ${eligible.length ? `
        <div style="font-size:11px;color:var(--sub);margin-top:16px">가리킬 수 있는 멤버 (${JA_MIN_MEET}번 이상 만남)</div>
        <div style="margin-top:8px">${eligible.map(m=>`
          <div class="mem" style="display:flex;align-items:center;justify-content:space-between">
            <span class="nm">${m.nick} <span style="font-size:11px;color:var(--sub)">${counts[m.uid]}번 만남</span></span>
            ${target===m.uid?'<span class="tag">가리키는 중</span>'
              : canSet?`<span class="b" style="flex:none;padding:8px 14px" onclick="jaPick('${m.uid}')">가리키기</span>`:''}
          </div>`).join('')}</div>`
      : `<div class="empty" style="padding:24px 20px">아직 ${JA_MIN_MEET}번 이상 만난 멤버가 없어요.<br>모임에 꾸준히 나오면 목록이 생겨요.</div>`}
      <div class="mbtns" style="margin-top:16px">
        ${target?`<button class="mbtn ghost" onclick="jaUnset()">가리키기 거두기</button>`:''}
        <button class="mbtn ghost" onclick="jaToggleOff()">좋알람 끄기 (받기 거부)</button>
      </div>
    `}
    <div style="font-size:10.5px;color:var(--sub);margin-top:14px;line-height:1.6">
      이 기능은 어디에도 표시되지 않는 비공개 기능이에요. 참석 뱃지 5연타로만 열립니다.</div>
    <button class="mclose" onclick="closeM()">닫기</button>`;
}
/* 가리키기 전 확인 단계 — 매칭됐을 때 상대에게 보여줄 연락처를 여기서 받는다 */
function jaPick(uid){
  const m = MEMBERS.find(x=>x.uid===uid); if(!m) return;
  document.getElementById('modal').innerHTML=`
    <h2>🔔 ${m.nick} 님 가리키기</h2>
    <div class="mdesc">상대는 모르게 조용히 저장돼요. 나중에 <b style="color:var(--red-lite)">${m.nick}</b> 님도 나를 가리키면
      그때 서로에게 알려지고, 아래 연락처가 상대에게 보여요.</div>
    <div class="fld"><label>매칭되면 보여줄 내 연락처</label>
      <input id="jaContact" placeholder="인스타 @아이디 또는 카톡 ID" autocomplete="off"></div>
    <div id="joinErr" style="display:none;color:var(--red-lite);font-size:12px;margin-top:9px"></div>
    <div style="font-size:10.5px;color:var(--sub);margin-top:10px">한 번 가리키면 다른 사람으로 바꾸는 건 30일 후부터 가능해요.</div>
    <div class="mbtns"><button class="mbtn" id="authBtn" onclick="jaConfirm('${uid}')">가리키기</button></div>
    <button class="mclose" onclick="openJoalarm()">← 돌아가기</button>`;
}
async function jaConfirm(uid){
  const contact = document.getElementById('jaContact').value.trim();
  if(!contact) return joinErr('연락처를 적어주세요. 매칭돼도 연락할 방법이 없으면 소용없어요.');
  const rec = await API.crushGet(acc.uid);
  if(jaDaysLeft(rec)>0){ alert('아직 변경할 수 없어요. '+jaDaysLeft(rec)+'일 후에 가능해요.'); return; }
  busy('저장 중');
  const h = await API.crushHash(acc.uid, uid);
  const e = await API.crushEncTarget(acc.uid, uid);
  const c = await API.crushEncContact(acc.uid, uid, contact);
  await API.crushSave(acc.uid, {h, e, c, ts:new Date().toISOString()});
  openJoalarm();
}
/* 거두기는 언제든 — 단, 쿨다운 시계(ts)는 남겨서 "거뒀다 바로 딴 사람" 꼼수를 막는다 */
async function jaUnset(){
  const rec = await API.crushGet(acc.uid);
  await API.crushSave(acc.uid, {ts: rec?.ts || new Date().toISOString()});
  openJoalarm();
}
async function jaToggleOff(){
  const off = await API.crushOffGet(acc.uid);
  if(!off){
    if(!confirm('좋알람을 끄면 내 가리키기도 지워지고, 남이 나를 가리킬 수도 없게 돼요. 끌까요?')) return;
    await API.crushOffSet(acc.uid, true);
    // 가리킴은 지우되 쿨다운 시계(ts)는 남긴다 — 끄고 켜서 30일 제한을 우회 못 하게
    const rec = await API.crushGet(acc.uid);
    if(rec?.ts) await API.crushSave(acc.uid, {ts: rec.ts});
    else await API.crushClear(acc.uid);
  } else {
    await API.crushOffSet(acc.uid, false);
  }
  openJoalarm();
}
