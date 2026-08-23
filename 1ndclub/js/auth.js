/* 첫밤 사망자 클럽 — 세션·카카오 로그인·뷰 전환
   index.html 한 파일에 있던 것을 2026-08-23에 나눴다.
   순수 스크립트라 전역이 그대로 이어진다 — index.html 의 실행 순서를 바꾸지 말 것. */
/* ══ 세션 ══
   Supabase가 세션을 관리한다. 카카오 로그인에서 돌아오면 세션이 자동으로 잡히고,
   기존 회원이면 claim으로 자동 연결, 처음이면 가입 시트를 띄운다. */
async function bootSession(){
  let needOnboard = false;
  const ok = p => p.catch(() => null);
  /* 노선 값 · 회차 · 내 계정 — 서로를 기다릴 이유가 없다. 동시에 보낸다.
     노선 값은 lineInfo() 가, 회차는 openRound/upcoming 이 그린 뒤부터 쓴다 */
  const [, rows, a] = await Promise.all([
    ok(TUNEL.lines()), ok(API.roundsList()), ok(API.myMember()),
  ]);
  if(rows && rows.length){ ROUNDS = rows; recalcRounds(); }
  else if(!rows) console.warn('회차를 서버에서 못 받아 폴백을 씁니다');
  acc = a || null;
  try{
    if(!acc && await API.hasSession()) needOnboard = true;   // 카카오 인증은 됐는데 회원이 아직 아님
    if(acc){
      favs = fixNames(acc.favs);                                 // 즐겨찾기는 이제 서버(내 계정)에서
      if(openRound){
        const [pk, rv] = await Promise.all([
          ok(API.getMyPicks(openRound.d, acc.uid)), ok(API.getMyRsvp(openRound.d, acc.uid)),
        ]);
        picks = fixNames(pk || []);
        myRsvp = rv;
      }
    }
  }catch(e){ /* 오프라인이면 그냥 비로그인으로 둔다 */ }
  /* 아래 여섯도 마찬가지 — 한 줄로 세우지 않는다 */
  const [sp, mem, fc, own, nt, rd] = await Promise.all([
    ok(API.pastList()), ok(API.list()), ok(API.favCounts()),
    ok(API.ownerMap()), ok(API.noticeList()),
    acc ? ok(API.getRead(acc.uid)) : null,
  ]);
  if(sp)  serverPast = sp;
  if(mem) MEMBERS = mem;
  if(fc)  FAVCOUNT = fc;
  if(own) OWNERS = own;
  if(nt)  NOTICES = nt;
  if(rd)  readIds = rd;
  computeMyPlayed();
  /* 공지 대상 판정용 내 참석·게임선택은 회차마다 되묻지 않는다 —
     내 것 전부를 두 번에 받아 날짜별로 나눈다 (회차 11개면 33질의 → 2질의) */
  await Promise.all([
    acc ? ok(loadPfps([acc.uid])) : null,
    acc ? ok(Promise.all([API.myRsvpMap(acc.uid), API.myPickedMeetings(acc.uid)])
      .then(([rsvpMap, pickedIds]) => { for(const r of upcoming){
        MY_RSVP[r.d]  = rsvpMap[r.d] || null;
        MY_PICKS[r.d] = !!(r.id && pickedIds.has(r.id));
      } })) : null,
    openRound ? ok(loadRsvpCnt()) : null,
    ok(checkScribe()),
  ]);
  renderMe(); renderGames();
  if(view==='sched') renderSched();
  if(view==='me') renderMePage();
  if(needOnboard) kakaoOnboard();
}
async function loadRsvpCnt(){
  const rows = await API.allRsvp(openRound.d);
  rsvpCnt = { yes: rows.filter(r=>r.v==='yes').length, no: rows.filter(r=>r.v==='no').length };
  // 참석자 프로필 목록 — uid를 현재 닉네임으로 (탈퇴 등으로 못 찾으면 생략), 썸네일도 미리 로드
  rsvpYesList = rows.filter(r=>r.v==='yes')
    .map(r=>({uid:r.uid, nick:MEMBERS.find(m=>m.uid===r.uid)?.nick}))
    .filter(x=>x.nick);
  rsvpYesNames = rsvpYesList.map(x=>x.nick);
  try{ await loadPfps(rsvpYesList.map(x=>x.uid)); }catch(e){}
}
function myAttendance(){
  const names = myNames();
  return pastList().filter(p=>(p.people||[]).some(pIsMe)).length;
}
/* 회원번호는 가입 시점에 계정에 고정으로 박아둔 값(acc.no)을 그대로 보여준다.
   목록 순서로 계산하지 않는 이유 — 중간에 탈퇴자가 생기면 순서 계산값은 밀리지만 고정번호는 안 밀린다. */
