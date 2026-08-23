/* 첫밤 사망자 클럽 — 시작 — 첫 그림·부팅·티켓 공유 링크. 반드시 맨 나중에 실행된다
   index.html 한 파일에 있던 것을 2026-08-23에 나눴다.
   순수 스크립트라 전역이 그대로 이어진다 — index.html 의 실행 순서를 바꾸지 말 것. */
/* ══ 시작 ══ */
renderMe(); renderGames();
{
  const v=(location.hash||'#games').slice(1);
  if(PENDING_APPLY) setView('sched',true);
  else if(['sched','me','members'].includes(v)) setView(v,true);
}
bootSession();
/* 카카오 인가 복귀(?code=)는 supabase-js가 알아서 세션으로 바꿔준다 — 별도 처리 불필요 */

/* ══ 티켓 공유 / 바로 신청 링크 ══
   https://tunel.kr/1ndclub/?apply=2026-08-29  ← 이 주소로 들어오면
   정모일정 탭 → 그 회차 상세 펼침 → 신청 팝업까지 한 번에 열린다.
   카톡에 붙이면 미리보기(og)도 함께 뜬다. */
function openApplyByDate(d){
  const r = (ROUNDS||[]).find(x=>x.d===d);
  if(!r) return false;
  const tk = [...document.querySelectorAll('#schedList [onclick*="toggleDetail"]')]
    .find(e=>e.textContent.includes(fmtDate(d)) || e.textContent.includes(d.slice(5).replace('-','/').replace(/^0/,'')));
  if(tk){ const box = (()=>{ let x=tk.nextElementSibling; while(x && !x.classList.contains('rdx')) x=x.nextElementSibling; return x; })();
    if(box && getComputedStyle(box).display==='none') toggleDetail(tk);
    tk.scrollIntoView({block:'center', behavior:'smooth'}); }
  if(r.st==='open' && r.id && window.TUNEL?.signupOpen){ setTimeout(()=>TUNEL.signupOpen(r.id), 400); return true; }
  return true;
}
function fmtDate(d){ const [y,m,dd]=d.split('-'); return `${+m}/${+dd}`; }
/* 티켓 공유 — 공유 시트가 되면 그걸로, 안 되면 링크 복사 */
async function shareTicket(d){
  const r = (ROUNDS||[]).find(x=>x.d===d); if(!r) return;
  const url = `https://tunel.kr/1ndclub/?apply=${d}`;
  const title = (r.name || `${r.r?r.r+'회차 ':''}정모`) + ' · ' + lineInfo().line_name;
  const text = [`${title}`,
    `${fmtDate(d)}(${r.dow}) ${r.s}~${r.e} · ${r.place}`,
    r.fee ? `참가비 ${r.fee}` : '', '', url].filter(Boolean).join('\n');
  try{
    if(navigator.share){ await navigator.share({ title, text: text.replace(url,'').trim(), url }); return; }
  }catch(e){ if(e && e.name==='AbortError') return; }
  try{
    await navigator.clipboard.writeText(text);
    ask('링크를 복사했어요.<br><span style="font-size:12px;color:var(--sub)">단톡방에 붙여넣으면 눌러서 바로 신청할 수 있어요.</span>', null);
  }catch(e){
    ask(`아래 주소를 복사해서 쓰세요.<br><span style="font-size:12px;color:var(--sub);word-break:break-all">${url}</span>`, null);
  }
}

/* 주소에 ?rules=게임이름 을 붙이면 그 게임 룰이 바로 열린다.
   "달무티 룰 여기서 봐" 하고 링크만 던지면 되게. */
{
  const want = new URLSearchParams(location.search).get('rules');
  if(want){
    const i = GAMES.findIndex(g=>g.n===want);
    if(i>=0) openRules(i);
  }
}
