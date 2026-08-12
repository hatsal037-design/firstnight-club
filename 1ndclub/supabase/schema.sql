-- ═══════════════════════════════════════════════════════════════
-- 첫밤 사망자 클럽 — Supabase 스키마 v1 (2026-08-12)
-- 대시보드 SQL Editor에 통째로 붙여넣고 Run 한 번이면 끝.
-- 설계 원칙:
--   · 민감정보(오픈톡방닉·카카오번호)는 member_private로 분리 — 본인+운영진만
--   · 모든 표 RLS 잠금, 로그인 안 하면 아무것도 못 읽음
--   · 관리 조작(등급·서기·삭제)은 RPC 함수로만 — 함수 안에서 관리자 여부 재검증
--   · 기존 uid(UUID)를 그대로 id로 이어받아 데이터 이전 시 매핑 불필요
-- ═══════════════════════════════════════════════════════════════

-- ── 회원번호 시퀀스 (kvdb 카운터 이어받기: 이전 후 setval로 맞춤) ──
create sequence if not exists member_no_seq start 1;

-- ═══ 표 ═══

-- 회원 (공개 필드만 — 로그인한 회원끼리 서로 볼 수 있는 것)
create table public.members (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid unique references auth.users(id) on delete set null,
  nick text unique not null,
  aliases jsonb not null default '[]',
  no int unique,
  is_admin boolean not null default false,
  role text check (role in ('staff')),
  scribe boolean not null default false,
  scribe_ready boolean not null default false,
  scribe_hello boolean not null default false,
  joined date not null default current_date,
  joined_at timestamptz not null default now()
);

-- 회원 민감정보 (본인 + 운영진만)
create table public.member_private (
  member_id uuid primary key references public.members(id) on delete cascade,
  payname text,          -- 오픈톡방 닉네임
  kakao text unique      -- 카카오 회원번호 (계정 연결용)
);

-- 프로필 사진 (따로 둬서 회원목록 조회가 무거워지지 않게)
create table public.profiles (
  member_id uuid primary key references public.members(id) on delete cascade,
  pfp text
);

-- 지난 모임
create table public.past_meetings (
  d date primary key,
  dow text, s text, e text,
  r int, kind text,
  place text, addr text, memo text, fee text, after text,
  people jsonb not null default '[]',   -- [{uid,label} | "수기이름"]
  played jsonb not null default '[]'
);

-- 회차별 할 게임 선택
create table public.picks (
  d date not null,
  member_id uuid not null references public.members(id) on delete cascade,
  games jsonb not null default '[]',
  primary key (d, member_id)
);

-- 참석 여부
create table public.rsvps (
  d date not null,
  member_id uuid not null references public.members(id) on delete cascade,
  v text not null check (v in ('yes','no')),
  primary key (d, member_id)
);

-- 게임 소유자
create table public.game_owners (
  game text primary key,
  owner_id uuid references public.members(id) on delete cascade
);

-- 공지
create table public.notices (
  id text primary key default gen_random_uuid()::text,
  title text not null, body text,
  target text not null default 'all',
  round_d date,
  by_id uuid references public.members(id) on delete set null,
  at timestamptz not null default now()
);

-- 읽은 공지
create table public.notice_reads (
  member_id uuid primary key references public.members(id) on delete cascade,
  read_ids jsonb not null default '[]'
);

-- 좋알람 (내용은 해시·암호문뿐 — 서버도 누가 누굴 가리키는지 모름)
create table public.crush (
  member_id uuid primary key references public.members(id) on delete cascade,
  h text, e text, c text,
  ts timestamptz,
  off boolean not null default false
);

-- ═══ 도우미 함수 (정책에서 "나는 누구인가" 판별용) ═══

create or replace function public.my_member_id() returns uuid
language sql stable security definer set search_path = public as
$$ select id from members where auth_id = auth.uid() $$;

create or replace function public.my_is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce((select is_admin from members where auth_id = auth.uid()), false) $$;

create or replace function public.my_is_staff() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce((select is_admin or role = 'staff' from members where auth_id = auth.uid()), false) $$;

create or replace function public.my_can_record() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce((select is_admin or role = 'staff' or scribe from members where auth_id = auth.uid()), false) $$;

-- ═══ RLS 켜기 + 정책 ═══

alter table public.members enable row level security;
alter table public.member_private enable row level security;
alter table public.profiles enable row level security;
alter table public.past_meetings enable row level security;
alter table public.picks enable row level security;
alter table public.rsvps enable row level security;
alter table public.game_owners enable row level security;
alter table public.notices enable row level security;
alter table public.notice_reads enable row level security;
alter table public.crush enable row level security;

