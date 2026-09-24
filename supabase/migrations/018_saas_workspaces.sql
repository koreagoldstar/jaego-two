-- 오늘의 재고 (SaaS) — 회사(워크스페이스)·요금제·품목 한도·도입 문의
-- Supabase SQL Editor 에서 한 번 실행하세요. 여러 번 실행해도 안전합니다.
--
-- 구조: 로그인 계정 1개 = 회사 1곳 (지금 신화유디텍처럼 직원이 한 계정을 함께 씀)
--       데이터는 기존과 동일하게 user_id 로 회사별 분리됩니다.

-- 1) 요금제 ------------------------------------------------------------------
-- 가격은 원/월, 부가세 별도. 앱 쪽 표시값은 lib/plans.ts 와 같게 유지하세요.
create table if not exists public.plans (
  id text primary key,
  name text not null,
  item_limit integer,            -- null = 무제한
  monthly_price integer not null,
  sort_order integer not null default 0,
  is_public boolean not null default true
);

insert into public.plans (id, name, item_limit, monthly_price, sort_order, is_public) values
  ('basic',    '베이직',   2000,  20000, 1, true),
  ('standard', '스탠다드', 10000, 30000, 2, true),
  ('pro',      '프로',     null,  50000, 3, true),
  ('internal', '내부용',   null,  0,     99, false)
on conflict (id) do update set
  name = excluded.name,
  item_limit = excluded.item_limit,
  monthly_price = excluded.monthly_price,
  sort_order = excluded.sort_order,
  is_public = excluded.is_public;

alter table public.plans enable row level security;
drop policy if exists plans_select on public.plans;
create policy plans_select on public.plans for select using (true);

-- 2) 회사(워크스페이스) --------------------------------------------------------
create table if not exists public.workspaces (
  user_id uuid primary key references auth.users (id) on delete cascade,
  company_name text not null,
  contact_name text,
  phone text,
  plan_id text not null default 'basic' references public.plans (id),
  status text not null default 'trial'
    check (status in ('trial', 'active', 'past_due', 'canceled')),
  trial_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.workspaces enable row level security;
drop policy if exists workspaces_select on public.workspaces;
create policy workspaces_select on public.workspaces for select using (auth.uid() = user_id);
drop policy if exists workspaces_update on public.workspaces;
create policy workspaces_update on public.workspaces for update using (auth.uid() = user_id);

-- 요금제·상태는 고객이 직접 못 바꾸게: 회사 정보 열만 수정 허용 (요금제 변경은 관리자/결제 연동에서)
revoke update on public.workspaces from anon, authenticated;
grant update (company_name, contact_name, phone, updated_at) on public.workspaces to authenticated;

-- 3) 가입 시 워크스페이스 자동 생성 ---------------------------------------------
-- signUp 의 options.data 로 받은 company_name / contact_name / phone / plan_id 사용
create or replace function public.handle_new_user_workspace()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_plan text := coalesce(v_meta ->> 'plan_id', 'basic');
begin
  if not exists (select 1 from public.plans where id = v_plan and is_public) then
    v_plan := 'basic';
  end if;

  insert into public.workspaces (user_id, company_name, contact_name, phone, plan_id, status, trial_ends_at)
  values (
    new.id,
    coalesce(nullif(trim(v_meta ->> 'company_name'), ''), split_part(new.email, '@', 1)),
    nullif(trim(v_meta ->> 'contact_name'), ''),
    nullif(trim(v_meta ->> 'phone'), ''),
    v_plan,
    'trial',
    now() + interval '14 days'
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_workspace on auth.users;
create trigger on_auth_user_created_workspace
  after insert on auth.users
  for each row execute function public.handle_new_user_workspace();

-- 기존 계정(신화유디텍) → 내부용 무제한 요금제로 등록
insert into public.workspaces (user_id, company_name, plan_id, status)
select u.id, '신화유디텍', 'internal', 'active'
from auth.users u
where not exists (select 1 from public.workspaces w where w.user_id = u.id);

-- 4) 품목 한도 ----------------------------------------------------------------
create or replace function public.enforce_item_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer;
  v_plan_name text;
  v_count integer;
begin
  select p.item_limit, p.name into v_limit, v_plan_name
  from public.workspaces w
  join public.plans p on p.id = w.plan_id
  where w.user_id = new.user_id;

  if v_limit is null then
    return new; -- 무제한 요금제이거나 워크스페이스 없음
  end if;

  select count(*) into v_count from public.items where user_id = new.user_id;
  if v_count >= v_limit then
    raise exception '품목 한도 초과: % 요금제는 품목을 %개까지 등록할 수 있습니다. 설정 → 요금제에서 변경을 요청해 주세요.',
      v_plan_name, to_char(v_limit, 'FM999,999,999')
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists items_enforce_limit on public.items;
create trigger items_enforce_limit
  before insert on public.items
  for each row execute function public.enforce_item_limit();

-- 5) 도입·맞춤 제작 문의 (소개 사이트 문의 폼) -----------------------------------
create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'general' check (kind in ('general', 'custom', 'plan')),
  company_name text not null check (char_length(company_name) between 1 and 100),
  contact_name text check (char_length(contact_name) <= 50),
  phone text check (char_length(phone) <= 30),
  email text check (char_length(email) <= 200),
  message text not null check (char_length(message) between 1 and 5000),
  created_at timestamptz not null default now()
);

alter table public.inquiries enable row level security;
drop policy if exists inquiries_insert on public.inquiries;
create policy inquiries_insert on public.inquiries for insert to anon, authenticated with check (true);
-- 조회 정책 없음 → 문의 내용은 Supabase 대시보드(Table Editor)에서만 확인

notify pgrst, 'reload schema';
