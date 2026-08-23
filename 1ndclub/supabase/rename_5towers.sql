-- 도감 게임명 정정: '5타워' → '다섯 개의 탑' (2026-08-23)
-- 잘못 등록돼 있던 항목을 실제 게임(5 Towers · Kasper Lapp · Deep Print Games)으로 바로잡음.
-- 앱은 games.js 의 old:['5타워'] 매핑으로 이미 옛 기록을 읽고 있으므로, 이 SQL은 서버 표기를 맞추는 정리용.
update catalog_items
   set name = '다섯 개의 탑'
 where line = 'botc' and key = 'five-towers' and name = '5타워';

-- 소유자 표(옛 game_owners 는 동결됨 — 참고용)
-- update game_owners set game = '다섯 개의 탑' where game = '5타워';

-- 확인
select id, key, name from catalog_items where line='botc' and key='five-towers';
