/* 첫밤 사망자 클럽 — 게임 도감 — 목록·검색·즐겨찾기
   index.html 한 파일에 있던 것을 2026-08-23에 나눴다.
   순수 스크립트라 전역이 그대로 이어진다 — index.html 의 실행 순서를 바꾸지 말 것. */
/* ══ 게임 도감 ══ */
document.getElementById('cattabs').innerHTML =
  CATS.map(c=>`<div class="ctab${c.k==='all'?' on':''}" data-k="${c.k}" onclick="setCat('${c.k}')">${c.label}</div>`).join('');
document.getElementById('crewChips').innerHTML =
  ['전체',4,5,6,7,8,9,10,11,12].map(v=>{const n=v==='전체'?0:v;
    return `<div class="chip${n===0?' on':''}" data-n="${n}" onclick="setCrew(${n})">${v==='전체'?'전체':v+'명'}</div>`;}).join('');
document.getElementById('q').addEventListener('input',e=>{
  q=e.target.value.trim();
  document.getElementById('qx').style.display=q?'block':'none';
  renderGames();
});
function clearQ(){q='';document.getElementById('q').value='';document.getElementById('qx').style.display='none';renderGames();}
/* 카테고리를 바꾸면 정렬 기본값도 맞춰준다 — 전체는 정리된 기본순, 특정 장르는 그 장르 인기순.
   그 카테고리 안에서 정렬을 직접 바꾸면 그대로 유지되고, 다른 카테고리로 옮기면 다시 기본값. */
function setCat(k){
  cat=k;
  document.querySelectorAll('.ctab').forEach(t=>t.classList.toggle('on',t.dataset.k===k));
  document.getElementById('sort').value = (k==='all') ? 'cat' : 'popular';
  renderGames();
}
function setCrew(n){crew=n;document.querySelectorAll('.chip').forEach(c=>c.classList.toggle('on',+c.dataset.n===n));renderGames();}

