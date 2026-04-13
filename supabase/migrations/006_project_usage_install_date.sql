alter table public.project_usage_plans
  add column if not exists install_date date;

create index if not exists project_usage_plans_install_date_idx
  on public.project_usage_plans (user_id, install_date, project_name);