-- members: 회원끼리 서로 조회 O. 수정은 본인 행만(닉변·서기플래그), 관리 조작은 RPC로
create policy m_sel on public.members for select to authenticated using (true);
create policy m_upd on public.members for update to authenticated
  using (id = public.my_member_id()) with check (id = public.my_member_id());

-- member_private: 본인 + 운영진만
create policy mp_sel on public.member_private for select to authenticated
  using (member_id = public.my_member_id() or public.my_is_staff());
create policy mp_upd on public.member_private for update to authenticated
  using (member_id = public.my_member_id() or public.my_is_admin());

-- profiles: 회원 조회 O, 본인만 쓰기
create policy pf_sel on public.profiles for select to authenticated using (true);
create policy pf_ins on public.profiles for insert to authenticated
  with check (member_id = public.my_member_id());
create policy pf_upd on public.profiles for update to authenticated
  using (member_id = public.my_member_id());
create policy pf_del on public.profiles for delete to authenticated
  using (member_id = public.my_member_id());

-- past_meetings: 회원 조회 O, 쓰기는 기록권한(관리자·운영진·서기)
create policy pm_sel on public.past_meetings for select to authenticated using (true);
create policy pm_ins on public.past_meetings for insert to authenticated
  with check (public.my_can_record());
create policy pm_upd on public.past_meetings for update to authenticated
  using (public.my_can_record());
create policy pm_del on public.past_meetings for delete to authenticated
  using (public.my_can_record());

-- picks: 본인 것 쓰기, 조회는 본인+운영진(집계용)
create policy pk_sel on public.picks for select to authenticated
  using (member_id = public.my_member_id() or public.my_is_staff());
create policy pk_ins on public.picks for insert to authenticated
  with check (member_id = public.my_member_id());
create policy pk_upd on public.picks for update to authenticated
  using (member_id = public.my_member_id());
create policy pk_del on public.picks for delete to authenticated
  using (member_id = public.my_member_id());

-- rsvps: 회원 조회 O(참석자 이름 표시용), 본인 것만 쓰기
create policy rv_sel on public.rsvps for select to authenticated using (true);
create policy rv_ins on public.rsvps for insert to authenticated
  with check (member_id = public.my_member_id());
create policy rv_upd on public.rsvps for update to authenticated
  using (member_id = public.my_member_id());
create policy rv_del on public.rsvps for delete to authenticated
  using (member_id = public.my_member_id());

-- game_owners: 소유자 본인+운영진 조회, 쓰기는 운영진
create policy go_sel on public.game_owners for select to authenticated
  using (owner_id = public.my_member_id() or public.my_is_staff());
create policy go_ins on public.game_owners for insert to authenticated
  with check (public.my_is_staff());
create policy go_upd on public.game_owners for update to authenticated
  using (public.my_is_staff());
create policy go_del on public.game_owners for delete to authenticated
  using (public.my_is_staff());

-- notices: 회원 조회, 쓰기는 관리자
create policy nt_sel on public.notices for select to authenticated using (true);
create policy nt_ins on public.notices for insert to authenticated
  with check (public.my_is_admin());
create policy nt_del on public.notices for delete to authenticated
  using (public.my_is_admin());

-- notice_reads: 본인 것만
create policy nr_all on public.notice_reads for all to authenticated
  using (member_id = public.my_member_id()) with check (member_id = public.my_member_id());

-- crush: 회원이면 조회 O(매칭 대조용 — 내용은 어차피 해시·암호문), 쓰기는 본인만
create policy cr_sel on public.crush for select to authenticated using (true);
create policy cr_ins on public.crush for insert to authenticated
  with check (member_id = public.my_member_id());
create policy cr_upd on public.crush for update to authenticated
  using (member_id = public.my_member_id());
create policy cr_del on public.crush for delete to authenticated
  using (member_id = public.my_member_id());

-- ═══ Data API 노출 (자동 노출을 꺼뒀으므로 명시적으로. anon에겐 아무것도 안 줌) ═══
-- ⚠️ members/member_private는 컬럼 단위로 잠근다 — 통으로 update를 주면
--    자기 행 정책(m_upd)과 결합해 스스로 is_admin=true로 승격하는 구멍이 생긴다.

grant usage on schema public to authenticated;

-- 읽기: 전 표 (행 필터는 RLS가 담당)
grant select on
  public.members, public.member_private, public.profiles, public.past_meetings,
  public.picks, public.rsvps, public.game_owners, public.notices,
  public.notice_reads, public.crush
