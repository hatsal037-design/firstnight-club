-- 회원 등급에 '정지' 추가
-- Supabase 대시보드 → SQL Editor에 붙여넣고 실행하면 됩니다. 한 번만 실행하면 돼요.
--
-- 정지된 회원은 로그인과 조회는 되지만 쓰기가 전부 막힙니다.
-- 참석 신청·게임 고르기·기록 작성·프로필 수정·좋알람 — 서버가 거부합니다.
-- 방법은 단순합니다. 정책마다 조건을 붙이는 대신, "나는 누구인가"를 답하는
-- my_member_id()가 정지 회원에게는 아무도 아니라고 답하게 만듭니다.

-- 1) role 값에 'banned' 허용
alter table public.members drop constraint if exists members_role_check;
alter table public.members add constraint members_role_check
  check (role is null or role in ('staff','banned'));

-- 2) 정지 회원은 쓰기 주체가 되지 못한다 (조회 정책은 그대로 열려 있음)
create or replace function public.my_member_id() returns uuid
language sql stable security definer set search_path = public as
$$ select id from members
   where auth_id = auth.uid() and role is distinct from 'banned' $$;

-- 3) 앱에서 "나 정지됐나"를 물어볼 때 쓰는 헬퍼
create or replace function public.my_is_banned() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce((select role = 'banned' from members where auth_id = auth.uid()), false) $$;

grant execute on function public.my_is_banned to authenticated;

-- 되돌리려면
--   alter table public.members drop constraint members_role_check;
--   alter table public.members add constraint members_role_check check (role in ('staff'));
--   create or replace function public.my_member_id() returns uuid
--   language sql stable security definer set search_path = public as
--   $$ select id from members where auth_id = auth.uid() $$;
