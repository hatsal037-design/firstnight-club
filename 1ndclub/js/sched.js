/* 첫밤 사망자 클럽 — 정모일정 — 회차 목록·상세·할 게임 고르기
   index.html 한 파일에 있던 것을 2026-08-23에 나눴다.
   순수 스크립트라 전역이 그대로 이어진다 — index.html 의 실행 순서를 바꾸지 말 것. */
/* ══ 정모일정 ══ */
const MAPN = s => 'https://map.naver.com/p/search/'+encodeURIComponent(s);
const fmt  = d => {const [y,m,dd]=d.split('-');return `${+m}/${+dd}`;};

const PAST_PAGE = 10;
let pastShown = PAST_PAGE;   // 최신 N개만 먼저 보여주고, 위로 더 올리면 늘려간다

function renderSched(){
  /* 회차가 끝나거나 모집이 닫히는 순간에 맞춰 저절로 다시 그린다.
     파생값(openRound·upcoming·pastList)을 먼저 다시 만들고 그린다 */
  TUNEL.autoPast(ROUNDS, () => { recalcRounds(); if(view==='sched') renderSched(); });
  const names = myNames();
  const allPast = pastList().slice().sort((a,b)=>a.d.localeCompare(b.d));   // 오래된 것부터
  const shown = Math.min(pastShown, allPast.length);
  const hidden = allPast.length - shown;
  const past = allPast.slice(hidden);   // 최근 shown개만 렌더링
  const mineOf = p => (p.people||[]).some(pIsMe);

  /* 지난 모임 — 내가 참석한 것만 자세히 보이고, 나머지는 날짜·장소만 흐리게.
     관리자는 전부 볼 수 있다. 목록이 길어지는 걸 막으려고 최근 것만 먼저 그리고,
     맨 위 더보기를 누르거나 그 지점까지 스크롤하면 10개씩 더 불러온다. */
  let html='';
  if(hidden>0){
    html += `<div class="pastmore" id="pastLoader" onclick="loadMorePast()">이전 모임 ${Math.min(PAST_PAGE,hidden)}개 더보기 · ${hidden}개 남음</div>`;
  }
  let lastM='';
  past.forEach(p=>{
    const mine = mineOf(p), open = mine || canRecord();
    const m=p.d.slice(0,7);
    if(m!==lastM){ html+=`<div class="monthlab">${+p.d.slice(5,7)}월 · ${p.d.slice(0,4)}</div>`; lastM=m; }
    html+=`<div class="rd past${mine?' mine':''}" onclick="toggleDetail(this)">
      <div class="stub">${mine
        ? `<img class="wax" src="stamp_wax.png" alt=""><div class="wtx">첫밤行<small>${p.d.slice(5).replace('-','.')}</small></div>`
        : `<div class="lb">USED</div>`}</div>
      <span class="bpl">TÜNEL BOARDING PASS · USED</span>
      <div class="top">
        <span class="dt">${fmt(p.d)} <span style="font-size:14px">(${p.dow})</span></span>
        <span class="tm">${p.s}~${p.e}</span>
        ${mine?'<span class="mineflag">참석</span>'
              :`<span class="st done">${p.kind==='flash'?'번개':(p.r?p.r+'회차':'정모')}</span>`}
      </div>
      <div class="pl">${p.place}${open&&p.people?.length?` · ${p.people.length}명`:''}</div>
      <span class="expand">›</span>
    </div>
    <div class="rdx">
      ${open?`
        ${p.auto&&!p.memo?`<div class="ad">아직 기록을 안 채운 회차예요${canRecord()?' · 편집으로 채워주세요':''}</div>`:''}
        ${p.memo?`<div class="nt">${p.memo}</div>`:''}
        ${(p.played||[]).length?`<div class="tags">${p.played.map(g=>`<span class="tg">${g}</span>`).join('')}</div>`:''}
        <div class="btns">
          <span class="b" onclick="openPast('${p.d}')">자세히 보기</span>
          ${canRecord()?`<span class="b" onclick="editPast('${p.d}')">✏️ 편집</span>`:''}
        </div>`
      :`<div class="ad">참석하지 않은 모임이에요</div>`}
    </div>`;
  });

  /* 지금 — 여기가 기본 스크롤 위치 */
  html += `<div class="nowline" id="nowAnchor"><span>여기까지 지났어요</span></div>`;

  lastM='';
  upcoming.forEach(r=>{
    const m=r.d.slice(5,7);
    if(m!==lastM){ html+=`<div class="monthlab">${+m}월</div>`; lastM=m; }
    /* 티켓도 상세도 한 벌만 만든다 — 회차 자료(r)를 손대지 않고 그대로 넘긴다.
       허브(tunel.kr)가 받는 것과 같은 객체라, 두 화면이 어긋날 수 없다 */
    html+= TUNEL.ticketOne(r, { onclick:'TUNEL.ticketToggle(this)' });
    html+= TUNEL.ticketDetail(r,
      { extra: r.st==='open' ? `
          <div class="picked" id="schedPicked" style="margin:11px 0 0;padding:11px 12px"></div>
          <div class="xb">
            <a onclick="openPick()">🔪 할 게임 고르기</a>
            <a onclick="shareTicket('${r.d}')">🎟 티켓 공유하기</a>
          </div>` : ''
        + (canRecord() ? `<div class="xr" style="opacity:.6;margin-top:8px">예정 회차 수정은 앱 관리에서 · 끝난 뒤 지난 모임으로 옮기면 여기서 편집돼요</div>` : '') });
  });

  if(PENDING_APPLY){ const want=PENDING_APPLY; PENDING_APPLY=null;
    setTimeout(()=>{ try{ openApplyByDate(want); }catch(e){} }, 300); }   // 신청 링크로 들어온 경우
  const banned = acc?.role==='banned';
  document.getElementById('schedTop').innerHTML = banned
    ? `<div class="banbox">활동이 정지된 계정이에요. 일정과 기록은 볼 수 있지만
         참석 신청·게임 고르기·기록 작성은 할 수 없어요. 궁금한 점은 진행자에게 말씀해주세요.</div>`
    : canRecord()
    ? `<div class="adminbox" style="margin:14px 14px 0">
         <div class="at">${isAdmin()?'🔧 관리자':isStaff()?'🔧 운영진':'📜 서기'}</div>
         <div class="row" style="color:var(--sub)">지난 모임의 참여자와 한 게임을 기록할 수 있어요.</div>
         <button class="abtn" onclick="editPast('')">＋ 지난 모임 추가</button>
       </div>` : '';
  document.getElementById('schedList').innerHTML = html;
  renderPicked();
  TUNEL.onSignupChange = () => { updateStubs(); };   // 도장·명단 모두 공용이 갱신한다
  TUNEL.signupInit();   // 신청 바·팝업·신청자 명단 — 허브와 같은 공통 모듈

  // 가장 가까운 앞으로의 일정이 화면 맨 위에 오도록 (더보기로 다시 그릴 때는 건너뛴다)
  if(!schedScrolled){
    schedScrolled = true;
    setTimeout(()=>{
      const a=document.getElementById('nowAnchor');
      if(a) window.scrollTo({top: a.offsetTop - 12, behavior:'auto'});
      watchPastLoader();   // 스크롤을 지금 위치로 옮긴 다음에 감시를 켜야, 로더가 화면에 잠깐 보였다가 바로 또 불러오는 걸 막는다
    },30);
  } else {
    watchPastLoader();
  }
}
/* 상세 패널은 티켓의 형제 요소라 클릭이 티켓으로 번지지 않는다 — 따로 막을 필요 없음 */
/* 공용 상세가 열릴 때 첫밤 고유 영역(참석 응답·고른 게임)을 채운다 */
TUNEL.onDetailOpen = () => { try{ renderPicked(); }catch(e){} };   // 신청 명단은 공용 상세가 그린다
function toggleDetail(el){
  /* 티켓과 상세 사이에 신청 바(.tnlbar)가 끼어 있어서, 바로 다음이 아니라
     .rdx 가 나올 때까지 형제를 따라간다 */
  let x = el.nextElementSibling;
  while(x && !x.classList.contains('rdx')) x = x.nextElementSibling;
  if(!x) return;
  const willOpen = !x.classList.contains('show');
  document.querySelectorAll('.rdx.show').forEach(o=>{o.classList.remove('show')});
  document.querySelectorAll('.rd.on,.btk.on').forEach(o=>o.classList.remove('on'));
  if(willOpen){ x.classList.add('show'); el.classList.add('on'); }
}
let schedScrolled = false;

