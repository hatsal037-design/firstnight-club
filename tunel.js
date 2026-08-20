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
@keyframes tnlshim{0%{transform:translateX(-70%)}100%{transform:translateX(70%)}}
@media (prefers-reduced-motion:reduce){.btk .holo2 i{animation:none}}`;
    document.head.appendChild(st);
  }
};

global.TUNEL = TUNEL;
})(window);
