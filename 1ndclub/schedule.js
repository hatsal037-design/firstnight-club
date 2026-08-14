/* 첫밤 사망자 클럽 — 회차 일정
   대관이 확정된 회차만 넣는다. 취소되면 지우고, 새로 잡히면 추가.

   필드
     r      회차 번호 (미정이면 null)
     d      날짜 'YYYY-MM-DD'
     dow    요일
     s / e  시작·종료 시각
     h      이용 시간(시간)
     place  장소 이름
     addr   주소 (모르면 '')
     mapq   지도 검색어
     cap    정원
     st     상태 — open(모집중) | soon(예정) | done(완료)
     fee    참가비 안내 (없으면 '')
     note   한 줄 메모
     after  2차 후보 (없으면 null)
*/

const ROUNDS = [
  { r:3, d:'2026-08-15', dow:'토', s:'11:00', e:'15:00', h:4, st:'open',
    place:'시디즈 송파 커뮤니티룸', addr:'서울 송파구 오금로 235 젬스빌딩 1층',
    mapq:'시디즈 더 프로그레시브 송파', cap:12,
    fee:'12,000원 (얼리버드 선착순 6명 10,200원)',
    note:'방이역 3번 출구 도보 12분 · 간단한 다과 준비돼요',
    munto:'https://www.munto.kr/ko/socialing?id=670027',
    after:'홈즈앤루팡 송파방이점' },

  { r:null, d:'2026-08-29', dow:'토', s:'13:00', e:'19:00', h:6, st:'soon',
    place:'서울갤러리 동그라미방', addr:'서울 중구 세종대로 110',
    mapq:'서울시청 시민청 서울갤러리', cap:null, fee:'',
    note:'6시간 회차 · 긴 게임 돌리기 좋아요', after:null },

  { r:null, d:'2026-09-06', dow:'일', s:'13:00', e:'17:00', h:4, st:'soon',
    place:'시디즈 송파 커뮤니티룸', addr:'서울 송파구 오금로 235 젬스빌딩 1층',
    mapq:'시디즈 더 프로그레시브 송파', cap:12, fee:'',
    note:'', after:'홈즈앤루팡 송파방이점' },

  { r:null, d:'2026-09-12', dow:'토', s:'13:00', e:'18:00', h:5, st:'soon',
    place:'서울갤러리 회의실1', addr:'서울 중구 세종대로 110',
    mapq:'서울시청 시민청 서울갤러리', cap:null, fee:'', note:'', after:null },

  { r:null, d:'2026-09-19', dow:'토', s:'13:00', e:'18:00', h:5, st:'soon',
    place:'시디즈 송파 커뮤니티룸', addr:'서울 송파구 오금로 235 젬스빌딩 1층',
    mapq:'시디즈 더 프로그레시브 송파', cap:12, fee:'',
    note:'', after:'홈즈앤루팡 송파방이점' },

  { r:null, d:'2026-09-26', dow:'토', s:'12:00', e:'17:00', h:5, st:'soon',
    place:'서울갤러리 회의실1', addr:'서울 중구 세종대로 110',
    mapq:'서울시청 시민청 서울갤러리', cap:null, fee:'',
    note:'다음날 9/27도 있어요', after:null },

  { r:null, d:'2026-09-27', dow:'일', s:'14:00', e:'19:00', h:5, st:'soon',
    place:'시디즈 합정 커뮤니티룸', addr:'',
    mapq:'시디즈 합정', cap:10, fee:'', note:'', after:null },

  { r:null, d:'2026-10-17', dow:'토', s:'14:00', e:'19:00', h:5, st:'soon',
    place:'시디즈 성수 커뮤니티룸', addr:'',
    mapq:'시디즈 성수', cap:12, fee:'', note:'', after:null },

  { r:null, d:'2026-10-25', dow:'일', s:'11:00', e:'15:00', h:4, st:'soon',
    place:'시디즈 합정 커뮤니티룸', addr:'',
    mapq:'시디즈 합정', cap:10, fee:'', note:'', after:null },

  { r:null, d:'2026-10-31', dow:'토', s:'14:00', e:'19:00', h:5, st:'soon',
    place:'시디즈 성수 커뮤니티룸', addr:'',
    mapq:'시디즈 성수', cap:12, fee:'',
    note:'🎃 핼러윈 당일! 특별 회차로 준비해볼게요', after:null },

  { r:null, d:'2026-11-07', dow:'토', s:'14:00', e:'19:00', h:5, st:'soon',
    place:'시디즈 송파 커뮤니티룸', addr:'서울 송파구 오금로 235 젬스빌딩 1층',
    mapq:'시디즈 더 프로그레시브 송파', cap:12, fee:'',
    note:'', after:'홈즈앤루팡 송파방이점' },
];