function myMemberNo(){
  if(!acc || acc.no==null) return null;
  return String(acc.no).padStart(4,'0');
}
function renderMe(){
  const att = acc ? myAttendance() : 0;
  document.getElementById('meBox').innerHTML = acc
    ? `<span class="nk">${acc.nick}</span>${att?`<span class="attmini">${att}회</span>`:''}${isAdmin()?'<br><span class="adm">관리자</span>':acc.role==='staff'?'<br><span class="adm staff">운영진</span>':''}`
    : `<span class="nk">로그인 ›</span>`;
  document.getElementById('hsub').textContent =
    `지금 보유 게임 ${GAMES.filter(g=>g.have!==false).length}종 · 잡아둔 회차 ${upcoming.length}개`;
  document.getElementById('navMembers').style.display = isStaff() ? '' : 'none';
  renderBell();
}

/* ── 공지 대상 판정 — 내 상태만 보면 된다 ── */
/* 공지 시각 — 서버는 UTC 로 준다. 그 글자를 자르면 아홉 시간 어긋난다 (2026-08-23에 실제로 그랬다) */
function noticeWhen(ts){
  const p = TUNEL.kstParts(ts);
  return p ? `${p.month}-${p.day} ${p.hour}:${p.minute}` : '';
}
function noticeForMe(n){
  if(!acc) return false;
  if(n.to) return n.to === acc.uid;      // 개인·대상 지정 공지 (메인 허브 알림함과 같은 규칙)
  if(n.target==='all' || !n.target) return true;
  /* 옛 공지(대상만 적혀 있고 받는 사람이 없는 것) 호환 */
  if(n.target==='rsvp' && n.roundDate) return MY_RSVP[n.roundDate]==='yes';
  if(n.target==='picks' && n.roundDate) return !!MY_PICKS[n.roundDate];
  return false;
}
let MY_RSVP = {};    // {날짜:'yes'|'no'|null} 내 응답 캐시
let MY_PICKS = {};   // {날짜:bool} 내가 게임 골랐는지
function myNotices(){ return NOTICES.filter(noticeForMe); }
function unreadCount(){ return myNotices().filter(n=>!readIds.includes(n.id)).length; }
function renderBell(){
  const bell=document.getElementById('bell'), dot=document.getElementById('bellDot');
  if(!bell) return;
  if(!acc){ bell.style.display='none'; return; }
  bell.style.display='';
  const u=unreadCount();
  if(u>0){ dot.style.display=''; dot.textContent=u>9?'9+':u; }
  else dot.style.display='none';
}

