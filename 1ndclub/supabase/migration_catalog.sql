-- ══ 회원 활동 통합 1단계 — 항목 계층 (2026-08-20 적용됨) ══
-- 원칙: 값을 적지 말고 가리켜라. 자연키(line+key)로 언제든 복구 가능하게.
-- 설계: 브랜드/회원활동_설계.md
-- 실제 적용은 Supabase 마이그레이션 catalog_items_schema · catalog_export_views 로 됐다.
-- 이 파일은 기록용. 새 환경에 깔 때 이 순서로 실행하면 같은 상태가 된다.

-- (1) catalog_items · meeting_items · member_items 테이블 + RLS + item_fav_count()
-- (2) games.js 36종 → catalog_items (키 매핑 포함)
-- (3) favs/game_owners/played/picks → 참조 이관
-- (4) x_* 내보내기 뷰 (자연키만, security_invoker)

-- 전체 SQL 은 Supabase 대시보드 > Database > Migrations 에서 확인.
-- 항목 자연키 매핑(한번 정하면 안 바꾼다):
--   mafia secret-hitler avalon spyfall2 saboteur hitster great-dalmuti flip7
--   animal-realm cockroach-poker zogen kezao partysaurus-20s five-towers
--   goodface-badface word-capture taco-cat-goat-cheese-pizza halli-galli
--   ghost-blitz serpentina abraca-what clue code-777 carcassonne splendor
--   catan catan-card rummikub harmonies bomb-busters sangja-ai quoridor
--   chess-mini the-gang the-mind sageon-jaeguseong
