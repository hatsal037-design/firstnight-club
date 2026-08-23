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

  /* 노선 한 곳 — 운영값(DB lines)과 생김새(_skins)를 합쳐 돌려준다.
     화면은 노선 이름·경로·번호를 직접 적지 말고 이걸 읽는다 (개발/티켓_규칙.md) */
  async line(id){
    const l = (await TUNEL.lines()).find(x => x.id === id) || null;
    return l ? TUNEL.lineOf(l) : null;
  },
  lineOf(l){
    const sk = TUNEL._skins[l.id] || TUNEL._skins[l.skin] || null;
    return { ...l, skin: sk,
      /* 회차 자료(v_meetings)가 쓰는 이름과 맞춰 둔다 — 티켓이 그대로 읽는다 */
      line: l.id, line_no: l.no, line_name: l.name, line_short: (sk && sk.short) || l.name,
      line_path: '/' + String(l.path || '').replace(/^\//, '') };
  },
  /* 노선 값을 미리 받아 두면 화면에서 동기로 쓸 수 있다 */
  lineSync(id){ const l = (_lines || []).find(x => x.id === id); return l ? TUNEL.lineOf(l) : null; },

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
  _tkCSS(){
    if(document.getElementById('tunel-tk-css')) return;
    const st = document.createElement('style'); st.id = 'tunel-tk-css';
    st.textContent = `
.tkt{display:flex;width:358px;max-width:calc(100% - 8px);margin:0 auto 12px;min-height:100px;
  text-decoration:none;position:relative;overflow:hidden;border-radius:2px;
  background:#1C1A1F;color:#E6E0D6;border:1px solid #35313A}
.tkt .tbody{flex:1;min-width:0;padding:12px 14px 11px;display:flex;flex-direction:column;justify-content:center}
.tkt .tstub{width:40px;flex:none;display:flex;align-items:center;justify-content:center;
  border-left:1px dashed rgba(255,255,255,.22)}
.tkt .tstub span{writing-mode:vertical-rl;font-size:8px;letter-spacing:3px;font-weight:800;opacity:.75}
.tkt .tno{font-size:8.5px;letter-spacing:1.5px;text-align:right;opacity:.6}
.tkt .trow{display:flex;align-items:baseline;gap:8px;margin-top:4px}
.tkt .td{font-size:19px;font-weight:800;letter-spacing:-.3px}
.tkt .tt{font-size:11px;opacity:.75}
.tkt .tst{margin-left:auto;font-size:9px;font-weight:800;letter-spacing:1px;border-radius:3px;padding:3px 7px;
  border:1px solid rgba(255,255,255,.25)}
.tkt .tp{font-size:11.5px;margin-top:5px;opacity:.85}
.tkt .tdesc{font-size:11px;opacity:.7;line-height:1.5;margin-top:8px}
.tkt.lg{min-height:150px}
.tkt.xl{min-height:180px}
.tkt.past{opacity:.72}`;
    document.head.appendChild(st);
  },
  ticket(m, opt = {}){
    TUNEL._tkCSS();
    const past = opt.past ?? isPast(m);
    const xl   = !past && m.kind === 'event';    // 대형 행사(MT·운동회)는 이벤트 180
    const big  = !past && !xl && m.status === 'open';   // 모집중은 규격 일반(150) 크기로
    const tbd  = m.data?.tbd === true;
    const when = tbd ? (m.data?.tbdtxt || '날짜 조율 중')
      : `${+m.d.slice(5,7)}/${+m.d.slice(8)} <small style="font-size:12px">(${m.dow||''})</small>`;
    const time = tbd ? '' : (m.s ? m.s + (m.e ? '~' + m.e : '') : '');
    const href = opt.href ?? m.line_path;
    const place = m.place || '';
    const att = past && m.att_count ? ` · ${m.att_count}명` : '';
    const desc = xl && m.memo ? `<span class="tdesc">${m.memo}</span>` : '';
    return `
    <a class="tkt ${m.line_skin}${past ? ' past' : ''}${big ? ' lg' : ''}${xl ? ' xl' : ''}" href="${href}">
      <span class="tbody">
        <span class="tno">PLATFORM ${String(m.line_no).padStart(2,'0')}${past ? ' · USED' : ''}</span>
        <span class="trow">
          <span class="td">${when}</span>
          <span class="tt">${time}</span>
          <span class="tst">${TUNEL.statusLabel(m)}</span>
        </span>
        <span class="tp">${TUNEL.title(m)} · ${place}${att}</span>${desc}
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
  /* ── 확정 티켓 스킨 5종 (2026-08-20 확정본 이식 — 시안/티켓_*3크기*.html)
     pass  = 보딩패스형 (첫밤·놀이터·찰칵) · score = 스코어카드 (올림픽) · metal = 각인 메탈 (방구석)
     새 노선 확정본이 나오면 여기 한 줄 더하면 어디서든 티켓이 뜬다 */
  _skins: {
    botc:  { t:'pass', short:'첫밤',  card:'/1ndclub/tk_card.jpg?v2', stamp:'/1ndclub/stamp_wax.png', stampDest:'첫밤行',
             ink:'#ECEEF2', lbl:'#B8A88E', rFont:"'Do Hyeon',sans-serif", rMd:21, rSm:16, acc:'#E8756A',
             perf:'rgba(0,0,0,.55)' },
    /* play(놀이터) — 손목밴드 판지 확정 (2026-08-20 햇살님 승인).
       놀이공원·워터밤·클럽 밴드 플랫레이 사진 + 어두운 막 + Dongle 헤드라인.
       시안: 시안/티켓_플레이_밴드3크기.html · 슬림100(예정)·일반150(모집중)·이벤트180(kind=event) */
    play:  { t:'band', card:'/tk/TK_play_band.jpg', short:'놀이터' },
    snap:  { t:'pass', short:'나들이', card:'/tk/TK_sopung.jpg', cardSm:'/tk/TK_sopung_slim.jpg',
             ink:'#6B4A52', lbl:'#C4788F', rFont:"'Nanum Pen Script',cursive", rMd:27, rSm:21, acc:'#D9407A',
             perf:'rgba(140,80,100,.4)' },
    library:{ t:'pass', short:'서재', flat:'paper',
             ink:'#26282B', lbl:'#8A8578', rFont:"'Pretendard',system-ui,sans-serif", rMd:19, rSm:15, acc:'#6B7A5E',
             perf:'rgba(0,0,0,.18)' },
    sport: { t:'score', card:'/v/tk_sport.webp', cardSm:'/v/tk_sport_slim.webp' },
    cyber: { t:'metal', card:'/v/tk_cyber_hairline.webp' }
  },
  hasSkin(line){ return !!TUNEL._skins[line]; },

  /* ══ 티켓 한 벌 — 티켓 + (모집중이면) 신청 바까지 한 덩어리로 ══
     허브(tunel.kr)와 노선 페이지(첫밤 등)가 이 함수 하나를 쓴다. 표기 규칙은 여기서만 정한다.
       크기   kind=event → xl(180) · 모집중 → 기본(150) · 그 밖 → 슬림(100)
       스텁   모집중 → '모집중 · BOARDING'(신청 뒤에는 내 상태 도장으로 바뀐다) · 그 밖 → '예정'
     opt: onclick(티켓 클릭) · card(티켓 배경 덮어쓰기) · bar(false면 신청 바 생략) · slim(true면 항상 슬림) */
  ticketOne(m, opt = {}){
    const past = opt.past || TUNEL.isPast(m);
    const open = m.status === 'open' && !past;
    /* 스킨이 없는 노선은 옛 소형 티켓으로 — 그래도 신청 바는 같은 규칙으로 붙는다 */
    if(!TUNEL.hasSkin(m.line))
      return TUNEL.ticket(m, { past }) + (open && opt.bar !== false ? TUNEL.signupBar(m) : '');
    const sk = TUNEL._skins[m.line];
    if(past) return TUNEL.ticket(m, { past });
    /* 예정 회차를 슬림으로 두는 노선(soonTkt)은 그 규칙을 따른다 */
    if(!open && m.kind !== 'event' && sk.soonTkt) return TUNEL.ticket(m);
    const size = opt.slim ? 'sm' : (m.kind === 'event' ? 'xl' : open ? undefined : 'sm');
    const stub = open
      ? `<span class="sstub" data-mid="${m.id}" data-d="${m.d}"
           onclick="event.stopPropagation();TUNEL.signupOpen('${m.id}')">${TUNEL.stubOpen(m)}</span>`
      : TUNEL.stubSoon(m);
    const tk = TUNEL.boardingTicket(m, { onclick: opt.onclick, card: opt.card, size, stub });
    return tk + (open && opt.bar !== false ? TUNEL.signupBar(m) : '');
  },

  boardingTicket(m, opt = {}){
    TUNEL._ticketCSS();
    const sk    = TUNEL._skins[m.line] || TUNEL._skins.botc;
    const sm    = opt.size === 'sm';      // 슬림 358×100 — 예정·지난 회차용 (당일 정보 숨김)
    const tbd   = m.data?.tbd === true;
    const dowEN = {'월':'MON','화':'TUE','수':'WED','목':'THU','금':'FRI','토':'SAT','일':'SUN'}[m.dow] || m.dow || '';
    const card  = opt.card ?? (sm && sk.cardSm ? sk.cardSm : sk.card);
    const no    = String(m.line_no || '').padStart(2,'0');
    const dt    = tbd ? (m.data?.tbdtxt || '미정') : `${+m.d.slice(5,7)}/${+m.d.slice(8)} ${dowEN}`;
    const open_ = (cls) => opt.href ? `<a class="${cls}" href="${opt.href}">`
                : `<div class="${cls}"${opt.onclick ? ` onclick="${opt.onclick}"` : ''}>`;
    const close_ = opt.href ? '</a>' : '</div>';

    if(sk.t === 'score'){   /* 우리끼리 올림픽 — 스코어카드 */
      return `${open_(`btk score${sm ? ' sm' : ''}`)}
        <img src="${card}" alt="">
        <div class="sov"></div><div class="sperf"></div>
        <div class="in">
          <div class="no">PLATFORM ${no}</div>
          <div class="snm">${m.line_name || ''}</div>
          ${sm ? `<div class="sub2">${TUNEL.title(m)} · ${tbd ? (m.data?.tbdtxt || '날짜 조율 중') : TUNEL.fmt(m.d, m.dow)}</div>`
               : `<div class="g sg">
                    <div><i>DATE</i><b>${dt}</b></div>
                    <div><i>TIME</i><b>${m.s || ''}</b></div>
                    <div><i>PLACE</i><b>${m.place || ''}</b></div>
                  </div>`}
        </div>
        <div class="stub s2">${sm ? `<div class="stamp">예정</div>`
          : `<div class="stamp">출전</div><div class="ssl">STAMP HERE</div>`}</div>
      ${close_}`;
    }

    if(sk.t === 'metal'){   /* 방구석 디스코드 — 헤어라인 메탈 + 레이저 각인 */
      const code = m.data?.code;
      return `${open_(`btk metal${sm ? ' sm' : ''}`)}
        <img src="${card}" alt="">
        <div class="gl"></div>
        <div class="etch">
          <div class="mlbl">PLATFORM ${no}${m.status === 'open' ? ' · OPEN' : ''}</div>
          <div class="rt">${m.line_name || ''}</div>
          ${sm ? '' : `<div class="evt">${TUNEL.title(m)}${m.place ? ' · ' + m.place : ''}</div>`}
          <div class="when">${tbd ? (m.data?.tbdtxt || '날짜 조율 중') : `${dt}　${m.s || ''}`}</div>
        </div>
        <div class="laser"></div>
        <div class="stub m2">${code ? `<div class="code">${code}</div><div class="mstx">TODAY'S CODE</div>`
                                    : `<div class="code" style="opacity:.55">····</div><div class="mstx">CODE SOON</div>`}</div>
      ${close_}`;
    }

    if(sk.t === 'band'){   /* 어른이 놀이터 — 밴드 판지 + Dongle 헤드라인 */
      const xl2 = opt.size === 'xl';
      const body2 = sm
        ? `<div class="bnm">${TUNEL.title(m)} · ${tbd ? (m.data?.tbdtxt || '날짜 조율 중') : TUNEL.fmt(m.d, m.dow)}</div>`
        : `<div class="bnm">${TUNEL.title(m)}</div>
          ${xl2 && m.memo ? `<div class="bdesc">${m.memo}</div>` : ''}
          <div class="g bg2">
            <div><i>DATE</i><b>${dt}</b></div>
            <div><i>TIME</i><b>${m.s || ''}</b></div>
            <div><i>PLACE</i><b>${m.place || ''}</b></div>
          </div>`;
      return `${open_(`btk band${sm ? ' sm' : xl2 ? ' xl' : ''}`)}
        <img src="${opt.card ?? sk.card}" alt="">
        <div class="bdim"></div>
        <div class="perf" style="background:repeating-linear-gradient(180deg,rgba(255,255,255,.5) 0 5px,transparent 5px 10px)"></div>
        <div class="ov bov">
          <div class="blbl">TÜNEL BOARDING PASS · PLATFORM ${no}</div>
          <div class="bline">${m.line_name || ''}</div>
          ${body2}
          <div class="stub bstub">${opt.stub || ''}</div>
        </div>
      ${close_}`;
    }

    /* 보딩패스형 (첫밤·찰칵) — xl(180) = 이벤트, 설명 한 줄 추가 */
    const xl = opt.size === 'xl';
    const grid = `<div class="g">
          <div><i>DATE</i><b>${dt}</b></div>
          <div><i>TIME</i><b>${m.s || ''}</b></div>
          <div><i>PLACE</i><b>${m.place || ''}</b></div>
        </div>`;
    const body  = sm
      ? `<div class="nm">${TUNEL.title(m)} · ${tbd ? (m.data?.tbdtxt || '날짜 조율 중') : TUNEL.fmt(m.d, m.dow)}</div>`
      : `<div class="nm">${TUNEL.title(m)} · ${m.line_name || ''}</div>
        ${xl && m.memo ? `<div class="desc">${m.memo}</div>` : ''}
        ${grid}`;
    return `${open_(`btk${sk.flat ? ' ' + sk.flat : ''}${sm ? ' sm' : xl ? ' xl' : ''}`)}
      ${sk.flat ? '<span class="flat"></span>' : `<img src="${card}" alt="">`}
      <div class="perf" style="background:repeating-linear-gradient(180deg,${sk.perf} 0 5px,transparent 5px 10px)"></div>
      <div class="ov" style="color:${sk.ink}">
        <div class="lbl" style="color:${sk.lbl}">TÜNEL BOARDING PASS</div>
        <div class="route" style="font-family:${sk.rFont};font-size:${sm ? sk.rSm : xl ? (sk.rXl || sk.rMd) : sk.rMd}px">
          <b>일상</b><span class="d"></span><b style="color:${sk.acc}">${m.data?.dest || m.line_short || sk.short}</b></div>
        ${body}
        <div class="stub">${opt.stub || ''}</div>
      </div>
    ${close_}`;
  },

  /* 티켓 상세 아코디언 — 주소·메모·참가비·2차 + 지도·캘린더.
     티켓의 onclick 에 TUNEL.ticketToggle(this) 를 걸고,
     티켓(과 신청 바) 뒤에 이 HTML 을 붙이면 된다 */
  ticketDetail(m, opt = {}){
    TUNEL._dt[m.id] = m;
    const mapq = m.data?.mapq || m.addr || m.place || '';
    const sp = m.data?.special || null;              // {label, text} — 이번 회차만의 안내
    const rt = m.data?.route || null;                // {img, tip} — 찾아오는 길
    /* 노선 페이지 안에서는 상대경로, 허브에서는 노선 폴더 기준으로 읽는다 */
    const rtImg = rt && rt.img ? (/^(https?:|\/)/.test(rt.img) ? rt.img
      : (m.line_path ? m.line_path.replace(/\/$/, '') + '/' : '') + rt.img) : '';
    const st = (d,t) => d.replace(/-/g,'') + 'T' + String(t||'').replace(':','') + '00';
    /* 구글 캘린더 링크 — 첫밤 googleCal() 과 같은 구성 */
    const gc = (!m.d || !m.s) ? '' :
      'https://calendar.google.com/calendar/render?' + new URLSearchParams({ action:'TEMPLATE',
        text:`${m.line_name || ''}${m.r ? ` ${m.r}회차` : ''}`.trim() || TUNEL.title(m),
        dates:`${st(m.d, m.s)}/${st(m.d, m.e || m.s)}`,
        details:[m.place, m.fee ? `참가비 ${m.fee}` : ''].filter(Boolean).join('\n'),
        location:m.addr || m.place || '', ctz:'Asia/Seoul' }).toString();
    return `<div class="tnlx">
      ${m.addr ? `<div class="xr">📍 ${m.addr}</div>` : ''}
      ${m.memo ? `<div class="xn">${m.memo}</div>` : ''}
      ${m.fee ? `<div class="xr">참가비 ${m.fee}</div>` : ''}
      ${m.after ? `<div class="xr">2차 · ${m.after} (자율)</div>` : ''}
      ${sp ? `<div class="xspc"><div class="xsl">${sp.label || '특별 회차'}</div><div class="xst">${sp.text || ''}</div></div>` : ''}
      ${rt ? `<div class="xway"><div class="xwh">🚇 찾아오는 길</div>
        ${rt.tip ? `<div class="xwt">${rt.tip}</div>` : ''}
        ${rt.img ? `<a href="${rtImg}" target="_blank" rel="noopener"><img src="${rtImg}" alt="찾아오는 길 안내" loading="lazy"></a>
          <div class="xwc">눌러서 크게 보기</div>` : ''}</div>` : ''}
      ${m.status === 'open' ? `<div class="xapl" data-mid="${m.id}"></div>` : ''}
      ${opt.extra || ''}
      <div class="xb">
        ${mapq ? `<a href="https://map.naver.com/p/search/${encodeURIComponent(mapq)}" target="_blank" rel="noopener">📍 지도</a>` : ''}
        ${m.d && m.s ? `<a onclick="TUNEL.calSave('${m.id}')">📅 캘린더에 저장</a>` : ''}
        ${gc ? `<a href="${gc}" target="_blank" rel="noopener">구글 캘린더</a>` : ''}
        ${opt.more ? `<a href="${opt.more}">${opt.moreLabel || '노선 페이지'} ›</a>` : ''}
      </div>
    </div>`;
  },
  _dt: {},

  /* 캘린더에 저장 (.ics 내려받기) — 첫밤 saveCal() 그대로 */
  calSave(mid){
    const m = TUNEL._dt[mid]; if(!m || !m.d || !m.s) return;
    const st = (d,t) => d.replace(/-/g,'') + 'T' + String(t).replace(':','') + '00';
    const title = `${m.line_name || ''}${m.r ? ` ${m.r}회차` : ''}`.trim() || TUNEL.title(m);
    const desc = [m.place, m.addr, m.fee ? `참가비 ${m.fee}` : '', m.after ? `2차 ${m.after} (자율)` : '']
      .filter(Boolean).join('\\n');
    const ics = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//TUNEL//KR','CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      `UID:tunel-${m.line || 'x'}-${m.d}@tunel.kr`,
      `DTSTAMP:${st(new Date().toISOString().slice(0,10), '00:00')}Z`,
      `DTSTART;TZID=Asia/Seoul:${st(m.d, m.s)}`,
      `DTEND;TZID=Asia/Seoul:${st(m.d, m.e || m.s)}`,
      `SUMMARY:${title}`,
      `LOCATION:${(m.addr || m.place || '').replace(/,/g,'\\,')}`,
      `DESCRIPTION:${desc}`,
      'BEGIN:VALARM','TRIGGER:-P1D','ACTION:DISPLAY',`DESCRIPTION:내일 ${title}`,'END:VALARM',
      'END:VEVENT','END:VCALENDAR'].join('\r\n');
    const blob = new Blob([ics], { type:'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${(m.line_name || 'tunel').replace(/\s/g,'')}_${m.d}.ics`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  },

  /* 티켓을 누르면 바로 다음의 .tnlx 를 여닫는다 (신청 바는 건너뛴다) */
  ticketToggle(el){
    let x = el.nextElementSibling;
    while(x && !x.classList.contains('tnlx')) x = x.nextElementSibling;
    if(!x) return;
    const willOpen = !x.classList.contains('show');
    document.querySelectorAll('.tnlx.show').forEach(o => o.classList.remove('show'));
    if(willOpen){ x.classList.add('show'); TUNEL._fillApplicants(x);
      if(typeof TUNEL.onDetailOpen === 'function'){ try{ TUNEL.onDetailOpen(x); }catch(e){} } }   // 페이지 고유 영역 채우기
  },

  /* 상세를 열면 신청 현황(확정·입금/신청·대기 명단)을 채운다 — 회원에게만 보인다 */
  async _fillApplicants(x){
    const ap = x.querySelector('.xapl');
    if(!ap || ap.dataset.done) return;
    ap.dataset.done = '1';
    const me = await TUNEL.me();
    if(!me){ ap.innerHTML = ''; return; }
    ap.innerHTML = '<div class="xr">🎟 신청 현황 불러오는 중…</div>';
    try{
      const list = await TUNEL.signupList(ap.dataset.mid);
      const grp = { confirmed:[], paid:[], applied:[], waitlist:[] };
      list.forEach(r => { (grp[r.status]||[]).push(r); });
      const nx = a => a.map(p => p.nick).join(' · ');
      const going = grp.confirmed.length + grp.paid.length + grp.applied.length;
      ap.innerHTML = list.length
        ? `<div class="xr">🎟 신청 <b>${going}명</b>${grp.waitlist.length ? ` · 대기 ${grp.waitlist.length}명` : ''}</div>`
          + (grp.confirmed.length ? `<div class="xr xr2">확정 — ${nx(grp.confirmed)}</div>` : '')
          + ((grp.paid.length + grp.applied.length) ? `<div class="xr xr2">입금·신청 중 — ${nx(grp.paid.concat(grp.applied))}</div>` : '')
          + (grp.waitlist.length ? `<div class="xr xr2">대기 — ${nx(grp.waitlist)}</div>` : '')
        : '<div class="xr">🎟 아직 신청자가 없어요 — 첫 번째로 신청해보세요</div>';
    }catch(e){ ap.innerHTML = ''; }
  },

  /* 스터브 기성품 — 페이지들이 똑같이 쓰라고 여기 둔다 */
  stubOpen(m){
    if(m && m.line === 'play')
      return `<div class="bring">${m.kind === 'event' ? 'GO!' : 'GO!'}</div><div class="bsl">STAMP HERE</div>`;
    return `<div class="holo2">모집중<i></i></div><div class="sl">BOARDING</div>`;
  },
  stubSoon(m){
    if(m && m.line === 'play') return `<div class="bring">예정</div>`;
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
.btk .route b{font-weight:400}
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
.btk.xl{height:180px}
.btk.xl .lbl{top:15px}
.btk.xl .route{top:36px}
.btk.xl .nm{top:78px;font-size:11px}
.btk .desc{position:absolute;left:20px;top:99px;width:222px;font-size:9.5px;opacity:.7;line-height:1.45}
.btk.xl .g{top:132px}
.btk.sm{height:100px}
.btk.sm .lbl{top:15px}
.btk.sm .route{top:34px}
.btk.sm .nm{top:64px;font-size:9.5px}
.btk .soon{font-family:'Do Hyeon',sans-serif;font-size:14px;letter-spacing:5px;text-indent:5px;
  color:rgba(236,238,242,.55);text-shadow:0 1px 1px rgba(70,0,6,.6)}
.btk .flat{position:absolute;inset:0;display:block}
.btk.paper .flat{background:linear-gradient(180deg,#FBFAF6,#F2F0E9);border:1px solid #E2DED2;border-radius:inherit}
.btk.paper .ov .lbl{letter-spacing:.16em}
.tnlx{display:none;width:358px;max-width:calc(100% - 24px);margin:-6px auto 16px;padding:12px 15px 13px;
  background:#1C1A1F;color:#E6E0D6;border:1px solid #35313A;border-top:0;border-radius:0 0 9px 9px}
.tnlx *{color:inherit}
.tnlx .xr,.tnlx .xn,.tnlx .xwt,.tnlx .xwc{color:#A79E8F}
.tnlx .xb a{color:#CFC7B8}
.tnlx.show{display:block;animation:tnlxopen .2s ease}
@keyframes tnlxopen{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
.tnlx .xr{font-size:11.5px;color:#A79E8F;line-height:1.7}
.tnlx .xspc{margin-top:10px;background:linear-gradient(180deg,rgba(214,58,58,.14),rgba(214,58,58,.05));
  border:1px solid rgba(214,58,58,.45);border-radius:8px;padding:10px 11px}
.tnlx .xspc .xsl{display:inline-block;font-size:10.5px;font-weight:800;letter-spacing:.04em;color:#F0C9C0;
  background:rgba(214,58,58,.28);border-radius:99px;padding:3px 9px;margin-bottom:6px}
.tnlx .xspc .xst{font-size:12px;color:#E6E0D6;line-height:1.7;white-space:pre-line}
.tnlx .xway{margin-top:10px;background:rgba(255,255,255,.03);border:1px solid #35313A;border-radius:8px;padding:10px 11px}
.tnlx .xway .xwh{font-size:11.5px;font-weight:800;color:#E6E0D6;margin-bottom:5px}
.tnlx .xway .xwt{font-size:11.5px;color:#A79E8F;line-height:1.65;white-space:pre-line}
.tnlx .xway img{width:100%;margin-top:8px;border-radius:6px;background:#fff;display:block}
.tnlx .xway .xwc{font-size:10.5px;color:#A79E8F;opacity:.75;margin-top:5px;text-align:center}
.tnlx .xn{font-size:12px;color:#A79E8F;line-height:1.65;background:rgba(255,255,255,.03);
  border-radius:7px;padding:8px 10px;margin:7px 0}
.tnlx .xb{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}
.tnlx .xb a{border:1px solid #4A453E;background:rgba(255,255,255,.03);color:#CFC7B8;
  border-radius:7px;padding:7px 11px;font-size:11.5px;text-decoration:none;cursor:pointer}
.tnlx .xapl{margin-top:8px;padding-top:8px;border-top:1px solid rgba(244,235,217,.08)}
.tnlx .xr b{color:#E8C36B}
.tnlx .xr2{font-size:11px;opacity:.85}
div.btk .stub{cursor:pointer}
/* ── 스코어카드 (우리끼리 올림픽) ── */
.btk.score{color:#0F1B33}
.btk.score .sov{position:absolute;inset:0;pointer-events:none;
  background:linear-gradient(90deg, rgba(247,246,240,.9) 0 58%, rgba(247,246,240,.55) 78%, rgba(247,246,240,.35) 100%)}
.btk.score .sperf{position:absolute;left:258px;top:0;bottom:0;width:2px;
  background:repeating-linear-gradient(180deg,rgba(46,100,216,.5) 0 5px,transparent 5px 10px)}
.btk.score .in{position:absolute;inset:0;z-index:2;padding:13px 16px}
.btk.score .no{font-family:'Nanum Gothic Coding',monospace;font-size:8.5px;letter-spacing:2px;color:#5B7BB8}
.btk.score .snm{font-family:'Gugi',cursive;letter-spacing:.5px;color:#12224A;font-size:23px;margin-top:5px}
.btk.score.sm .snm{font-size:17px;margin-top:4px}
.btk.score .sub2{font-size:10.5px;color:#3B4A6B;margin-top:5px}
.btk.score .sg{position:static;margin-top:12px;width:214px;grid-template-columns:1fr 1fr 1fr;gap:1px 10px}
.btk.score .sg i{color:#5B7BB8;font-size:7.5px;opacity:1}
.btk.score .sg b{color:#12224A;font-size:12.5px}
.btk.score .stub.s2{gap:5px}
.btk.score .stamp{width:60px;height:60px;border-radius:50%;border:2.5px dashed rgba(46,100,216,.55);color:#1B3C86;
  display:grid;place-items:center;font-weight:800;font-size:11px;transform:rotate(-8deg);text-align:center;line-height:1.2}
.btk.score.sm .stamp{width:48px;height:48px;font-size:10px}
.btk.score .ssl{font-size:7px;letter-spacing:1.5px;color:#5B7BB8;font-weight:800}
/* ── 각인 메탈 (방구석 디스코드) ── */
.btk.metal{background:#2b2f33}
.btk.metal>img{opacity:.95}
.btk.metal .gl{position:absolute;inset:0;pointer-events:none;
  background:linear-gradient(104deg,transparent 30%,rgba(255,255,255,.16) 45%,transparent 58%)}
.btk.metal .etch{position:absolute;inset:0;color:#cfd6db}
.btk.metal .mlbl{position:absolute;left:20px;top:14px;font-family:'IBM Plex Mono',monospace;font-size:8px;letter-spacing:2.5px;
  color:#8b949b;text-shadow:0 1px 0 rgba(255,255,255,.7),0 -1px 1px rgba(0,0,0,.5)}
.btk.metal .rt{position:absolute;left:20px;top:31px;font-family:'IBM Plex Sans KR',sans-serif;font-weight:200;letter-spacing:3px;
  font-size:23px;color:#5e666d;text-shadow:0 1px 0 rgba(255,255,255,.8),0 -1px 1px rgba(0,0,0,.6)}
.btk.metal.sm .rt{top:29px;font-size:17px}
.btk.metal .evt{position:absolute;left:20px;top:74px;font-family:'IBM Plex Sans KR',sans-serif;font-weight:300;
  letter-spacing:.5px;font-size:10px;color:#6d757c;text-shadow:0 1px 0 rgba(255,255,255,.65),0 -1px 1px rgba(0,0,0,.45)}
.btk.metal .when{position:absolute;left:20px;bottom:14px;font-family:'IBM Plex Sans KR',sans-serif;font-weight:300;
  letter-spacing:.5px;font-size:10px;color:#6d757c;text-shadow:0 1px 0 rgba(255,255,255,.65),0 -1px 1px rgba(0,0,0,.45)}
.btk.metal.sm .when{font-size:9.5px;bottom:12px}
.btk.metal .laser{position:absolute;left:258px;top:0;bottom:0;width:2px;
  background:repeating-linear-gradient(180deg,rgba(0,0,0,.45) 0 4px,rgba(255,255,255,.5) 4px 5px,transparent 5px 9px)}
.btk.metal .stub.m2{gap:5px}
.btk.metal .code{font-family:'IBM Plex Mono',monospace;color:#2f9e7e;letter-spacing:2px;font-size:14px;
  text-shadow:0 0 6px rgba(47,158,126,.45),0 1px 0 rgba(255,255,255,.5);
  border:1px solid rgba(47,158,126,.5);padding:6px 8px}
.btk.metal.sm .code{font-size:11px;padding:4px 6px}
.btk.metal .mstx{font-family:'IBM Plex Mono',monospace;font-size:8px;color:#2f9e7e;
  text-shadow:0 1px 0 rgba(255,255,255,.4);border:1px solid rgba(47,158,126,.4);padding:5px 4px}
/* ── 놀이터 밴드 스킨 (승인 시안 그대로) ── */
.btk.band .bdim{position:absolute;inset:0;z-index:3;pointer-events:none;
  background:linear-gradient(115deg, rgba(8,16,10,.84) 0%, rgba(8,16,10,.68) 45%, rgba(8,16,10,.45) 75%, rgba(8,16,10,.25) 100%)}
.btk.band .bov{z-index:4;color:#FCFFF6;text-shadow:0 1px 3px rgba(0,0,0,.75)}
.btk.band .blbl{position:absolute;left:20px;top:13px;font-size:7.5px;letter-spacing:2.5px;font-weight:800;color:#EDE3B8}
.btk.band .bline{position:absolute;left:20px;width:225px;font-family:'Dongle',sans-serif;font-weight:700;
  line-height:.78;color:#EFFFE6;letter-spacing:.5px;text-shadow:0 1px 2px rgba(0,0,0,.55);top:31px;font-size:33px}
.btk.band .bnm{position:absolute;left:20px;font-size:11px;opacity:.95;top:72px}
.btk.band .bdesc{position:absolute;left:20px;width:225px;font-size:9.5px;opacity:.8;line-height:1.5}
.btk.band .g.bg2{top:99px}
.btk.band .g i{opacity:.75}
.btk.band .stub.bstub{background:rgba(0,0,0,.22);gap:6px}
.btk.band .bring{width:56px;height:56px;border-radius:50%;border:2.5px dashed rgba(255,255,255,.75);
  display:grid;place-items:center;font-family:'Dongle',sans-serif;font-weight:700;font-size:24px;color:#FCFFF6;
  text-shadow:0 1px 2px rgba(0,0,0,.6);transform:rotate(-8deg);line-height:1;padding-top:3px}
.btk.band .bsl{font-size:6.5px;letter-spacing:1.5px;font-weight:800;color:rgba(255,255,255,.75)}
.btk.band.sm .bline{top:27px;font-size:27px}
.btk.band.sm .bnm{top:64px;font-size:10px}
.btk.band.sm .bring{width:44px;height:44px;font-size:19px}
.btk.band.xl .bline{top:29px}
.btk.band.xl .bnm{top:69px}
.btk.band.xl .bdesc{top:95px}
.btk.band.xl .g.bg2{top:122px}
.btk.band.xl .bring{width:62px;height:62px;font-size:26px}
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
  /* 내 신청 상태를 티켓 스텁에 찍는다 — 허브·노선 페이지 공통 */
  function paintStubs(){
    document.querySelectorAll('.sstub').forEach(el => {
      const mid = el.dataset.mid, st = mine[mid] || null;
      const m = byId[mid] || {};
      const sk = TUNEL._skins[m.line] || {};
      const dd = (el.dataset.d || '').slice(5).replace('-', '.');
      const dest = sk.stampDest || m.line_short || sk.short || '탑승';   // 도장에 찍는 행선지(티켓 노선 표기와 별개)
      if(st === 'confirmed')
        el.innerHTML = `${sk.stamp ? `<img src="${sk.stamp}" alt="">` : ''}<div class="stx">${dest}<small>${dd}</small></div><div class="sl">STAMPED</div>`;
      else if(st === 'paid' || st === 'applied')
        el.innerHTML = `${sk.stamp ? `<img src="${sk.stamp}" alt="" style="opacity:.55">` : ''}<div class="stx">${dest}<small>${dd}</small></div><div class="sl">${st === 'paid' ? '입금 확인 중' : '입금 전'}</div>`;
      else if(st === 'waitlist')
        el.innerHTML = `<div class="holo2">대기중<i></i></div><div class="sl">WAITLIST</div>`;
      else
        el.innerHTML = TUNEL.stubOpen(m);
    });
  }
  TUNEL.stubPaint = paintStubs;
  TUNEL.signupRefresh = async function(){
    await loadMine();
    document.querySelectorAll('.tnlbar').forEach(paintBar);
    paintStubs();
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
