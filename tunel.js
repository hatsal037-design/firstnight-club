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
    const tbd  = m.data?.tbd === true;
    const when = tbd ? '날짜 조율 중'
      : `${+m.d.slice(5,7)}/${+m.d.slice(8)} <small style="font-size:12px">(${m.dow||''})</small>`;
    const time = tbd ? '' : (m.s ? m.s + (m.e ? '~' + m.e : '') : '');
    const href = opt.href ?? m.line_path;
    const place = m.place || '';
    const att = past && m.att_count ? ` · ${m.att_count}명` : '';
    return `
    <a class="tkt ${m.line_skin}${past ? ' past' : ''}" href="${href}">
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
  }
};

global.TUNEL = TUNEL;
})(window);