/* 지난 모임 더보기 — 버튼을 눌러도 되고, 그 지점까지 스크롤을 올려도 자동으로 불러온다.
   위에 내용이 추가되면 화면이 훅 튀니까, 늘어난 높이만큼 스크롤 위치를 보정해준다. */
function loadMorePast(){
  const prevHeight = document.documentElement.scrollHeight;
  const prevScroll = window.scrollY;
  pastShown += PAST_PAGE;
  renderSched();
  requestAnimationFrame(()=>{
    const grew = document.documentElement.scrollHeight - prevHeight;
    window.scrollTo({top: prevScroll + grew, behavior:'auto'});
  });
}
let pastLoaderObs = null;
function watchPastLoader(){
  if(pastLoaderObs){ pastLoaderObs.disconnect(); pastLoaderObs=null; }
  const el = document.getElementById('pastLoader');
  if(!el || typeof IntersectionObserver==='undefined') return;
  pastLoaderObs = new IntersectionObserver(entries=>{
    if(entries[0].isIntersecting) loadMorePast();
  }, {rootMargin:'200px 0px 0px 0px'});
  pastLoaderObs.observe(el);
}

/* 지난 모임 자세히 보기 */
async function openPast(d){
  const p = pastList().find(x=>x.d===d); if(!p) return;
  const mine = (p.people||[]).some(pIsMe);
  if(!mine && !canRecord()) return;
  try{
    const uids = (p.people||[]).map(meetKeyOf).filter(k=>MEMBERS.some(m=>m.uid===k));
    await loadPfps(uids);
  }catch(e){}
  document.getElementById('modal').innerHTML=`
    <h2>${fmt(p.d)} (${p.dow}) ${p.kind==='flash'?'번개':(p.r?p.r+'회차':'정모')}</h2>
    <div class="mdesc">${p.place}</div>
    <div style="margin-top:14px">
      <div class="mrow"><div class="k">날짜</div><div>${p.d.replace(/-/g,'.')} (${p.dow})</div></div>
      <div class="mrow"><div class="k">시간</div><div>${p.s} ~ ${p.e}</div></div>
      <div class="mrow"><div class="k">장소</div><div>${p.place}</div></div>
      ${p.fee?`<div class="mrow"><div class="k">참가비</div><div>${p.fee}</div></div>`:''}
      ${p.people?.length?`<div class="mrow"><div class="k">참여자</div><div>${p.people.length}명<br>${p.people.map(x=>{
        const key = meetKeyOf(x);
        const mem = MEMBERS.find(m=>m.uid===key);
        if(mem) return `<span class="pf" onclick="openProfile('${mem.uid}','${p.d}')">${avHtml(mem.uid,mem.nick)}${mem.nick}</span>`;
        const esc=String(x).replace(/'/g,"\\'");
        return `<span class="pf guest" onclick="openProfile('${esc}','${p.d}')"><i style="background:#4a4a55">${String(x)[0]}</i>${x}</span>`;
      }).join('')}</div></div>`:''}
      ${p.after?`<div class="mrow"><div class="k">2차</div><div>${p.after}</div></div>`:''}
    </div>
    ${(p.played||[]).length?`<div style="font-size:11px;color:var(--sub);margin-top:14px">그날 한 게임</div>
      <div class="tags">${p.played.map(g=>{const i=GAMES.findIndex(x=>x.n===g);
        return i>=0?`<span class="tg" style="cursor:pointer" onclick="openM(${i})">${g}</span>`:`<span class="tg">${g}</span>`;}).join('')}</div>`:''}
    ${p.memo?`<div class="mrule">${p.memo}</div>`:''}
    ${canRecord()?`<div class="mbtns"><button class="mbtn ghost" onclick="editPast('${p.d}')">✏️ 기록 편집</button></div>`:''}
    <button class="mclose" onclick="closeM()">닫기</button>`;
  document.getElementById('ov').style.display='flex';
}


/* 스터브 도장 — 공용(TUNEL.stubPaint)이 찍는다. 신청 상태가 바뀔 때 같이 부른다 */
function updateStubs(){ if(TUNEL.stubPaint) TUNEL.stubPaint(); }

/* ══ 할 게임 고르기 ══ */
function openPick(){
  if(!openRound) return;
  const r=openRound, n=r.cap||12;
  const all=GAMES.filter(g=>g.have!==false);
  const whole=all.filter(g=>n>=g.min&&(g.max===null||n<=g.max)).sort(byCat);
  const split=all.filter(g=>!(n>=g.min&&(g.max===null||n<=g.max))).sort(byCat);

  document.getElementById('modal').innerHTML=`
    <h2>${r.r?r.r+'회차':'다음 회차'}에 할 게임</h2>
    <div class="mdesc">${fmt(r.d)} (${r.dow}) · ${r.s}~${r.e} · ${r.place}</div>
    <div class="picked" id="pickedBox" style="margin:14px 0 0"></div>
    <div class="notice" style="margin:10px 0 0">★를 눌러 고르면 바로 저장돼요.
      여러 개 골라도 괜찮아요. 그날 인원과 분위기 보고 정합니다.
      ${acc?'':'<br>지금은 이 기기에만 담겨요. <b style="color:var(--red-lite)">로그인하면 모임장에게 전달됩니다.</b>'}</div>
    <div class="label" style="margin:20px 0 9px">${n}명이 다 같이 · ${whole.length}개</div>
    <div class="list" id="plist" style="margin:0">${whole.map(g=>gameCard(g,'pick')).join('')}</div>
    <div class="label" style="margin:22px 0 9px">테이블 나눠서 · ${split.length}개</div>
    <div class="notice" style="margin:0 0 10px">${n}명이 한 판에 못 들어가는 게임들이에요.
      두 테이블로 나눠 돌리면 됩니다. 예를 들면 아발론 6명 + 시크릿 히틀러 6명.</div>
    <div class="list" id="plist2" style="margin:0">${split.map(g=>gameCard(g,'pick')).join('')}</div>
    <button class="mclose" onclick="closeM()">다 골랐어요</button>`;
  document.getElementById('ov').style.display='flex';
  renderPicked();
}
function renderPicked(){
  if(!openRound) return;
  const tot=picks.reduce((s,n)=>s+(GAMES.find(g=>g.n===n)?.t||0),0);
  const txt = picks.length
      ? `내가 고른 게임 <b>${picks.length}개</b> · 다 하면 약 <b>${tot}분</b><br>${picks.join(' · ')}`
        + (acc?'':`<br><span class="none">로그인하면 모임장에게 전달돼요</span>`)
      : `<span class="none">아직 고른 게임이 없어요. 아래 버튼으로 골라주세요.</span>`;
  ['pickedBox','schedPicked'].forEach(id=>{const el=document.getElementById(id); if(el) el.innerHTML=txt;});
}
async function togPick(n){
  picks = picks.includes(n) ? picks.filter(x=>x!==n) : [...picks,n];
  document.querySelectorAll('#plist .game, #plist2 .game').forEach(el=>{
    const st=el.querySelector('.star');
    const name=el.querySelector('.nm').textContent.replace(/^[★☆]/,'');
    const on=picks.includes(name);
    el.classList.toggle('fav',on);
    st.classList.toggle('on',on); st.textContent=on?'★':'☆';
  });
  renderPicked();
  // 로그인 전에는 이 기기에만 담아두고, 로그인하면 서버로 올린다
  if(acc){ try{ await API.setPicks(openRound.d, acc.uid, picks); }catch(e){} }
  else lsSet('botc_picks_anon', JSON.stringify(picks));
}