to authenticated;

-- members: 본인이 직접 고칠 수 있는 컬럼만 (등급·번호·서기승인은 RPC로만)
grant update (nick, aliases, scribe_ready, scribe_hello) on public.members to authenticated;

-- member_private: 본인이 고칠 건 오픈톡방닉뿐 (kakao를 열면 남의 계정연결 가로채기 가능)
grant update (payname) on public.member_private to authenticated;

-- 나머지 표: 쓰기 전체 허용 (행 제한은 각 RLS 정책이 담당)
grant insert, update, delete on
  public.profiles, public.past_meetings, public.picks, public.rsvps,
  public.game_owners, public.notice_reads, public.crush
to authenticated;
grant insert, delete on public.notices to authenticated;

-- ═══ RPC — 가입·계정연결·관리 조작 (전부 함수 안에서 권한 재검증) ═══

-- 내 카카오 provider id 얻기 (auth.identities에서)
create or replace function public._my_kakao_id() returns text
language sql stable security definer set search_path = public as
$$ select provider_id from auth.identities where user_id = auth.uid() and provider = 'kakao' limit 1 $$;

-- 첫 로그인 때 기존 회원 자동 연결(claim). 성공 시 member id 반환
create or replace function public.claim_my_account() returns uuid
language plpgsql security definer set search_path = public as $$
declare k text; mid uuid;
begin
  if auth.uid() is null then return null; end if;
  select id into mid from members where auth_id = auth.uid();
  if mid is not null then return mid; end if;            -- 이미 연결됨
  k := public._my_kakao_id();
  if k is null then return null; end if;
  select member_id into mid from member_private where kakao = k;
  if mid is null then return null; end if;               -- 기존 회원 아님 → 가입 필요
  update members set auth_id = auth.uid() where id = mid and auth_id is null;
  return mid;
end $$;

-- 신규 가입 (카카오 로그인 후). 회원번호는 시퀀스에서
create or replace function public.signup_member(p_nick text, p_payname text) returns uuid
language plpgsql security definer set search_path = public as $$
declare k text; mid uuid;
begin
  if auth.uid() is null then raise exception '로그인이 필요해요'; end if;
  if exists (select 1 from members where auth_id = auth.uid()) then
    raise exception '이미 가입돼 있어요';
  end if;
  if exists (select 1 from members where nick = p_nick or aliases ? p_nick) then
    raise exception '이미 쓰는 닉네임이에요';
  end if;
  k := public._my_kakao_id();
  insert into members (auth_id, nick, no) values (auth.uid(), p_nick, nextval('member_no_seq'))
    returning id into mid;
  insert into member_private (member_id, payname, kakao) values (mid, p_payname, k);
  return mid;
end $$;

-- 관리자: 등급/서기/회원정보/삭제
create or replace function public.admin_set_role(p_mid uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.my_is_admin() then raise exception '관리자만 가능해요'; end if;
  update members set role = p_role where id = p_mid and not is_admin;
end $$;

create or replace function public.admin_set_scribe(p_mid uuid, p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.my_is_admin() then raise exception '관리자만 가능해요'; end if;
  update members set scribe = p_on, scribe_hello = case when p_on then false else scribe_hello end
  where id = p_mid and not is_admin;
end $$;

create or replace function public.admin_update_member(p_mid uuid, p_nick text, p_payname text) returns void
language plpgsql security definer set search_path = public as $$
declare old_nick text;
begin
  if not public.my_is_admin() then raise exception '관리자만 가능해요'; end if;
  select nick into old_nick from members where id = p_mid;
  if p_nick is not null and p_nick <> old_nick then
    update members set nick = p_nick,
      aliases = (select jsonb_agg(distinct x) from jsonb_array_elements_text(aliases || to_jsonb(old_nick)) t(x))
    where id = p_mid;
  end if;
  update member_private set payname = coalesce(p_payname, payname) where member_id = p_mid;
end $$;

create or replace function public.admin_delete_member(p_mid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.my_is_admin() then raise exception '관리자만 가능해요'; end if;
  delete from members where id = p_mid and not is_admin;   -- cascade로 딸린 데이터 정리
end $$;

grant execute on function
  public.my_member_id, public.my_is_admin, public.my_is_staff, public.my_can_record,
  public.claim_my_account, public.signup_member,
  public.admin_set_role, public.admin_set_scribe, public.admin_update_member, public.admin_delete_member
to authenticated;
