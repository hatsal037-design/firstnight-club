-- 즐겨찾기를 서버(회원 행)에 저장 — "몇 명이 담았나" 집계 + 인기순 정렬용.
-- members에 favs 칸 추가하고, 본인이 자기 favs만 고칠 수 있게 권한 부여.
-- 마지막 줄: PostgREST 스키마 캐시를 즉시 새로고침(칸 추가 직후 인식 안 되는 문제 방지).
alter table public.members add column if not exists favs jsonb not null default '[]';
grant update (favs) on public.members to authenticated;
notify pgrst, 'reload schema';
