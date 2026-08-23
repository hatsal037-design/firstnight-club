/* 첫밤 사망자 클럽 — 상태·설정 — 다른 파일이 모두 읽는 값. 반드시 맨 먼저 실행된다
   index.html 한 파일에 있던 것을 2026-08-23에 나눴다.
   순수 스크립트라 전역이 그대로 이어진다 — index.html 의 실행 순서를 바꾸지 말 것. */
/* ══ 상태 ══ */
const RKEY='botc_past_edit';
const CHAT_LINK = 'https://open.kakao.com/o/g0V0gzEi';   // 클럽 오픈채팅 (공통)
const ADMINS = ['투넬'];                       // 관리자 닉네임
/* 관리자 비번은 원문을 두지 않고 SHA-256 해시만 둔다.
   ※ 정적 HTML이라 소스를 보면 구조가 다 보인다. 이 잠금은 참가자 화면에서 관리자 UI를
     감추는 용도이지 보안장치가 아니다. */
const ADMIN_HASH = '743e7841942f0114c9ca60aa5742af91fae437bac9161fb88b595f368f12c930';

let acc   = null;                              // 로그인한 계정 (서버에서 받아온 것)
/* 도감에서 이름이 바뀐 게임 — 서버에 옛 이름으로 저장된 즐겨찾기·선택·플레이 기록을 새 이름으로 읽는다.
   (games.js 의 old:[…] 에서 자동으로 만든다. 저장은 늘 새 이름으로 되므로 시간이 지나면 자연히 정리된다) */
const NAME_FIX = Object.fromEntries(GAMES.flatMap(g=>(g.old||[]).map(o=>[o,g.n])));
const fixName  = n => NAME_FIX[n] || n;
const fixNames = a => [...new Set((a||[]).map(fixName))];
let PENDING_APPLY = new URLSearchParams(location.search).get('apply') || null;   // ?apply=날짜 로 들어오면 그 회차 신청까지 연다
let favs  = [];                                // 즐겨찾기 — 이 기기에만 저장
let picks = fixNames(JSON.parse(localStorage.getItem('botc_picks_anon')||'[]'));   // 로그인 전에는 이 기기, 로그인하면 서버
let edits = JSON.parse(localStorage.getItem(RKEY)||'{}');   // 서버 이전 시절의 로컬 기록(백업용)
let serverPast = [];        // 서버에 저장된 지난 모임 기록 — 시작할 때 불러온다
let NOTICES = [];           // 서버 공지 전체
let readIds = [];           // 내가 읽은 공지 id
let MEMBERS = [];           // 전체 회원 — @태그(uid)를 현재 닉네임으로 바꿔 보여줄 때 쓴다
let OWNERS = {};            // {게임이름: uid} — 관리자가 지정한 게임 소유자 (서버)
let myRsvp = null;          // 모집중 회차 참석 여부 'yes'|'no'|null
let rsvpCnt = {yes:0,no:0};
let rsvpYesNames = [];
let rsvpYesList = [];   // [{uid, nick}] — 프로필 칩용
let cat='all', crew=0, q='', view='games', authTab='login';

const isAdmin = () => !!acc && acc.admin;
/* 운영진 — 관리자가 지정. 게임 소유자 열람·회원 목록 열람만 되고, 수정·삭제 같은 관리 조작은 여전히 관리자만 */
const isStaff = () => !!acc && (acc.admin || acc.role==='staff');
/* 서기 — 참석 10회에 "깨어날 준비" 알림이 뜨고, 관리자가 승인하면 지난모임 기록 권한이 생긴다.
   운영진·관리자는 원래 기록이 되니 서기 여부와 무관 */
const canRecord = () => isStaff() || !!acc?.scribe;
const SCRIBE_MIN = 10;
const myNames = () => acc ? [acc.nick, ...(acc.aliases||[])] : [];

const TODAY = TUNEL.todayKST();   /* 서울 기준 오늘 자정 — 해외에서 봐도 하루가 안 밀린다 */
/* 노선 값은 중앙(DB lines + TUNEL._skins)에서 읽는다. 아래는 서버를 못 읽을 때만 쓰는 최소값 */
const LINE_ID = 'botc';
const LINE_FALLBACK = { line:'botc', line_no:2, line_name:'첫밤 사망자 클럽', line_short:'첫밤', line_path:'/1ndclub/' };
const lineInfo = () => (TUNEL.lineSync && TUNEL.lineSync(LINE_ID)) || LINE_FALLBACK;   // 노선 값은 중앙에서
/* 회차는 서버(meetings)가 최종이다. schedule.js 값은 서버를 못 읽을 때만 쓰는 폴백.
   부팅에서 ROUNDS 를 갈아끼운 뒤 recalcRounds() 로 파생값을 다시 만든다.
   폴백도 티켓이 그대로 읽을 수 있게 서버 자료와 같은 모양으로 맞춰 둔다
   (티켓·상세는 회차 객체를 손대지 않고 받는다 — 개발/티켓_규칙.md) */
ROUNDS = ROUNDS.map(r => Object.assign({}, r, {
  id: r.id || ('local-' + r.d),
  status: r.st === 'open' ? 'open' : r.st === 'done' ? 'done'
        : r.st === 'cancelled' ? 'cancelled' : 'planned',
  kind: r.kind || (r.name ? 'event' : 'regular'),
  memo: r.note || '',
  ...(TUNEL.lineSync ? (TUNEL.lineSync(LINE_ID) || LINE_FALLBACK) : LINE_FALLBACK),
  data: { cap: r.cap ?? null, h: r.h ?? null, mapq: r.mapq || null, route: r.route || null, special: r.special || null },
}));
/* 끝났나 판정은 tunel.js 한 곳에서만 한다 — 끝 시각 + 여유 1시간 (TUNEL.isPast) */
let openRound = ROUNDS.find(r=>r.st==='open' && !TUNEL.isPast(r));
let upcoming  = ROUNDS.filter(r=>!TUNEL.isPast(r));
function recalcRounds(){
  openRound = ROUNDS.find(r=>r.st==='open' && !TUNEL.isPast(r));
  upcoming  = ROUNDS.filter(r=>!TUNEL.isPast(r));
}