/* ── 공지 보기 (참가자) ── */
function openNotices(){
  if(!acc){ askNick('login'); return; }
  const mine=myNotices();
  document.getElementById('modal').innerHTML=`
    <h2>공지 🔔</h2>
    ${isAdmin()?`<div class="mbtns" style="margin:12px 0 4px"><button class="mbtn" onclick="composeNotice()">＋ 공지 보내기</button></div>`:''}
    ${mine.length? mine.map(n=>{
      const unread=!readIds.includes(n.id);
      const tgt = n.target==='all'?'전체':(n.target==='rsvp'?`${fmt(n.roundDate)} 참석자`:`${fmt(n.roundDate)} 게임선택자`);
      return `<div class="ntc${unread?' unread':''}">
        <div class="nh"><b>${n.title}</b>${unread?'<span class="nu">NEW</span>':''}</div>
        <div class="nb2">${n.body.replace(/\n/g,'<br>')}</div>
        <div class="nm2">${tgt} · ${noticeWhen(n.at)}${isAdmin()?` · <span style="color:var(--red-lite);cursor:pointer" onclick="delNotice('${n.id}')">삭제</span>`:''}</div>
      </div>`;
    }).join('') : `<div class="empty" style="padding:30px">아직 온 공지가 없어요.</div>`}
    <button class="mclose" onclick="markAllRead();closeM()">닫기</button>`;
  document.getElementById('ov').style.display='flex';
}
async function markAllRead(){
  const ids=[...new Set([...readIds, ...myNotices().map(n=>n.id)])];
  readIds=ids; renderBell();
  if(acc){ try{ await API.setRead(acc.uid, ids); }catch(e){} }
}

/* ── 공지 보내기 (관리자) ── */
function composeNotice(){
  const opts = upcoming.map(r=>`<option value="${r.d}">${fmt(r.d)} (${r.dow}) ${r.place}</option>`).join('');
  document.getElementById('modal').innerHTML=`
    <h2>공지 보내기</h2>
    <div class="fld"><label>받는 사람</label>
      <select id="ncTarget" onchange="ncTargetChange()" style="width:100%;background:var(--surface2);border:1px solid var(--line);border-radius:5px;padding:11px 12px;font-size:13.5px">
        <option value="all">전체 회원</option>
        <option value="rsvp">특정 회차 — 참석한다고 한 사람</option>
        <option value="picks">특정 회차 — 게임 고른 사람</option>
      </select></div>
    <div class="fld" id="ncRoundWrap" style="display:none"><label>회차</label>
      <select id="ncRound" onchange="ncUpdateCount()" style="width:100%;background:var(--surface2);border:1px solid var(--line);border-radius:5px;padding:11px 12px;font-size:13.5px">${opts}</select>
      <div id="ncCount" style="font-size:11.5px;color:var(--sub);margin-top:6px"></div></div>
    <div class="fld"><label>제목</label><input id="ncTitle" placeholder="예: 8/15 장소 안내"></div>
    <div class="fld"><label>내용</label><textarea id="ncBody" placeholder="공지 내용을 적어주세요"></textarea></div>
    <div id="joinErr" style="display:none;color:var(--red-lite);font-size:12px;margin-top:9px"></div>
    <div class="mbtns"><button class="mbtn" id="authBtn" onclick="sendNotice()">보내기</button></div>
    <button class="mclose" onclick="openNotices()">← 공지 목록</button>`;
  document.getElementById('ov').style.display='flex';
}
function ncTargetChange(){
  const v=document.getElementById('ncTarget').value;
  document.getElementById('ncRoundWrap').style.display = v==='all'?'none':'';
  ncUpdateCount();
}
async function ncUpdateCount(){
  const el=document.getElementById('ncCount'); if(!el) return;
  const v=document.getElementById('ncTarget').value;
  if(v==='all'){ el.textContent=''; return; }
  const d=document.getElementById('ncRound').value;
  el.textContent = '세는 중…';
  try{   // 관리자만 여는 화면이라 전체 조회 가능 (일반 회원은 서버가 안 줌)
    const n = v==='rsvp'
      ? (await API.allRsvp(d)).filter(x=>x.v==='yes').length
      : (await API.allPicks(d)).length;
    el.textContent = `이 조건에 해당하는 회원 ${n}명`;
  }catch(e){ el.textContent=''; }
}
async function sendNotice(){
  const v=id=>document.getElementById(id).value;
  const target=v('ncTarget'), title=v('ncTitle').trim(), body=v('ncBody').trim();
  if(!title) return joinErr('제목을 적어주세요.');
  if(!body) return joinErr('내용을 적어주세요.');
  const roundDate = target==='all'? '' : v('ncRound');
  busy('보내는 중');
  try{
    await API.noticeCreate({ title, body, target, roundDate, by:acc.uid });
    NOTICES = await API.noticeList();
    closeM(); openNotices();
  }catch(e){ joinErr(e.message); }
}
async function delNotice(id){
  if(!confirm('이 공지를 지울까요?')) return;
  try{ await API.noticeDelete(id); NOTICES=NOTICES.filter(n=>n.id!==id); }catch(e){}
  openNotices();
}

