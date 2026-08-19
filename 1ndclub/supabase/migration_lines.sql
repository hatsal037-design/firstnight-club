-- ══════════════════════════════════════════════════════════════
-- 투넬 통합 구조 1단계 — 노선 · 회차 · 참석
--
-- 결정 사항
--   · 운영진은 노선 구분 없이 통합 관리 (전역 staff/admin)
--   · 회원이 아닌 게스트 참석자도 기록에 남긴다
--   · 참석 기록은 로그인 회원끼리 서로 보인다
--
-- 이 파일은 한 번만 실행한다. 여러 번 돌려도 안전하도록 짰지만
-- 이관(4번) 단계는 중복 삽입을 막기 위해 on conflict 로 걸러진다.
-- ══════════════════════════════════════════════════════════════

-- ── 1. 노선 마스터 ──────────────────────────────────────────
create table if not exists public.lines (
  id      text primary key,              -- 슬러그. 한번 정하면 안 바꾼다
  no      int  not null unique,          -- 플랫폼 번호
  name    text not null,
  path    text not null,                 -- 페이지 경로 (허브 기준 상대)
  skin    text not null,                 -- 티켓/카드 CSS 클래스
  status  text not null default '개통준비',
  sort    int  not null default 0
);

insert into public.lines (id, no, name, path, skin, status, sort) values
  ('play',    1, '어른이 놀이터',        'play/',    'play',   '개통준비', 1),
  ('botc',    2, '첫밤 사망자 클럽',      '1ndclub/', 'night',  '운행중',   2),
  ('snap',    3, '찰칵 나들이',          'snap/',    'snap',   '공사중',   3),
  ('view',    4, '오늘의 관람',          'view/',    'view',   '개관준비', 4),
  ('sport',   5, '우리끼리 올림픽',       'sport/',   'sport',  '개회준비', 5),
  ('library', 6, '낭만 스터디',          'library/', 'lib',    '운행중',   6),
  ('cyber',   7, '방구석 디스코드',       'cyber/',   'cyber',  '접속대기', 7),
  ('craft',   8, '뚝딱뚝딱 꼼지락 클럽',  'craft/',   'craft',  '빚는중',   8)
on conflict (id) do update
  set no=excluded.no, name=excluded.name, path=excluded.path,
      skin=excluded.skin, status=excluded.status, sort=excluded.sort;

-- ── 2. 회차 — 예정이든 지난 것이든 한 테이블 ────────────────
create table if not exists public.meetings (
  id      uuid primary key default gen_random_uuid(),
  line    text not null references public.lines(id) on delete restrict,
  d       date not null,
  dow     text,
  s       text,
  e       text,
  r       int,                            -- 회차 번호 (번개·특별회차면 null)
  kind    text not null default 'regular',-- regular · flash · class · online …
  name    text,                           -- 회차 이름. 없으면 화면에서 노선 기본값
  place   text,
  addr    text,
  fee     text,
  after   text,
  memo    text,
  status  text not null default 'planned' -- open 모집중 · planned 예정 · done 완료 · cancelled 취소
          check (status in ('open','planned','done','cancelled')),
  data    jsonb not null default '{}',    -- 노선 고유 필드 (첫밤 played 등)
  created_at timestamptz not null default now(),
  unique (line, d)                        -- 한 노선에 하루 한 회차
);

create index if not exists meetings_line_d_idx on public.meetings (line, d desc);
create index if not exists meetings_d_idx      on public.meetings (d desc);

-- ── 3. 참석 ─────────────────────────────────────────────────
create table if not exists public.attendance (
  id         uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  member_id  uuid references public.members(id) on delete set null,
  guest_name text,                        -- 회원이 아닌 참석자
  role       text not null default 'guest'
             check (role in ('guest','host','scribe')),
  created_at timestamptz not null default now(),
  -- 회원이거나 게스트거나 둘 중 하나여야 한다
  constraint attendance_who check (member_id is not null or guest_name is not null)
);

-- 같은 회차에 같은 회원이 두 번 들어가지 않게
create unique index if not exists attendance_member_uniq
  on public.attendance (meeting_id, member_id) where member_id is not null;
create unique index if not exists attendance_guest_uniq
  on public.attendance (meeting_id, guest_name) where member_id is null;
create index if not exists attendance_member_idx on public.attendance (member_id);

-- ── 4. 기존 첫밤 기록 이관 ──────────────────────────────────
-- past_meetings → meetings (played 는 data 안으로)
insert into public.meetings (line, d, dow, s, e, r, kind, place, addr, fee, after, memo, status, data)
select 'botc', pm.d, pm.dow, pm.s, pm.e, pm.r,
       coalesce(pm.kind, 'regular'),
       pm.place, pm.addr, pm.fee, pm.after, pm.memo,
       'done',
       jsonb_build_object('played', coalesce(pm.played, '[]'::jsonb))
