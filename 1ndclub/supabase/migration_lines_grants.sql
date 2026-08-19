-- 테이블 접근 권한. 실제 접근제어는 RLS 정책이 한다
grant select on public.lines, public.meetings, public.attendance to anon, authenticated;
grant insert, update, delete on public.meetings, public.attendance to authenticated;
grant insert, update, delete on public.lines to authenticated;
