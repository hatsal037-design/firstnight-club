/* 첫밤 사망자 클럽 — 게임 상세 창 — 도감에서 게임을 눌렀을 때
   index.html 한 파일에 있던 것을 2026-08-23에 나눴다.
   순수 스크립트라 전역이 그대로 이어진다 — index.html 의 실행 순서를 바꾸지 말 것. */
/* ══ 게임 상세 ══ */
function openM(i){
  const g=GAMES[i];
  const yt='https://www.youtube.com/results?search_query='+encodeURIComponent(g.n+' 보드게임 룰');
  const inPick = !!document.getElementById('plist');
  const on = inPick ? picks.includes(g.n) : favs.includes(g.n);
  const fn = inPick ? `togPick('${esc(g.n)}')` : `togFav('${esc(g.n)}')`;
  document.getElementById('modal').innerHTML=`
    <div style="display:flex;gap:13px;align-items:flex-start">
      <img src="${cover(g)}" alt="" style="width:78px;height:78px;border-radius:8px;object-fit:cover;
           flex:none;background:var(--surface2);border:1px solid var(--line)">
      <div style="flex:1;min-width:0">
        <h2>${g.n}</h2>
        <div class="mdesc" style="margin-top:7px">${g.d}</div>
      </div>
    </div>
    <div style="margin-top:14px">
      <div class="mrow"><div class="k">인원</div><div>${peopleTxt(g)}${(g.max===null||g.max>=12)?' · 12명 회차 가능':''}</div></div>
      <div class="mrow"><div class="k">시간</div><div>약 ${g.t}분</div></div>
      <div class="mrow"><div class="k">난이도</div><div>${g.lv}</div></div>
      <div class="mrow"><div class="k">탈락</div><div>${g.out?'있음 — 죽으면 관전':'없음 — 끝까지 참여'}</div></div>
      <div class="mrow"><div class="k">진행자</div><div>${g.host?'필요':'필요 없음'}</div></div>
      ${g.bl?`<div class="mrow"><div class="k">평점</div><div>⭐ ${g.bl.rate} / 10 · 난이도 ${g.bl.weight}${g.bl.rank?` · 종합 ${g.bl.rank}위`:''}<br><span style="color:var(--sub);font-size:11px">보드라이프 유저 평가 기준</span></div></div>`:''}
      ${canSeeOwner(g)?`<div class="mrow"><div class="k">소유자</div><div>${ownerName(g)||'미지정'}${isStaff()?` <span style="color:var(--red-lite);cursor:pointer;font-size:11.5px" onclick="editOwner(${i})">· 변경</span>`:''}</div></div>`
        : (isStaff()?'':'') }
      ${isStaff()&&!canSeeOwner(g)?`<div class="mrow"><div class="k">소유자</div><div><span style="color:var(--red-lite);cursor:pointer" onclick="editOwner(${i})">지정하기</span></div></div>`:''}
    </div>
    <div class="mrule"><b style="color:var(--ink)">어떻게 하는 게임인가요</b><br>${g.r}</div>
    ${g.bl?`<div style="display:flex;gap:6px;margin-top:10px">
      <a class="mclose" style="flex:1;margin:0;text-decoration:none;text-align:center" href="${g.bl.url}" target="_blank" rel="noopener">보드라이프에서 보기</a>
      ${g.bl.bgg?`<a class="mclose" style="flex:1;margin:0;text-decoration:none;text-align:center" href="${g.bl.bgg}" target="_blank" rel="noopener">BGG에서 보기</a>`:''}
    </div>`:''}
    <div class="mbtns">
      <button class="mbtn" onclick="openRules(${i})">📖 룰 자세히 보기${g.rules?.length?'':' (준비 중)'}</button>
      <button class="mbtn ghost" onclick="${fn};closeM()">${on?'★ 해제':(inPick?'☆ 이거 하고 싶어요':'☆ 관심 표시')}</button>
    </div>
    <a class="mclose" style="display:block;text-align:center;text-decoration:none" href="${yt}" target="_blank" rel="noopener">📺 유튜브에서 설명 영상 찾기</a>
    <button class="mclose" onclick="closeM()">닫기</button>`;
  document.getElementById('ov').style.display='flex';
}
/* ── 게임 소유자 지정 (관리자·운영진) ── */
function editOwner(i){
  if(!isStaff()) return;
  const g=GAMES[i];
  const cur=ownerUid(g);
  const curName = cur ? (MEMBERS.find(m=>m.uid===cur)?.nick||'') : '';
  document.getElementById('modal').innerHTML=`
    <h2>${g.n} 소유자</h2>
    <div class="mdesc">이 게임을 가진 회원을 지정해요. <b style="color:var(--red-lite)">@</b>로 회원을 찾아 지정하면,
      그 회원과 관리자에게만 소유 표시가 보입니다. 닉네임이 바뀌어도 따라가요.</div>
    <div class="fld"><label>현재 소유자</label>
      <div class="chips2" id="ownChip">${cur?`<span class="ch m">@${curName}<b onclick="ownClear()">✕</b></span>`
        : (g.own?`<span class="ch">${g.own} <span style="color:var(--sub);font-size:10.5px">(씨앗 정보)</span></span>`:'<span style="color:var(--sub);font-size:12.5px">미지정</span>')}</div>
    </div>
    <div class="fld"><label>@로 회원 지정</label>
      <div style="position:relative">
        <input id="ownIn" placeholder="@닉네임 입력" autocomplete="off">
        <div class="sug" id="ownSug" style="display:none"></div>
      </div></div>
    <div id="joinErr" style="display:none;color:var(--red-lite);font-size:12px;margin-top:9px"></div>
    <div class="mbtns"><button class="mbtn ghost" onclick="openM(${i})">← 게임으로</button></div>
    <button class="mclose" onclick="closeM()">닫기</button>`;
  document.getElementById('ov').style.display='flex';
  const inp=document.getElementById('ownIn');
  inp.addEventListener('input', ()=>ownSuggest(i));
  inp.addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); ownSuggest(i); }});
}
function ownSuggest(i){
  const inp=document.getElementById('ownIn'), sug=document.getElementById('ownSug');
  let v=inp.value.trim(); if(v.startsWith('@')) v=v.slice(1);
  if(!v){ sug.style.display='none'; return; }
  const hits=MEMBERS.filter(m=>m.nick.includes(v)).slice(0,6);
  sug.innerHTML = hits.length
    ? hits.map(m=>`<div class="si" onclick="ownPick(${i},'${m.uid}')">@${m.nick}<span>${(m.joined||'').slice(2)}</span></div>`).join('')
    : `<div class="si none">'${v}' 회원이 없어요</div>`;
  sug.style.display='block';
}
async function ownPick(i, uid){
  const g=GAMES[i];
  try{ await API.setOwner(g.n, uid); OWNERS[g.n]=uid; }catch(e){ alert('저장 실패: '+e.message); return; }
  editOwner(i);
}
async function ownClear(){
  // 현재 열린 게임 찾기: 제목으로
  const nm=document.querySelector('#modal h2').textContent.replace(' 소유자','');
  const i=GAMES.findIndex(g=>g.n===nm);
  try{ await API.setOwner(nm, null); delete OWNERS[nm]; }catch(e){}
  if(i>=0) editOwner(i);
}