const fits = g => !crew || (crew>=g.min && (g.max===null||crew<=g.max));
const peopleTxt = g => g.max===null?`${g.min}명 이상`:(g.min===g.max?`${g.min}명`:`${g.min}~${g.max}명`);
const esc = s => s.replace(/'/g,"\\'");
const byCat = (a,b)=>{const o=c=>CATS.findIndex(x=>x.k===c);return o(a.cat)-o(b.cat);};

/* 즐겨찾기 집계 — 회원들의 favs를 모아 게임별 담은 사람 수. MEMBERS가 갱신될 때 다시 계산 */
/* 내가 해본 게임 — 참석한 회차의 기록에서 계산. 어디에도 저장하지 않는다 */
let MYPLAYED = new Set();
function computeMyPlayed(){
  MYPLAYED = new Set();
  if(!acc) return;
  pastList().filter(p=>(p.people||[]).some(pIsMe))
    .forEach(p=>(p.played||[]).forEach(n=>MYPLAYED.add(fixName(n))));
}
let FAVCOUNT = {};
async function computeFavCount(){
  try{ FAVCOUNT = await API.favCounts(); }catch(e){}
}
function favCount(n){ return FAVCOUNT[n]||0; }

function gameCard(g, mode){
  const i=GAMES.indexOf(g);
  const on = mode==='pick' ? picks.includes(g.n) : favs.includes(g.n);
  const fn = mode==='pick' ? `togPick('${esc(g.n)}')` : `togFav('${esc(g.n)}')`;
  const fc = mode!=='pick' ? favCount(g.n) : 0;
  const done = mode!=='pick' && MYPLAYED.has(g.n);
  return `<div class="game${on?' fav':''}${done?' played':''}${mode!=='pick'&&crew&&!fits(g)?' dim':''}">
    <div class="info" onclick="openM(${i})">
      <div class="nm"><span class="star${on?' on':''}" onclick="event.stopPropagation();${fn}">${on?'★':'☆'}</span>${fc?`<span class="favn">${fc}</span>`:''}${g.n}</div>
      <div class="meta"><b>${peopleTxt(g)}</b> · ${g.t}분</div>
      <div class="desc">${g.d}</div>
      <div class="badges">
        <span class="bd lv${g.lv}">${g.lv}</span>
        ${(g.max===null||g.max>=12)?'<span class="bd big">12명 OK</span>':''}
        ${g.out?'<span class="bd out">탈락 있음</span>':'<span class="bd safe">아무도 안 죽음</span>'}
        ${g.host?'<span class="bd host">진행자 필요</span>':''}
        ${canSeeOwner(g)?`<span class="bd">${ownerName(g)||'소유자 미지정'}</span>`:''}
      </div>
    </div>
    <div class="gright">
      <img class="thumb" src="${cover(g)}" alt="" loading="lazy"
           onerror="this.onerror=null;this.src=fallbackCover('${esc(g.n)}','${g.cat}')">
    </div>
    ${done?'<div class="played-seal">해봤어요</div>':''}
  </div>`;
}

/* 게임 커버 — games.js 에 img 가 있으면 그 사진, 없으면 이름으로 만든 커버를 쓴다.
   (사진 넣는 법은 img/README.md 참고) */
const CATCOLOR = { mafia:'#e8323c', party:'#e0a13a', quick:'#3aa6e0', strategy:'#7a5ce0', coop:'#2fae72' };
function fallbackCover(name, cat){
  const c = CATCOLOR[cat] || '#4a4a57';
  const t = (name||'?').replace(/[\s()·]/g,'').slice(0,2);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128">
    <rect width="128" height="128" fill="#26262f"/>
    <rect width="128" height="6" fill="${c}"/>
    <text x="64" y="78" font-family="sans-serif" font-size="42" font-weight="700"
      fill="${c}" text-anchor="middle">${t}</text></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
function cover(g){ return g.img || fallbackCover(g.n, g.cat); }
function renderGames(){
  let list=GAMES.filter(g=>g.have!==false);
  if(cat!=='all') list=list.filter(g=>g.cat===cat);
  if(q){const s=q.toLowerCase();list=list.filter(g=>(g.n+g.d+g.r+g.lv+g.own+(isStaff()?ownerName(g):'')).toLowerCase().includes(s));}
  const sort=document.getElementById('sort').value;
  if(sort==='popular') list.sort((a,b)=>favCount(b.n)-favCount(a.n)||a.n.localeCompare(b.n,'ko'));
  else if(sort==='people') list.sort((a,b)=>(b.max===null?99:b.max)-(a.max===null?99:a.max));
  else if(sort==='short') list.sort((a,b)=>a.t-b.t);
  else if(sort==='name') list.sort((a,b)=>a.n.localeCompare(b.n,'ko'));
  else list.sort((a,b)=>byCat(a,b)||(b.max===null?99:b.max)-(a.max===null?99:a.max));
  if(crew) list.sort((a,b)=>(fits(b)?1:0)-(fits(a)?1:0));

  const ok=crew?list.filter(fits).length:list.length;
  document.getElementById('cnt').textContent = crew?`${crew}명 가능 ${ok}개 / 전체 ${list.length}개`:`${list.length}개`;
  document.getElementById('crewMsg').innerHTML = crew
    ? `<b>${crew}명</b>이면 <b>${ok}개</b>가 돌아가요. 나머지는 흐리게 표시됩니다`
    : `인원을 고르면 그 인원으로 <b>돌아가는 게임</b>만 진하게 보여드려요`;
  let html = list.length
    ? list.map(g=>gameCard(g,'fav')).join('')
    : `<div class="empty">조건에 맞는 게임이 없어요.<br>인원을 바꾸거나 검색어를 지워보세요.</div>`;

  // 검색 중이면 미보유 DB에서도 찾아 붙여준다 (인기 순위 기반 참고 데이터)
  if(q && typeof GAMES_DB!=='undefined'){
    const sq=q.toLowerCase();
    const db=GAMES_DB.filter(g=>(g.n+g.eng).toLowerCase().includes(sq)).slice(0,10);
    if(db.length){
      html += `<div class="label" style="margin:20px 4px 9px">미보유 · 참고 DB에서 ${db.length}개</div>`
        + db.map(g=>dbCard(g)).join('');
    }
  }
  document.getElementById('glist').innerHTML = html;
}

/* 미보유 DB 카드 — 흐리게, 별 없이 */
function dbCard(g){
  const i=GAMES_DB.indexOf(g);
  return `<div class="game dim" style="opacity:.62">
    <div class="info" onclick="openDbM(${i})">
      <div class="nm">${g.n}</div>
      <div class="meta"><b>${g.players||'?'}명</b> · ${g.minutes||'?'}분 · ⭐ ${g.rate}</div>
      <div class="desc">${g.eng}${g.year?` (${g.year})`:''}</div>
      <div class="badges">
        <span class="bd">미보유</span>
        <span class="bd">보드라이프 ${g.rank}위</span>
        ${g.weight?`<span class="bd">난이도 ${g.weight}</span>`:''}
      </div>
    </div>
  </div>`;
}
function openDbM(i){
  const g=GAMES_DB[i];
  document.getElementById('modal').innerHTML=`
    <h2>${g.n}</h2>
    <div class="mdesc">${g.eng}${g.year?` (${g.year})`:''}</div>
    <div style="margin-top:14px">
      <div class="mrow"><div class="k">인원</div><div>${g.players||'?'}명</div></div>
      <div class="mrow"><div class="k">시간</div><div>약 ${g.minutes||'?'}분</div></div>
      ${g.age?`<div class="mrow"><div class="k">연령</div><div>${g.age}세 이상</div></div>`:''}
      <div class="mrow"><div class="k">평점</div><div>⭐ ${g.rate} / 10 · 난이도 ${g.weight??'?'} · 종합 ${g.rank}위<br><span style="color:var(--sub);font-size:11px">보드라이프 유저 평가 기준</span></div></div>
    </div>
    <div class="notice" style="margin:14px 0 0">클럽 보유 게임은 아니에요.
      가져오셔서 함께 하면 지난 모임 기록에 남길 수 있습니다.</div>
    <div style="display:flex;gap:6px;margin-top:12px">
      <a class="mclose" style="flex:1;margin:0;text-decoration:none;text-align:center" href="${g.url}" target="_blank" rel="noopener">보드라이프에서 보기</a>
      ${g.bgg?`<a class="mclose" style="flex:1;margin:0;text-decoration:none;text-align:center" href="${g.bgg}" target="_blank" rel="noopener">BGG에서 보기</a>`:''}
    </div>
    <button class="mclose" onclick="closeM()">닫기</button>`;
  document.getElementById('ov').style.display='flex';
}
/* 확인 창 — 게임 고르기 시트 위에도 떠야 해서 모달과 별도 레이어를 쓴다 */
let askYes = null;
function ask(html, onYes){
  askYes = onYes;
  document.getElementById('askBox').innerHTML = `
    <div class="q">${html}</div>
    <div class="btns">
      <button class="no" onclick="closeAsk()">아니요</button>
      <button class="yes" onclick="okAsk()">확인</button>
    </div>`;
  document.getElementById('ask').style.display='flex';
}
function closeAsk(){ document.getElementById('ask').style.display='none'; askYes=null; }
function okAsk(){ const f=askYes; closeAsk(); if(f) f(); }

function togFav(n){
  if(!acc){ askNick('login'); return; }   // 서버에 담아야 인기순 집계가 되므로 로그인 필요
  const on = favs.includes(n);
  ask(on ? `<b>${n}</b><br>즐겨찾기를 해제할까요?`
         : `<b>${n}</b><br>즐겨찾기에 추가할까요?`,
      async ()=>{
        favs = on ? favs.filter(f=>f!==n) : [...favs,n];
        // 내 MEMBERS 항목도 바로 갱신해서 집계·별 개수가 즉시 반영되게
        const me = MEMBERS.find(m=>m.uid===acc.uid); if(me) me.favs = favs.slice();
        acc.favs = favs.slice();
        computeFavCount();
        renderGames();
        if(view==='me') renderMePage();
        try{ await API.setFavs(acc.uid, favs); }
        catch(e){ /* 저장 실패해도 화면은 유지, 다음 새로고침 때 서버값으로 맞춰짐 */ }
      });
}