/* ══ 카카오 로그인 (Supabase Auth) ══
   버튼 → 카카오 인가 → Supabase가 세션 처리 후 여기로 복귀 →
   bootSession이 기존 회원이면 자동 연결, 처음이면 가입 시트(kakaoOnboard)를 연다. */
function kakaoStart(){ API.kakaoAuthorize(); }

/* 카카오 인증은 됐지만 아직 회원이 아닌 사람 — 닉네임·톡방닉만 받으면 끝 */
function kakaoOnboard(){
  document.getElementById('modal').innerHTML = `
    <h2>거의 다 됐어요</h2>
    <div class="mdesc">카카오 인증 완료! 모임에서 쓸 정보만 정해주세요.<br>
      <span style="color:var(--sub);font-size:12px">카톡 이름·프로필은 가져오지 않아요. 닉네임은 여기서 정한 것만 씁니다.</span></div>
    <div class="fld"><label>닉네임 (한글만)</label>
      <input id="kkNick" placeholder="예: 투넬" autocomplete="off"></div>
    <div class="fld"><label>오픈톡방 닉네임</label>
      <input id="kkPay" placeholder="단톡방에서 쓰는 이름" autocomplete="off"></div>
    <div id="joinErr" style="display:none;color:var(--red-lite);font-size:12px;margin-top:9px;line-height:1.6"></div>
    <div class="notice" style="margin:13px 0 0">오픈톡방 닉네임은 단톡방의 누구인지 알아보고, 참가비 입금을 대조하려고 받아요.
      <b style="color:var(--red-lite)">모임장만 볼 수 있어요.</b></div>
    <div class="mbtns"><button class="mbtn" id="authBtn" onclick="kakaoJoin()">시작하기</button></div>
    <button class="mclose" onclick="closeM()">닫기</button>`;
  document.getElementById('ov').style.display='flex';
}
async function kakaoJoin(){
  const n=document.getElementById('kkNick').value.trim();
  const pn=document.getElementById('kkPay').value.trim();
  if(!n) return joinErr('닉네임을 적어주세요.');
  if(!NICK_RE.test(n)) return joinErr('닉네임은 한글만 쓸 수 있어요 (1~10자).');
  if(!pn) return joinErr('오픈톡방 닉네임을 적어주세요.');
  busy('가입 중');
  try{ await afterAuth(await API.signupMember(n, pn)); }
  catch(e){ joinErr(e.message); }
}

/* ══ 로그인 — 카카오 전용 ══ */
function askNick(tab){
  if(acc){ myAccountSheet(); return; }
  document.getElementById('modal').innerHTML = `
    <h2>첫밤 사망자 클럽</h2>
    <div class="mdesc">카카오로 3초면 들어와요. 톡방 하나로 모이는 모임이라
      계정도 카카오 하나로 통일했어요.</div>
    <button class="kakaobtn" onclick="kakaoStart()">
      <span class="ksym">TALK</span> 카카오로 시작하기
    </button>
    <div style="font-size:11px;color:var(--sub);margin-top:14px;line-height:1.7">
      카톡 이름·프로필·친구목록은 가져오지 않아요.<br>
      닉네임은 로그인 후에 따로 정합니다.</div>
    <button class="mclose" onclick="closeM()">닫기</button>`;
  document.getElementById('ov').style.display='flex';
}
function joinErr(m){
  const el=document.getElementById('joinErr'); if(!el) return;
  el.innerHTML=m; el.style.display='block';
  const b=document.getElementById('authBtn'); if(b){ b.disabled=false; b.textContent='시작하기'; }
}
function busy(t){ const b=document.getElementById('authBtn'); if(b){ b.disabled=true; b.innerHTML=`<span class="spin"></span> ${t}`; } }

