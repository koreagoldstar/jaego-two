create table if not exists public.inventory_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  item_id uuid null references public.items (id) on delete set null,
  event_type text not null check (event_type in ('item_create', 'item_delete')),
  item_name text not null,
  quantity integer not null default 0 check (quantity >= 0),
  detail text default '',
  created_at timestamptz not null default now()
);

create index if not exists inventory_events_user_idx on public.inventory_events (user_id, created_at desc);

alter table public.inventory_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'inventory_events' and policyname = 'inventory_events_select'
  ) then
    create policy inventory_events_select
      on public.inventory_events
      for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'inventory_events' and policyname = 'inventory_events_insert'
  ) then
    create policy inventory_events_insert
      on public.inventory_events
      for insert
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'inventory_events' and policyname = 'inventory_events_update'
  ) then
    create policy inventory_events_update
      on public.inventory_events
      for update
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'inventory_events' and policyname = 'inventory_events_delete'
  ) then
    create policy inventory_events_delete
      on public.inventory_events
      for delete
      using (auth.uid() = user_id);
  end if;
end $$;
