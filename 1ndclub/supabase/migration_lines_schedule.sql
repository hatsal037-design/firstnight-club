-- 예정·지난 일정 이관 (schedule.js → meetings)
insert into public.meetings (line,d,dow,s,e,r,kind,name,place,addr,fee,"after",memo,status,data) values
  ('botc','2026-08-29','토','13:00','19:00',4,'regular',null,'서울갤러리 동그라미방','서울 중구 세종대로 110',null,null,'6시간 회차 · 긴 게임 돌리기 좋아요','planned','{"h":6,"cap":null,"mapq":"서울시청 시민청 서울갤러리"}'::jsonb),
  ('botc','2026-09-06','일','13:00','17:00',null,'regular',null,'시디즈 송파 커뮤니티룸','서울 송파구 오금로 235 젬스빌딩 1층',null,'홈즈앤루팡 송파방이점',null,'planned','{"h":4,"cap":12,"mapq":"시디즈 더 프로그레시브 송파"}'::jsonb),
  ('botc','2026-09-12','토','13:00','18:00',null,'regular',null,'서울갤러리 회의실1','서울 중구 세종대로 110',null,null,null,'planned','{"h":5,"cap":null,"mapq":"서울시청 시민청 서울갤러리"}'::jsonb),
  ('botc','2026-09-19','토','13:00','18:00',null,'regular',null,'시디즈 송파 커뮤니티룸','서울 송파구 오금로 235 젬스빌딩 1층',null,'홈즈앤루팡 송파방이점',null,'planned','{"h":5,"cap":12,"mapq":"시디즈 더 프로그레시브 송파"}'::jsonb),
  ('botc','2026-09-26','토','12:00','17:00',null,'regular',null,'서울갤러리 회의실1','서울 중구 세종대로 110',null,null,'다음날 9/27도 있어요','planned','{"h":5,"cap":null,"mapq":"서울시청 시민청 서울갤러리"}'::jsonb),
  ('botc','2026-09-27','일','14:00','19:00',null,'regular',null,'시디즈 합정 커뮤니티룸',null,null,null,null,'planned','{"h":5,"cap":10,"mapq":"시디즈 합정"}'::jsonb),
  ('botc','2026-10-17','토','14:00','19:00',null,'regular',null,'시디즈 성수 커뮤니티룸',null,null,null,null,'planned','{"h":5,"cap":12,"mapq":"시디즈 성수"}'::jsonb),
  ('botc','2026-10-25','일','11:00','15:00',null,'regular',null,'시디즈 합정 커뮤니티룸',null,null,null,null,'planned','{"h":4,"cap":10,"mapq":"시디즈 합정"}'::jsonb),
  ('botc','2026-10-31','토','14:00','19:00',null,'regular',null,'시디즈 성수 커뮤니티룸',null,null,null,'🎃 핼러윈 당일! 특별 회차로 준비해볼게요','planned','{"h":5,"cap":12,"mapq":"시디즈 성수"}'::jsonb),
  ('botc','2026-11-07','토','14:00','19:00',null,'regular',null,'시디즈 송파 커뮤니티룸','서울 송파구 오금로 235 젬스빌딩 1층',null,'홈즈앤루팡 송파방이점',null,'planned','{"h":5,"cap":12,"mapq":"시디즈 더 프로그레시브 송파"}'::jsonb),
  ('play','2099-12-31',null,null,null,null,'regular','한강 수건돌리기 맥주 파티','한강 (뚝섬·잠실·반포 중 조율 중)',null,null,null,'개통 이벤트 · 날짜 조율 중','planned','{"tbd":true,"note":"개통 이벤트 · 날짜 조율 중"}'::jsonb),
  ('library','2026-08-17','월','11:00','14:00',null,'regular','AI 나눔회 1회차','시디즈 성수 커뮤니티룸',null,null,null,null,'done','{}'::jsonb)
on conflict (line,d) do nothing;
