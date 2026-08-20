-- ══════════════════════════════════════════════════════════════
-- 뷰가 RLS 를 건너뛰던 문제 수정 (2026-08-20)
--
-- Postgres 뷰는 기본이 SECURITY DEFINER 라, 조회하는 사람이 아니라
-- 뷰를 만든 사람의 권한으로 돈다. 그래서 attendance 에 걸어둔
-- "로그인 회원만 읽기" 정책이 v_attendance 를 통하면 무력화됐다.
-- 실제로 비로그인 상태에서 누가 언제 어느 모임에 왔는지 닉네임까지 조회됐다.
--
-- Supabase 보안 점검(get_advisors)에서 잡힌 건이다.
-- 스키마를 건드린 뒤에는 이 점검을 돌려볼 것.
-- ══════════════════════════════════════════════════════════════

-- 조회자 권한으로 돌게 바꾼다 → 뷰에도 RLS 가 그대로 적용된다
alter view public.v_attendance set (security_invoker = on);
alter view public.v_meetings   set (security_invoker = on);

-- 다만 참석 "인원수"는 공개해도 되는 정보다 (티켓에 12명·9명으로 표시).
-- 뷰가 invoker 로 바뀌면 비로그인 사용자는 0 으로 세게 되므로,
-- 숫자만 세는 함수를 definer 로 따로 두어 명단은 감추고 수만 공개한다.
create or replace function public.meeting_att_count(p_meeting uuid)
returns bigint
language sql stable security definer set search_path = public as $$
  select count(*) from public.attendance where meeting_id = p_meeting
$$;

create or replace view public.v_meetings as
select m.*,
       l.no   as line_no,
       l.name as line_name,
       l.path as line_path,
       l.skin as line_skin,
       public.meeting_att_count(m.id) as att_count
from public.meetings m
join public.lines l on l.id = m.line;

alter view public.v_meetings set (security_invoker = on);

grant select   on public.v_meetings, public.v_attendance to anon, authenticated;
grant execute  on function public.meeting_att_count(uuid) to anon, authenticated;

-- ── 확인 ────────────────────────────────────────────────────
-- 비로그인(anon 키)으로:
--   v_attendance  → permission denied  (명단 안 보임, 정상)
--   v_meetings    → 조회됨, att_count 는 실제 인원수 (정상)