from public.past_meetings pm
on conflict (line, d) do nothing;

-- people 배열 → attendance
--   객체 {uid,label} 이면 회원, 문자열이면 게스트 이름
insert into public.attendance (meeting_id, member_id, guest_name)
select m.id,
       case when jsonb_typeof(p) = 'object'
            then nullif(p->>'uid','')::uuid end,
       case when jsonb_typeof(p) = 'string'
            then nullif(p #>> '{}', '') end
from public.past_meetings pm
join public.meetings m on m.line = 'botc' and m.d = pm.d
cross join lateral jsonb_array_elements(coalesce(pm.people,'[]'::jsonb)) as p
where jsonb_typeof(p) in ('object','string')
on conflict do nothing;

-- 회원 아이디가 이미 사라진 경우(계정 삭제 등) 게스트 이름으로 살려둔다
update public.attendance a
   set member_id = null,
       guest_name = coalesce(a.guest_name, '(탈퇴 회원)')
 where a.member_id is not null
   and not exists (select 1 from public.members mm where mm.id = a.member_id);

-- ── 5. RLS ──────────────────────────────────────────────────
alter table public.lines      enable row level security;
alter table public.meetings   enable row level security;
alter table public.attendance enable row level security;

-- 노선 — 누구나 읽고, 관리자만 고친다
drop policy if exists lines_read  on public.lines;
drop policy if exists lines_write on public.lines;
create policy lines_read  on public.lines for select using (true);
create policy lines_write on public.lines for all
  using (public.my_is_admin()) with check (public.my_is_admin());

-- 회차 — 누구나 읽고, 운영진이 쓴다 (노선 구분 없음)
drop policy if exists meetings_read   on public.meetings;
drop policy if exists meetings_write  on public.meetings;
create policy meetings_read  on public.meetings for select using (true);
create policy meetings_write on public.meetings for all
  using (public.my_is_staff()) with check (public.my_is_staff());

-- 참석 — 로그인 회원끼리 서로 보인다. 쓰기는 운영진
drop policy if exists attendance_read  on public.attendance;
drop policy if exists attendance_write on public.attendance;
create policy attendance_read  on public.attendance for select
  using (public.my_member_id() is not null);
create policy attendance_write on public.attendance for all
  using (public.my_is_staff()) with check (public.my_is_staff());

-- ── 6. 화면이 쓰는 뷰 ───────────────────────────────────────
-- 회차 + 노선 정보를 한 번에. 참석 인원수도 같이 센다
create or replace view public.v_meetings as
select m.*,
       l.no   as line_no,
       l.name as line_name,
       l.path as line_path,
       l.skin as line_skin,
       (select count(*) from public.attendance a where a.meeting_id = m.id) as att_count
from public.meetings m
join public.lines l on l.id = m.line;

-- 참석 기록 + 회차 + 노선. 통합홈은 필터 없이, 노선은 line 으로 걸러 쓴다
create or replace view public.v_attendance as
select a.id,
       a.meeting_id,
       a.member_id,
       a.guest_name,
       a.role,
       coalesce(mem.nick, a.guest_name) as who,
       m.line, m.d, m.dow, m.s, m.e, m.r, m.kind, m.name, m.place, m.status, m.data,
       l.no   as line_no,
       l.name as line_name,
       l.path as line_path,
       l.skin as line_skin
from public.attendance a
join public.meetings m on m.id = a.meeting_id
join public.lines    l on l.id = m.line
left join public.members mem on mem.id = a.member_id;

-- 내 활동 요약 — 노선별 참석 횟수
create or replace function public.my_activity_summary()
returns table (line text, line_no int, line_name text, cnt bigint, first_d date, last_d date)
language sql stable security definer set search_path = public as $$
  select m.line, l.no, l.name, count(*), min(m.d), max(m.d)
  from public.attendance a
  join public.meetings m on m.id = a.meeting_id
  join public.lines    l on l.id = m.line
  where a.member_id = public.my_member_id()
  group by m.line, l.no, l.name
  order by l.no
$$;

grant select on public.v_meetings, public.v_attendance to anon, authenticated;
grant execute on function public.my_activity_summary() to authenticated;

-- ── 확인용 ──────────────────────────────────────────────────
-- select count(*) from meetings where line='botc';
-- select count(*) from attendance;
-- select * from my_activity_summary();