const NICK_RE = /^[가-힣]{1,10}$/;   // 닉네임은 한글 1~10자만

async function afterAuth(a){
  acc = a;
  favs = fixNames(acc.favs);
  const anon = JSON.parse(localStorage.getItem('botc_picks_anon')||'[]');
  picks = openRound ? fixNames(await API.getMyPicks(openRound.d, acc.uid)) : [];
  myRsvp = openRound ? await API.getMyRsvp(openRound.d, acc.uid) : null;
  if(anon.length && openRound){                    // 로그인 전에 골라둔 게 있으면 합쳐서 올린다
    picks = [...new Set([...picks, ...anon])];
    try{ await API.setPicks(openRound.d, acc.uid, picks); }catch(e){}
    localStorage.removeItem('botc_picks_anon');
  }
  try{ MEMBERS = await API.list(); }catch(e){}
  try{ await computeFavCount(); }catch(e){}
  computeMyPlayed();
  renderMe(); closeM(); renderGames();
  if(view==='me') renderMePage(); if(view==='sched') renderSched();
}
async function logout(){
  try{ await API.logout(); }catch(e){}
  acc=null; favs=[]; picks=[];
  renderMe(); closeM(); renderGames();
  if(view==='me') renderMePage(); if(view==='sched') renderSched();
  if(view==='members') setView('games');
}
function myAccountSheet(){
  /* 계정 정보 변경(닉네임·사진)은 중앙역 마이페이지로 모았다 (2026-08-20).
     여기는 보기 + 로그아웃만 */
  const ph = PFP[acc.uid];
  document.getElementById('modal').innerHTML = `
    <h2>내 정보</h2>
    <div class="mdesc"><b style="color:var(--red-lite)">${acc.nick}</b> 으로 접속해 있어요.</div>
    <div style="display:flex;align-items:center;gap:12px;margin:12px 0 4px">
      <div class="av" style="width:48px;height:48px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;
           font-size:19px;font-weight:700;color:#fff;font-family:'Do Hyeon',sans-serif;
           ${ph?`background:url('${ph}') center/cover`:`background:${avColor(acc.uid)}`}">${ph?'':acc.nick[0]}</div>
      <div style="font-size:11.5px;color:var(--sub);line-height:1.6">닉네임·프로필 사진은<br>중앙역 마이페이지에서 바꿀 수 있어요</div>
    </div>
    <div style="margin-top:10px">
      <div class="mrow"><div class="k">닉네임</div><div>${acc.nick}</div></div>
      <div class="mrow"><div class="k">톡방 닉</div><div>${acc.payname||'—'}</div></div>
      <div class="mrow"><div class="k">가입일</div><div>${(acc.joined||'').replace(/-/g,'.')}</div></div>
      ${acc.aliases?.length?`<div class="mrow"><div class="k">옛 닉네임</div><div>${acc.aliases.join(', ')}</div></div>`:''}
    </div>
    <div class="mbtns"><a class="mbtn" href="../#me" style="text-decoration:none;text-align:center">중앙역에서 정보 바꾸기 ›</a></div>
    <button class="mclose" onclick="logout()">로그아웃</button>
    <button class="mclose" onclick="closeM()">닫기</button>`;
  document.getElementById('ov').style.display='flex';
}
/* ══ 뷰 전환 ══ */
function setView(v, skipHash){
  if(v==='members' && !isStaff()) v='games';
  view=v;
  document.querySelectorAll('.view').forEach(s=>s.classList.toggle('on', s.id==='v-'+v));
  document.querySelectorAll('nav .nb').forEach(b=>b.classList.toggle('on', b.dataset.v===v));
  window.scrollTo(0,0);
  if(v==='sched')   renderSched();
  if(v==='me')      renderMePage();
  if(v==='members') renderMembers();
  if(!skipHash && location.hash!=='#'+v) history.replaceState(null,'','#'+v);
}
window.addEventListener('hashchange',()=>{
  const v=(location.hash||'#games').slice(1);
  if(['games','sched','me','members'].includes(v)) setView(v,true);
});
