-- 프로젝트 완료 상태 (완료된 프로젝트는 사용예정·재고요약에서 제외)

create table if not exists public.project_status (
  user_id uuid not null references auth.users (id) on delete cascade,
  project_name text not null,
  completed_at timestamptz not null default now(),
  primary key (user_id, project_name)
);

create index if not exists project_status_user_idx
  on public.project_status (user_id, completed_at desc);

alter table public.project_status enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'project_status' and policyname = 'project_status_select'
  ) then
    create policy project_status_select on public.project_status for select using (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'project_status' and policyname = 'project_status_insert'
  ) then
    create policy project_status_insert on public.project_status for insert with check (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'project_status' and policyname = 'project_status_update'
  ) then
    create policy project_status_update on public.project_status for update using (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'project_status' and policyname = 'project_status_delete'
  ) then
    create policy project_status_delete on public.project_status for delete using (auth.uid() = user_id);
  end if;
end $$;

notify pgrst, 'reload schema';
