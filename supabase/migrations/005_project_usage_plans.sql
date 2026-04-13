create table if not exists public.project_usage_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_name text not null,
  item_id uuid not null references public.items (id) on delete cascade,
  planned_qty integer not null default 0 check (planned_qty >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists project_usage_plans_unique
  on public.project_usage_plans (user_id, project_name, item_id);

create index if not exists project_usage_plans_user_idx
  on public.project_usage_plans (user_id, project_name);

alter table public.project_usage_plans enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'project_usage_plans' and policyname = 'project_usage_plans_select'
  ) then
    create policy project_usage_plans_select
      on public.project_usage_plans
      for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'project_usage_plans' and policyname = 'project_usage_plans_insert'
  ) then
    create policy project_usage_plans_insert
      on public.project_usage_plans
      for insert
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'project_usage_plans' and policyname = 'project_usage_plans_update'
  ) then
    create policy project_usage_plans_update
      on public.project_usage_plans
      for update
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'project_usage_plans' and policyname = 'project_usage_plans_delete'
  ) then
    create policy project_usage_plans_delete
      on public.project_usage_plans
      for delete
      using (auth.uid() = user_id);
  end if;
end $$;
