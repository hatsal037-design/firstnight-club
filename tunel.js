/* ══════════════════════════════════════════════════════════════
   투넬 공통 모듈 — 허브와 모든 노선 페이지가 같은 파일을 부른다

   원칙: 같은 데이터, 두 개의 창
     · 통합홈  TUNEL.meetings()            — 필터 없이 전부
     · 노선 안  TUNEL.meetings({line:'botc'}) — 그 노선만

   새 노선을 열 때 이 파일은 건드리지 않는다.
   lines 테이블에 행을 넣고, 티켓 스킨 CSS(.tkt.<skin>)만 추가하면 된다.
   설계 문서: 브랜드/통합구조_설계.md
   ══════════════════════════════════════════════════════════════ */
(function(global){
'use strict';

const URL  = 'https://yguvfogtzazoawtclqvf.supabase.co';
const ANON = 'sb_publishable_KeezD9hmEnxSTEWA_w8x-A_Tgk3roUf';

let _sb = null;
function sb(){
  if(!_sb){
    /* 페이지가 자기 클라이언트를 이미 만들었으면 그걸 쓴다 (window.__TNL_SB) —
       클라이언트가 둘이면 로그인이 꼬인다 (2026-08-20 로그인 문제의 원인 중 하나) */
    if(global.__TNL_SB){ _sb = global.__TNL_SB; return _sb; }
    if(!global.supabase) throw new Error('supabase-js 를 먼저 불러와야 합니다');
    _sb = global.supabase.createClient(URL, ANON);
  }
  return _sb;
}

/* 오늘 00:00 — 날짜 비교 기준 */
function today(){ const t = new Date(); t.setHours(0,0,0,0); return t; }
const isPast = m => m.status === 'done' || m.status === 'cancelled'
                 || new Date(m.d) < today();

/* ── 캐시 ── */
let _lines = null, _meP = null;

const TUNEL = {

  sb,

  /* 노선 마스터. 한 번만 읽고 캐시 */
  async lines(){
    if(_lines) return _lines;
    const { data, error } = await sb().from('lines').select('*').order('sort');
    if(error) throw error;
    _lines = data || [];
    return _lines;
  },

  async line(id){
    return (await TUNEL.lines()).find(l => l.id === id) || null;
  },

  /* 로그인 회원. 로그인 전이면 null */
  me(){
    /* 약속을 캐시한다 — 결과를 캐시하면 동시에 부르는 두 번째 화면이
       아직 비어 있는 값을 받아 로그아웃으로 그려진다 (2026-08-20에 실제로 겪음) */
    if(!_meP) _meP = (async () => {
      try{
        const { data } = await sb().auth.getSession();
        if(!data?.session) return null;
        const { data: mid } = await sb().rpc('claim_my_account');
        if(!mid) return null;
        const { data: m } = await sb().from('members')
          .select('id,nick,no,joined,role,is_admin').eq('id', mid).single();
        return m || null;
      }catch(e){ return null; }
    })();
    return _meP;
  },

  /* 회차 조회
       line   생략하면 전 노선
       status 'upcoming' | 'past' | 실제 status 값
       from/to 'YYYY-MM-DD'                                */
  async meetings(opt = {}){
    let q = sb().from('v_meetings').select('*');
    if(opt.line) q = q.eq('line', opt.line);
    if(opt.from) q = q.gte('d', opt.from);
    if(opt.to)   q = q.lte('d', opt.to);
    if(opt.status && !['upcoming','past'].includes(opt.status))
      q = q.eq('status', opt.status);
    const { data, error } = await q.order('d', { ascending:false });
    if(error) throw error;
    let rows = data || [];
    if(opt.status === 'upcoming') rows = rows.filter(m => !isPast(m)).reverse();
    if(opt.status === 'past')     rows = rows.filter(isPast);
    return rows;
  },

  /* 내 참석 기록. line 생략하면 전 노선 */
  async myActivity(opt = {}){
    const me = await TUNEL.me();
    if(!me) return [];
    let q = sb().from('v_attendance').select('*').eq('member_id', me.id);
    if(opt.line) q = q.eq('line', opt.line);
    const { data, error } = await q.order('d', { ascending:false });
    if(error) throw error;
    return data || [];
  },

  /* 노선별 참석 횟수 요약 (서버 함수) */
  async myActivitySummary(){
    const me = await TUNEL.me();
    if(!me) return [];
    const { data, error } = await sb().rpc('my_activity_summary');
    if(error) throw error;
    return data || [];
  },

  /* 어떤 회차의 참석자 — 회원끼리 서로 보인다 */
  async attendees(meetingId){
    const { data, error } = await sb().from('v_attendance')
      .select('member_id,guest_name,who,role').eq('meeting_id', meetingId);
    if(error) throw error;
    return data || [];
  },

  /* ── 화면 조각 ────────────────────────────────────────── */

  isPast,

  /* 회차 이름 — 없으면 회차 번호로 지어준다 */
  title(m){
    if(m.name) return m.name;
    if(m.kind === 'flash') return '번개';
    return m.r ? `${m.r}회차 정모` : '정모';
  },

  /* 상태 라벨 */
  statusLabel(m){
    if(m.status === 'cancelled') return '취소';
    if(isPast(m)) return 'USED';
    if(m.status === 'open') return '모집중';
    return '예정';
  },

  /* 통합 일정 티켓 한 장. 노선 스킨은 lines.skin 이 정한다 */
  ticket(m, opt = {}){
    const past = opt.past ?? isPast(m);
    const big  = !past && m.status === 'open';   // 모집중은 규격 일반(150) 크기로
    const tbd  = m.data?.tbd === true;
    const when = tbd ? '날짜 조율 중'
      : `${+m.d.slice(5,7)}/${+m.d.slice(8)} <small style="font-size:12px">(${m.dow||''})</small>`;
    const time = tbd ? '' : (m.s ? m.s + (m.e ? '~' + m.e : '') : '');
    const href = opt.href ?? m.line_path;
    const place = m.place || '';
    const att = past && m.att_count ? ` · ${m.att_count}명` : '';
    return `
    <a class="tkt ${m.line_skin}${past ? ' past' : ''}${big ? ' lg' : ''}" href="${href}">
      <span class="tbody">
        <span class="tno">PLATFORM ${String(m.line_no).padStart(2,'0')}${past ? ' · USED' : ''}</span>
        <span class="trow">
          <span class="td">${when}</span>
          <span class="tt">${time}</span>
          <span class="tst">${TUNEL.statusLabel(m)}</span>
        </span>
        <span class="tp">${TUNEL.title(m)} · ${place}${att}</span>
      </span>
      <span class="tstub"><span>TÜNEL</span></span>
    </a>`;
  },

  /* 날짜 표기 2026-08-29 → 8.29 (토) */
  fmt(d, dow){
    if(!d) return '';
    const s = `${+d.slice(5,7)}.${+d.slice(8)}`;
    return dow ? `${s} (${dow})` : s;
  },

  /* ── 확정규격 티켓 — 모든 페이지가 이 한 곳에서 같은 티켓을 띄운다 ──
     원본 시안: 시안/티켓_확정규격.html · 규칙: 브랜드/티켓_현황.md
     (판지는 img+cover · 절취선 258 · 스터브 100 · 좌여백 20 · 정보란 222)
     일반(358×150)만 우선 구현. 슬림·이벤트는 필요해질 때 여기에 더한다.

       TUNEL.boardingTicket(m, {
         card    판지 이미지 경로 (생략하면 m.line_path + 'tk_card.jpg')
         stub    스터브 안 HTML (모집중 홀로그램 · 참석 왁스 등 페이지 몫)
         href    있으면 <a> 링크 티켓
         onclick 있으면 <div> + onclick (첫밤 아코디언용)
       })                                                          */
  boardingTicket(m, opt = {}){
    TUNEL._ticketCSS();
    const sm    = opt.size === 'sm';      // 슬림 358×100 — 예정 회차용 (당일 정보 숨김)
    const tbd   = m.data?.tbd === true;
    const dowEN = {'월':'MON','화':'TUE','수':'WED','목':'THU','금':'FRI','토':'SAT','일':'SUN'}[m.dow] || m.dow || '';
    const card  = opt.card ?? `${m.line_path || ''}tk_card.jpg?v2`;
    const cls   = `btk${sm ? ' sm' : ''}`;
    const tag   = opt.href ? `<a class="${cls}" href="${opt.href}">`
                : `<div class="${cls}"${opt.onclick ? ` onclick="${opt.onclick}"` : ''}>`;
    const body  = sm
      ? `<div class="nm">${TUNEL.title(m)} · ${tbd ? '날짜 조율 중' : TUNEL.fmt(m.d, m.dow)}</div>`
      : `<div class="nm">${TUNEL.title(m)} · ${m.line_name || ''}</div>
        <div class="g">
          <div><i>DATE</i><b>${tbd ? '미정' : `${+m.d.slice(5,7)}/${+m.d.slice(8)} ${dowEN}`}</b></div>
          <div><i>TIME</i><b>${m.s || ''}</b></div>
          <div><i>PLACE</i><b>${m.place || ''}</b></div>
        </div>`;
    return `${tag}
      <img src="${card}" alt="">
      <div class="perf"></div>
      <div class="ov">
        <div class="lbl">TÜNEL BOARDING PASS</div>
        <div class="route"><b>일상</b><span class="d"></span><b style="color:#E8756A">${m.line_short || '첫밤'}</b></div>
        ${body}
        <div class="stub">${opt.stub || ''}</div>
      </div>
    ${opt.href ? '</a>' : '</div>'}`;
  },

  /* 티켓 상세 아코디언 — 주소·메모·참가비·2차 + 지도·캘린더.
     티켓의 onclick 에 TUNEL.ticketToggle(this) 를 걸고,
     티켓(과 신청 바) 뒤에 이 HTML 을 붙이면 된다 */
  ticketDetail(m, opt = {}){
    const mapq = m.data?.mapq || m.addr || m.place || '';
    const cal = (() => {
      if(!m.d || !m.s) return '';
      const st = t => m.d.replace(/-/g,'') + 'T' + String(t||'').replace(':','') + '00';
      const p = new URLSearchParams({ action:'TEMPLATE',
        text:`${m.line_name || ''} ${TUNEL.title(m)}`.trim(),
        dates:`${st(m.s)}/${st(m.e || m.s)}`,
        details:[m.place, m.fee ? `참가비 ${m.fee}` : ''].filter(Boolean).join('\n'),
        location:m.addr || m.place || '', ctz:'Asia/Seoul' });
      return 'https://calendar.google.com/calendar/render?' + p.toString();
    })();
    return `<div class="tnlx">
      ${m.addr ? `<div class="xr">📍 ${m.addr}</div>` : ''}
      ${m.memo ? `<div class="xn">${m.memo}</div>` : ''}
      ${m.fee ? `<div class="xr">참가비 ${m.fee}</div>` : ''}
      ${m.after ? `<div class="xr">2차 · ${m.after} (자율)</div>` : ''}
      <div class="xb">
        ${mapq ? `<a href="https://map.naver.com/p/search/${encodeURIComponent(mapq)}" target="_blank" rel="noopener">📍 지도</a>` : ''}
        ${cal ? `<a href="${cal}" target="_blank" rel="noopener">📅 캘린더에 저장</a>` : ''}
        ${opt.more ? `<a href="${opt.more}">${opt.moreLabel || '노선 페이지'} ›</a>` : ''}
      </div>
    </div>`;
  },

  /* 티켓을 누르면 바로 다음의 .tnlx 를 여닫는다 (신청 바는 건너뛴다) */
  ticketToggle(el){
    let x = el.nextElementSibling;
    while(x && !x.classList.contains('tnlx')) x = x.nextElementSibling;
    if(!x) return;
    const willOpen = !x.classList.contains('show');
    document.querySelectorAll('.tnlx.show').forEach(o => o.classList.remove('show'));
    if(willOpen) x.classList.add('show');
  },

  /* 스터브 기성품 — 페이지들이 똑같이 쓰라고 여기 둔다 */
  stubOpen(){
    return `<div class="holo2">모집중<i></i></div><div class="sl">BOARDING</div>`;
  },
  stubSoon(){
    return `<div class="soon">예정</div>`;
  },

  /* 티켓 CSS 주입 — 페이지마다 복사하지 않고 여기 한 벌만.
     절취선 구멍 색은 페이지 배경 몫이라 --tnl-hole 로 넘겨받는다 */
  _ticketCSS(){
    if(document.getElementById('tnl-ticket-css')) return;
    const st = document.createElement('style');
    st.id = 'tnl-ticket-css';
    st.textContent = `
.btk{position:relative;display:block;width:358px;max-width:calc(100% - 24px);height:150px;margin:0 auto 12px;
  overflow:hidden;filter:drop-shadow(0 5px 9px rgba(0,0,0,.45));
  clip-path:polygon(14px 0,100% 0,100% 100%,0 100%,0 14px)}
div.btk{cursor:pointer}
.btk>img{width:100%;height:100%;object-fit:cover;display:block}
.btk .perf{position:absolute;left:258px;top:0;bottom:0;width:2px;
  background:repeating-linear-gradient(180deg,rgba(0,0,0,.55) 0 5px,transparent 5px 10px)}
.btk .perf::before,.btk .perf::after{content:'';position:absolute;left:-5px;width:12px;height:12px;border-radius:50%;
  background:var(--tnl-hole,#141317);box-shadow:inset 0 1px 3px rgba(0,0,0,.5)}
.btk .perf::before{top:-6px}.btk .perf::after{bottom:-6px}
.btk .ov{position:absolute;inset:0;color:#ECEEF2}
.btk .lbl{position:absolute;left:20px;top:14px;font-size:7.5px;letter-spacing:2.5px;
  font-family:'Cinzel',serif;font-weight:800;color:#B8A88E}
.btk .route{position:absolute;left:20px;top:34px;display:flex;align-items:baseline;gap:8px;width:200px}
.btk .route b{font-family:'Do Hyeon',sans-serif;font-weight:400;font-size:21px}
.btk .route .d{flex:1;border-bottom:2px dotted currentColor;opacity:.3;position:relative;top:-5px}
.btk .nm{position:absolute;left:20px;top:72px;font-size:10.5px;opacity:.8}
.btk .g{position:absolute;left:20px;top:100px;display:grid;gap:1px 9px;width:222px;
  grid-template-columns:.9fr .8fr 1.3fr}
.btk .g i{font-style:normal;font-size:7px;letter-spacing:1.5px;opacity:.5}
.btk .g b{display:block;font-family:'Nanum Gothic Coding',monospace;font-weight:400;font-size:11px;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.btk .stub{position:absolute;right:0;top:0;width:100px;height:100%;
  display:flex;flex-direction:column;align-items:center;justify-content:center}
.btk .stub img{width:58px;height:58px;object-fit:contain;filter:drop-shadow(0 2px 4px rgba(0,0,0,.45))}
.btk .stx{font-family:'Do Hyeon',sans-serif;font-size:10px;margin-top:-36px;color:rgba(255,225,225,.94);
  text-shadow:0 1px 1px rgba(70,0,6,.9);z-index:2;text-align:center;line-height:1.1;pointer-events:none}
.btk .stx small{display:block;font-family:'Nanum Gothic Coding',monospace;font-size:6px;opacity:.85}
.btk .sl{font-size:6.5px;letter-spacing:1.5px;color:#8a8090;font-weight:800;margin-top:4px}
.btk .holo2{width:56px;height:56px;border-radius:50%;border:2.5px dashed rgba(255,225,225,.4);
  position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;
  font-family:'Do Hyeon',sans-serif;font-size:13px;color:rgba(255,225,225,.94);
  text-shadow:0 1px 1px rgba(70,0,6,.9)}
.btk .holo2 i{position:absolute;inset:0;font-style:normal;
  background:linear-gradient(115deg,transparent 25%,rgba(255,255,255,.5) 45%,rgba(180,220,255,.3) 50%,transparent 70%);
  animation:tnlshim 2.4s linear infinite}
.btk.sm{height:100px}
.btk.sm .lbl{top:15px}
.btk.sm .route{top:34px}
.btk.sm .route b{font-size:16px}
.btk.sm .nm{top:64px;font-size:9.5px}
.btk .soon{font-family:'Do Hyeon',sans-serif;font-size:14px;letter-spacing:5px;text-indent:5px;
  color:rgba(236,238,242,.55);text-shadow:0 1px 1px rgba(70,0,6,.6)}
.tnlx{display:none;width:358px;max-width:calc(100% - 24px);margin:-6px auto 16px;padding:12px 15px 13px;
  background:#1C1A1F;border:1px solid #35313A;border-top:0;border-radius:0 0 9px 9px}
.tnlx.show{display:block;animation:tnlxopen .2s ease}
@keyframes tnlxopen{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
.tnlx .xr{font-size:11.5px;color:#A79E8F;line-height:1.7}
.tnlx .xn{font-size:12px;color:#A79E8F;line-height:1.65;background:rgba(255,255,255,.03);
  border-radius:7px;padding:8px 10px;margin:7px 0}
.tnlx .xb{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}
.tnlx .xb a{border:1px solid #4A453E;background:rgba(255,255,255,.03);color:#CFC7B8;
  border-radius:7px;padding:7px 11px;font-size:11.5px;text-decoration:none}
div.btk .stub{cursor:pointer}
@keyframes tnlshim{0%{transform:translateX(-70%)}100%{transform:translateX(70%)}}
@media (prefers-reduced-motion:reduce){.btk .holo2 i{animation:none}}`;
    document.head.appendChild(st);
  }
};

/* ══ 참가 신청 — 티켓처럼 한 시스템. 페이지는 두 줄만 부른다:
     1) 모집중 티켓 아래에  TUNEL.signupBar(m)      (HTML 문자열)
     2) 렌더가 끝난 뒤       TUNEL.signupInit()       (바 채색 + 팝업 준비)
   m 은 최소한 id · d · dow · s · e · place · fee · line_name · data.cap 을 갖는다.
   흐름: 신청(applied) → 카카오페이 → 입금했어요(paid) → 운영진 확정(confirmed)
   서버가 강제한다 — signups RLS · signup_seats · notify 트리거              ══ */
(function(){
  const byId = {}, mine = {}, seats = {};
  const esc = t => String(t??'').replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const capOf = m => m.data?.cap ?? null;
  let mdl=null, body=null, titleEl=null, PAYLINK=null, _qrP=null;

  function qrLib(){
    if(global.qrcode) return Promise.resolve();
    if(!_qrP) _qrP = new Promise(res => {
      const sc = document.createElement('script');
      sc.src = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js';
      sc.onload = res; sc.onerror = res;
      document.head.appendChild(sc);
    });
    return _qrP;
  }
  function qrHTML(url){
    try{
      const q = global.qrcode(0, 'M'); q.addData(url); q.make();
      return q.createImgTag(4, 8);
    }catch(e){ return ''; }
  }

  function ensureUI(){
    if(mdl) return;
    if(!document.getElementById('tnl-signup-css')){
      const st = document.createElement('style');
      st.id = 'tnl-signup-css';
      st.textContent = `
.tnlbar{display:flex;align-items:center;gap:10px;width:358px;max-width:calc(100% - 8px);
  margin:-6px auto 14px;background:#1C1A1F;border:1px solid #35313A;border-top:0;
  border-radius:0 0 9px 9px;padding:9px 13px}
.tnlbar .seats{flex:1;font-size:11.5px;color:#A79E8F}
.tnlbar .seats b{color:#E8C36B;font-weight:800}
.tnlbar button{flex:none;border:0;border-radius:7px;padding:8px 14px;font-size:12px;
  font-weight:800;cursor:pointer;font-family:inherit;background:#B3161E;color:#fff}
.tnlbar button.ghost{background:none;border:1px solid #4A453E;color:#CFC7B8;font-weight:700}
.tnlbar button.done{background:#2F6B5A;color:#DFF3EC}
.tnlbar button.wait{background:#3A2B15;color:#E8C36B}
.tnlmdl{position:fixed;inset:0;z-index:60;display:none;align-items:flex-end;justify-content:center}
.tnlmdl.on{display:flex}
.tnlmdl .bd{position:absolute;inset:0;background:rgba(12,10,14,.66);backdrop-filter:blur(2px)}
.tnlmdl .sh{position:relative;width:100%;max-width:560px;max-height:86vh;display:flex;flex-direction:column;
  background:#232125;border:1px solid #3A342B;border-bottom:0;border-radius:14px 14px 0 0;
  box-shadow:0 -10px 30px rgba(0,0,0,.5);
  padding-bottom:env(safe-area-inset-bottom);
  animation:tnlmdlup .26s cubic-bezier(0.32,0.72,0,1)}
@keyframes tnlmdlup{from{transform:translateY(22px);opacity:.5}to{transform:none;opacity:1}}
.tnlmdl .hd{flex:none;display:flex;align-items:center;gap:10px;padding:15px 16px 12px;
  border-bottom:1px solid rgba(244,235,217,.14)}
.tnlmdl .hd b{font-size:13px;font-weight:800;letter-spacing:2px;color:#D9D2C4}
.tnlmdl .x{margin-left:auto;border:1px solid #4A453E;background:none;color:#CFC7B8;
  width:28px;height:28px;border-radius:50%;font-size:15px;line-height:1;cursor:pointer}
.tnlmdl .x:active{transform:scale(.9)}
.tnlmdl .bodyw{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:14px 16px 22px;
  font-family:'Pretendard',-apple-system,'Apple SD Gothic Neo',sans-serif}
@media (min-width:600px){
  .tnlmdl{align-items:center}
  .tnlmdl .sh{border-radius:14px;border-bottom:1px solid #3A342B;max-height:80vh}
}
.tnlmdl .bnote{font-size:12px;color:#8F887B;line-height:1.7;margin-top:10px}
.tnlmdl .row{display:flex;gap:12px;padding:8px 2px;font-size:13px;border-bottom:1px solid rgba(244,235,217,.08)}
.tnlmdl .row .k{flex:none;width:56px;color:#8F887B}
.tnlmdl .row .v{flex:1;color:#E2DBCE}
.tnlmdl .fee{font-size:24px;font-weight:800;color:#E8C36B;text-align:center;margin:16px 0 4px}
.tnlmdl .feecap{font-size:11px;color:#8F887B;text-align:center;margin-bottom:14px}
.tnlmdl .pay{display:block;text-align:center;background:#FEE500;color:#191600;border-radius:9px;
  padding:13px 0;font-size:14px;font-weight:800;margin-bottom:9px;text-decoration:none}
.tnlmdl .qrbox{text-align:center;margin:13px 0 5px}
.tnlmdl .qrbox img{width:132px;height:132px;border-radius:8px;background:#fff;padding:8px}
.tnlmdl .qrcap{font-size:10.5px;color:#77716A;text-align:center;margin-top:6px;line-height:1.6}
.tnlmdl .warn{background:rgba(232,195,107,.08);border:1px solid rgba(232,195,107,.35);border-radius:8px;
  padding:10px 12px;font-size:11.5px;color:#E8C36B;line-height:1.7;margin:13px 0}
.tnlmdl .act{display:flex;gap:8px;margin-top:14px}
.tnlmdl .act button{flex:1;border:0;border-radius:9px;padding:12px 0;font-size:13px;font-weight:800;
  cursor:pointer;font-family:inherit}
.tnlmdl .act .go{background:#B3161E;color:#fff}
.tnlmdl .act .ghost{background:none;border:1px solid #4A453E;color:#A79E8F;font-weight:700}
.tnlmdl .big{font-size:17px;font-weight:800;color:#F2EAD9;text-align:center;margin:18px 0 6px}
.tnlmdl .cap2{font-size:12px;color:#8F887B;text-align:center;line-height:1.8}
.tnlmdl .mgr{display:flex;align-items:center;gap:9px;background:#1C1A1F;border:1px solid #35313A;
  border-radius:9px;padding:10px 12px;margin-bottom:7px}
.tnlmdl .mgr .nm3{flex:1;font-size:13px;font-weight:700;color:#E9E2D2}
.tnlmdl .mgr .st3{flex:none;font-size:9px;font-weight:800;border-radius:3px;padding:3px 7px}
.tnlmdl .st3.applied{background:#2A2630;color:#A79E8F}
.tnlmdl .st3.paid{background:#3A2B15;color:#E8C36B}
.tnlmdl .st3.confirmed{background:#1F3A30;color:#7FD8B4}
.tnlmdl .st3.waitlist{background:#22303F;color:#9CC0E8}
.tnlmdl .mgr button{flex:none;border:1px solid #4A453E;background:rgba(255,255,255,.03);
  color:#CFC7B8;border-radius:6px;padding:6px 10px;font-size:11px;cursor:pointer;font-family:inherit}
.tnlmdl .mgr button.ok{border-color:#2F6B5A;color:#7FD8B4}\n.sstub{display:contents}`;
      document.head.appendChild(st);
    }
    mdl = document.createElement('div');
    mdl.className = 'tnlmdl'; mdl.id = 'tnlSignMdl';
    mdl.setAttribute('role','dialog'); mdl.setAttribute('aria-modal','true'); mdl.setAttribute('aria-label','참가 신청');
    mdl.innerHTML = `<div class="bd" data-close></div>
      <div class="sh">
        <div class="hd"><b id="tnlSignTitle">참가 신청</b><button class="x" data-close aria-label="닫기">✕</button></div>
        <div class="bodyw" id="tnlSignBody"><p class="bnote">불러오는 중…</p></div>
      </div>`;
    document.body.appendChild(mdl);
    body = document.getElementById('tnlSignBody');
    titleEl = document.getElementById('tnlSignTitle');
    mdl.querySelectorAll('[data-close]').forEach(el => el.onclick = close);
  }
  function close(){
    mdl.classList.remove('on'); document.body.style.overflow='';
    TUNEL.signupRefresh();
  }

  async function loadMine(){
    const me = await TUNEL.me();
    if(!me) return;
    const ids = Object.keys(byId);
    if(!ids.length) return;
    const { data } = await sb().from('signups').select('meeting_id,status')
      .eq('member_id', me.id).in('meeting_id', ids);
    Object.keys(mine).forEach(k => delete mine[k]);
    (data||[]).forEach(r => { if(r.status!=='cancelled') mine[r.meeting_id] = r.status; });
  }
  async function loadSeats(mid){
    const { data } = await sb().rpc('signup_seats', { p_meeting: mid });
    seats[mid] = data || { taken:0, wait:0 };
    return seats[mid];
  }

  async function paintBar(bar){
    const mid = bar.dataset.mid;
    const m = byId[mid]; if(!m) return;
    const cap = capOf(m);
    const st = await loadSeats(mid);
    const left = cap ? Math.max(0, cap - st.taken) : null;
    const my = mine[mid];
    const seatsEl = bar.querySelector('.seats');
    const btn = bar.querySelector('button');
    seatsEl.innerHTML = cap
      ? (left > 0 ? `남은 자리 <b>${left}</b> / ${cap}` : `만석 · 대기 ${st.wait}명`)
      : `신청 ${st.taken}명`;
    btn.className = '';
    if(my === 'confirmed'){ btn.textContent = '확정됨 ✓'; btn.classList.add('done'); }
    else if(my === 'paid'){ btn.textContent = '입금 확인 중'; btn.classList.add('wait'); }
    else if(my === 'applied'){ btn.textContent = '입금하러 가기'; }
    else if(my === 'waitlist'){ btn.textContent = '대기 중'; btn.classList.add('wait'); }
    else if(cap && left === 0){ btn.textContent = '대기 등록'; btn.classList.add('ghost'); }
    else btn.textContent = '신청하기';
    btn.onclick = () => openSign(mid);
    TUNEL.me().then(me => {
      if(me && (me.is_admin || me.role==='staff') && !bar.querySelector('[data-act="mgr"]')){
        const g = document.createElement('button');
        g.className='ghost'; g.dataset.act='mgr'; g.textContent='관리';
        g.onclick = () => openManage(mid);
        bar.appendChild(g);
      }
    });
  }

  async function payLink(){
    if(PAYLINK !== null) return PAYLINK;
    const { data } = await sb().from('settings').select('value').eq('key','kakaopay_link').maybeSingle();
    PAYLINK = data?.value || '';
    return PAYLINK;
  }
  /* 참가비 금액이 고정된 송금 링크(pay_links)가 있으면 그걸 쓴다 */
  async function feeLink(m){
    const won = parseInt(String(m.fee||'').replace(/[^\d]/g,''), 10);
    if(won){
      const { data } = await sb().from('pay_links').select('link').eq('amount', won).maybeSingle();
      if(data?.link) return { link: data.link, fixed: true };
    }
    return { link: await payLink(), fixed: false };
  }
  function meetingRows(m){
    return `<div class="row"><span class="k">모임</span><span class="v">${TUNEL.title(m)} · ${esc(m.line_name)}</span></div>
      <div class="row"><span class="k">날짜</span><span class="v">${(m.d||'').replace(/-/g,'.')} (${m.dow||''}) ${m.s||''}${m.e?'~'+m.e:''}</span></div>
      <div class="row"><span class="k">장소</span><span class="v">${esc(m.place||'')}</span></div>`;
  }

  async function openSign(mid){
    const m = byId[mid];
    mdl.classList.add('on'); document.body.style.overflow='hidden';
    titleEl.textContent = '참가 신청';
    body.innerHTML = '<p class="bnote">불러오는 중…</p>';

    const me = await TUNEL.me();
    if(!me){
      body.innerHTML = `<p class="big">로그인이 필요해요</p>
        <p class="cap2">카카오로 로그인하면 닉네임으로 신청할 수 있어요</p>
        <div class="act"><button class="go" id="tnlKko">카카오 로그인</button></div>`;
      document.getElementById('tnlKko').onclick = () =>
        sb().auth.signInWithOAuth({ provider:'kakao',
          options:{ redirectTo: location.origin + location.pathname + '?li=' + Date.now() } });
      return;
    }
    const my = mine[mid];
    if(my === 'confirmed'){
      body.innerHTML = `<p class="big">확정됐어요 🎉</p>${meetingRows(m)}
        <p class="cap2" style="margin-top:14px">그날 봬요! 사정이 생기면 취소를 눌러주세요.</p>
        <div class="act"><button class="ghost" id="tnlCancel">신청 취소</button></div>`;
      hookCancel(mid); return;
    }
    if(my === 'paid'){
      body.innerHTML = `<p class="big">입금 확인 기다리는 중</p>${meetingRows(m)}
        <p class="cap2" style="margin-top:14px">운영진이 입금을 확인하면 확정 알림을 보내드려요.<br>보통 하루 안에 확인돼요.</p>
        <div class="act"><button class="ghost" id="tnlCancel">신청 취소</button></div>`;
      hookCancel(mid); return;
    }
    if(my === 'waitlist'){
      body.innerHTML = `<p class="big">대기 등록되어 있어요</p>${meetingRows(m)}
        <p class="cap2" style="margin-top:14px">자리가 나면 알림으로 알려드려요.</p>
        <div class="act"><button class="ghost" id="tnlCancel">대기 취소</button></div>`;
      hookCancel(mid); return;
    }

    const cap = capOf(m);
    const st = await loadSeats(mid);
    const full = cap && (cap - st.taken) <= 0;
    if(full && !my){
      body.innerHTML = `<p class="big">지금은 만석이에요</p>${meetingRows(m)}
        <p class="cap2" style="margin-top:14px">대기로 걸어두면 자리가 날 때 순서대로 알려드려요.<br>지금 대기 ${st.wait}명.</p>
        <div class="act"><button class="go" id="tnlWait">대기 등록</button></div>`;
      document.getElementById('tnlWait').onclick = async () => {
        const { error } = await sb().from('signups').upsert(
          { meeting_id: mid, member_id: me.id, status:'waitlist' }, { onConflict:'meeting_id,member_id' });
        if(error){ alert('등록 실패: '+error.message); return; }
        mine[mid] = 'waitlist'; openSign(mid);
      };
      return;
    }

    /* 신청 + 결제 안내 */
    await qrLib();
    const pl = await feeLink(m);
    body.innerHTML = `${meetingRows(m)}
      ${m.fee ? `<p class="fee">${esc(m.fee)}</p><p class="feecap">${pl.fixed?'금액이 맞춰져 있어요 — 보내기만 하면 끝':'참가비 — 공간·게임·다과'}</p>` : ''}
      <a class="pay" href="${esc(pl.link)}" target="_blank" rel="noopener">💛 카카오페이로 보내기</a>
      <div class="qrbox">${qrHTML(pl.link)}<p class="qrcap">컴퓨터로 보고 있다면 폰 카메라로 QR을 찍어주세요</p></div>
      <div class="warn">보낼 때 <b>메시지에 닉네임(${esc(me.nick)})</b>을 꼭 적어주세요.<br>운영진이 입금을 대조하는 데 써요.</div>
      <div class="act">
        <button class="go" id="tnlPaid">입금했어요</button>
        <button class="ghost" id="tnlCancel" style="flex:0 0 92px">${my==='applied'?'신청 취소':'닫기'}</button>
      </div>`;
    /* 팝업을 연 순간 자리 선점 (applied) */
    if(!my){
      const { error } = await sb().from('signups').upsert(
        { meeting_id: mid, member_id: me.id, status:'applied' }, { onConflict:'meeting_id,member_id' });
      if(!error) mine[mid] = 'applied';
    }
    document.getElementById('tnlPaid').onclick = async () => {
      const { error } = await sb().from('signups').update({ status:'paid' })
        .eq('meeting_id', mid).eq('member_id', me.id);
      if(error){ alert('실패: '+error.message); return; }
      mine[mid] = 'paid'; openSign(mid);
    };
    if(my==='applied') hookCancel(mid);
    else document.getElementById('tnlCancel').onclick = close;
  }
  function hookCancel(mid){
    const b = document.getElementById('tnlCancel'); if(!b) return;
    b.onclick = async () => {
      if(!confirm('신청을 취소할까요?')) return;
      const me = await TUNEL.me();
      const { error } = await sb().from('signups').update({ status:'cancelled' })
        .eq('meeting_id', mid).eq('member_id', me.id);
      if(error){ alert('실패: '+error.message); return; }
      delete mine[mid]; close();
    };
  }

  /* ── 운영진 신청 관리 ── */
  async function openManage(mid){
    const m = byId[mid];
    mdl.classList.add('on'); document.body.style.overflow='hidden';
    titleEl.textContent = '신청 관리 · ' + (m.d||'').slice(5).replace('-','/');
    body.innerHTML = '<p class="bnote">불러오는 중…</p>';
    const [{ data: rows }, { data: mems }] = await Promise.all([
      sb().from('signups').select('id,member_id,status,created_at')
        .eq('meeting_id', mid).neq('status','cancelled').order('created_at'),
      sb().from('members').select('id,nick')
    ]);
    const nick = {}; (mems||[]).forEach(x=>nick[x.id]=x.nick);
    const LBL = { applied:'신청', paid:'입금대기', confirmed:'확정', waitlist:'대기' };
    if(!(rows||[]).length){ body.innerHTML = '<p class="bnote" style="text-align:center;padding:18px 0">아직 신청이 없어요</p>'; return; }
    body.innerHTML = (rows||[]).map(r => `
      <div class="mgr" data-sid="${r.id}">
        <span class="nm3">${esc(nick[r.member_id]||'?')}</span>
        <span class="st3 ${r.status}">${LBL[r.status]||r.status}</span>
        ${r.status!=='confirmed' ? `<button class="ok" data-do="confirmed">확정</button>` : ''}
        <button data-do="cancelled">취소</button>
      </div>`).join('')
      + '<p class="bnote">확정을 누르면 신청자 알림함으로 확정 알림이 가요.</p>';
    body.querySelectorAll('[data-do]').forEach(btn => {
      btn.onclick = async () => {
        const sid = btn.closest('.mgr').dataset.sid;
        const to = btn.dataset.do;
        if(to==='cancelled' && !confirm('이 신청을 취소할까요?')) return;
        const { error } = await sb().from('signups').update({ status: to }).eq('id', sid);
        if(error){ alert('실패: '+error.message); return; }
        openManage(mid);
      };
    });
  }

  /* 모집중 티켓 아래 신청 바 — HTML 문자열 (회차를 등록해 둔다) */
  TUNEL.signupBar = function(m){
    byId[m.id] = m;
    return `<div class="tnlbar" data-mid="${m.id}">
      <span class="seats">…</span>
      <button data-act="open">신청하기</button>
    </div>`;
  };
  /* 렌더 뒤 한 번 — 팝업 준비 + 바 채색. 다시 불러도 안전하다 */
  TUNEL.signupInit = async function(){
    ensureUI();
    await TUNEL.signupRefresh();
  };
  TUNEL.signupRefresh = async function(){
    await loadMine();
    document.querySelectorAll('.tnlbar').forEach(paintBar);
    /* 페이지가 걸어둔 훅 — 신청 상태가 바뀌면 도장·명단을 다시 그리라고 알린다 */
    if(typeof TUNEL.onSignupChange === 'function'){ try{ TUNEL.onSignupChange(); }catch(e){} }
  };
  /* 페이지에서 직접 팝업을 열 때 (첫밤 스터브 도장 등) */
  TUNEL.signupOpen = function(mid){ ensureUI(); openSign(mid); };
  /* 내 신청 상태 — signupRefresh 뒤에 유효 */
  TUNEL.signupStatus = mid => mine[mid] || null;
  /* 회차 신청자 명단 (닉네임 포함) — 회원끼리 서로 보인다 */
  TUNEL.signupList = async function(mid){
    const [{ data: rows }, { data: mems }] = await Promise.all([
      sb().from('signups').select('member_id,status,created_at')
        .eq('meeting_id', mid).neq('status','cancelled').order('created_at'),
      sb().from('members').select('id,nick')
    ]);
    const nick = {}; (mems||[]).forEach(x => nick[x.id] = x.nick);
    return (rows||[]).map(r => ({ ...r, nick: nick[r.member_id] || '?' }));
  };
})();

global.TUNEL = TUNEL;
})(window);