/* 룰 자세히 보기 — games.js 의 rules 배열을 순서대로 그린다.
   글·번호목록·사진을 섞을 수 있고, 아직 없으면 준비 중 화면이 뜬다. */
function openRules(i){
  const g = GAMES[i];
  const yt='https://www.youtube.com/results?search_query='+encodeURIComponent(g.n+' 보드게임 룰');
  const body = (g.rules||[]).map(b=>{
    if(b.img) return `<div class="rb">${b.h?`<h3>${b.h}</h3>`:''}
      <img src="${b.img}" alt="" loading="lazy">${b.cap?`<div class="cap">${b.cap}</div>`:''}</div>`;
    return `<div class="rb">
      ${b.h?`<h3>${b.h}</h3>`:''}
      ${b.p?`<p>${b.p}</p>`:''}
      ${b.list?`<ol>${b.list.map(x=>`<li>${x}</li>`).join('')}</ol>`:''}
    </div>`;
  }).join('');

  document.getElementById('modal').innerHTML=`
    <div style="display:flex;gap:13px;align-items:center">
      <img src="${cover(g)}" alt="" style="width:56px;height:56px;border-radius:8px;object-fit:cover;
           flex:none;background:var(--surface2);border:1px solid var(--line)">
      <div><h2>${g.n}</h2>
        <div style="font-size:12px;color:var(--sub);margin-top:4px">${peopleTxt(g)} · ${g.t}분 · ${g.lv}</div></div>
    </div>
    <div class="mrule" style="margin-top:14px">${g.r}</div>
    ${body || `<div class="empty" style="padding:34px 12px">
        아직 룰이 정리되지 않았어요.<br>정리되면 여기에 글과 사진으로 올라옵니다.<br><br>
        <span style="font-size:11.5px">그전까지는 아래 영상으로 봐주세요.</span></div>`}
    <div class="mbtns" style="margin-top:20px">
      <a class="mbtn ghost" href="${yt}" target="_blank" rel="noopener">📺 영상으로 보기</a>
      <button class="mbtn" onclick="openM(${i})">← 게임 정보로</button>
    </div>
    <button class="mclose" onclick="closeM()">닫기</button>`;
  document.getElementById('ov').style.display='flex';
  document.querySelector('.modal').scrollTop = 0;
}

function closeM(){
  document.getElementById('ov').style.display='none';
  if(view==='me') renderMePage();
  else if(view==='sched') renderSched();
  else if(view==='members') renderMembers();
  else renderGames();
}
