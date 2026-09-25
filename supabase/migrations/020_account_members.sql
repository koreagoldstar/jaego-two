-- 여러 로그인 이메일이 같은 재고(주인 계정 데이터)를 함께 쓰기
--
-- account_members: 공유 계정(member) → 주인 계정(owner)
-- public.data_owner_id(): 공유 계정이면 주인 id, 아니면 본인 id
-- 모든 데이터 테이블 RLS 와 apply_stock_move 가 auth.uid() 대신 이 함수를 쓰도록 바꿉니다.
-- 앱 쪽은 lib/supabase/dataUser.ts 의 getDataUser() 가 같은 규칙으로 user.id 를 바꿉니다.
-- 여러 번 실행해도 안전합니다.

create table if not exists public.account_members (
  member_user_id uuid primary key references auth.users (id) on delete cascade,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (member_user_id <> owner_user_id)
);

alter table public.account_members enable row level security;
drop policy if exists account_members_select_own on public.account_members;
create policy account_members_select_own on public.account_members
  for select using (member_user_id = auth.uid());
-- 등록·삭제는 관리자(SQL Editor / service_role)만

create or replace function public.data_owner_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select owner_user_id from public.account_members where member_user_id = auth.uid()),
    auth.uid()
  )
$$;

grant execute on function public.data_owner_id() to authenticated;

-- RLS: "auth.uid() = user_id" → 주인 계정 기준
do $$
declare
  r record;
  v_new text;
begin
  for r in
    select tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'items', 'stock_transactions', 'item_stock_lots', 'inventory_events',
        'project_usage_plans', 'project_status', 'workspaces'
      )
  loop
    if r.qual is not null and r.qual like '%auth.uid()%' then
      v_new := replace(r.qual, 'auth.uid()', '( SELECT public.data_owner_id())');
      execute format('alter policy %I on public.%I using (%s)', r.policyname, r.tablename, v_new);
    end if;
    if r.with_check is not null and r.with_check like '%auth.uid()%' then
      v_new := replace(r.with_check, 'auth.uid()', '( SELECT public.data_owner_id())');
      execute format('alter policy %I on public.%I with check (%s)', r.policyname, r.tablename, v_new);
    end if;
  end loop;
end $$;

-- 재고 이동 함수: 호출자 id 대신 주인 계정 id 사용
do $$
declare
  r record;
  v_def text;
begin
  for r in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'apply_stock_move'
  loop
    v_def := pg_get_functiondef(r.oid);
    if v_def like '%auth.uid()%' then
      execute replace(v_def, 'auth.uid()', 'public.data_owner_id()');
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
