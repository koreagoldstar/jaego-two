-- ============================================================
-- 개발용: 재고 DB를 "처음 상태"로 맞춘 뒤 스키마 전체 생성
-- Supabase → SQL Editor 에 붙여넣고 한 번만 Run 하세요.
-- ⚠️ public.items / public.stock_transactions 데이터는 전부 삭제됩니다.
-- ============================================================

-- 1) RPC 함수(버전 여러 개 있어도 전부 제거)
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as fn
    from pg_proc p
    join pg_namespace n on p.pronamespace = n.oid
    where n.nspname = 'public'
      and p.proname = 'apply_stock_move'
  loop
    execute 'drop function if exists ' || r.fn || ' cascade';
  end loop;
end $$;

-- 2) 테이블 (의존 순서: 자식 → 부모)
drop table if exists public.inventory_events cascade;
drop table if exists public.stock_transactions cascade;
drop table if exists public.items cascade;

-- 3) 확장 + 테이블 + 인덱스 + RLS + 정책 + RPC (001 + 002 통합)
create extension if not exists pgcrypto;

create table public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  description text default '' not null,
  sh text default '',
  barcode_code text default '',
  serial_number text default '',
  quantity integer not null default 0 check (quantity >= 0),
  location text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index items_user_barcode_unique
  on public.items (user_id, barcode_code)
  where barcode_code is not null and barcode_code <> '';

create table public.stock_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  item_id uuid not null references public.items (id) on delete cascade,
  direction text not null check (direction in ('in', 'out')),
  amount integer not null check (amount > 0),
  note text default '',
  project text default '' not null,
  created_at timestamptz not null default now()
);

create table public.inventory_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  item_id uuid null references public.items (id) on delete set null,
  event_type text not null check (event_type in ('item_create', 'item_delete')),
  item_name text not null,
  quantity integer not null default 0 check (quantity >= 0),
  detail text default '',
  created_at timestamptz not null default now()
);

create index items_user_idx on public.items (user_id);
create index stock_tx_user_idx on public.stock_transactions (user_id);
create index stock_tx_item_idx on public.stock_transactions (item_id);
create index inventory_events_user_idx on public.inventory_events (user_id, created_at desc);

alter table public.items enable row level security;
alter table public.stock_transactions enable row level security;
alter table public.inventory_events enable row level security;

create policy items_select on public.items for select using (auth.uid() = user_id);
create policy items_insert on public.items for insert with check (auth.uid() = user_id);
create policy items_update on public.items for update using (auth.uid() = user_id);
create policy items_delete on public.items for delete using (auth.uid() = user_id);

create policy tx_select on public.stock_transactions for select using (auth.uid() = user_id);
create policy tx_insert on public.stock_transactions for insert with check (auth.uid() = user_id);
create policy tx_update on public.stock_transactions for update using (auth.uid() = user_id);
create policy tx_delete on public.stock_transactions for delete using (auth.uid() = user_id);

create policy inventory_events_select on public.inventory_events for select using (auth.uid() = user_id);
create policy inventory_events_insert on public.inventory_events for insert with check (auth.uid() = user_id);
create policy inventory_events_update on public.inventory_events for update using (auth.uid() = user_id);
create policy inventory_events_delete on public.inventory_events for delete using (auth.uid() = user_id);

create or replace function public.apply_stock_move(
  p_item_id uuid,
  p_direction text,
  p_amount int,
  p_note text default '',
  p_project text default ''
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_qty int;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if p_amount <= 0 then
    raise exception 'invalid amount';
  end if;
  if p_direction not in ('in', 'out') then
    raise exception 'invalid direction';
  end if;

  select quantity into v_qty from public.items where id = p_item_id and user_id = v_uid for update;
  if not found then
    raise exception 'item not found';
  end if;

  if p_direction = 'in' then
    update public.items
    set quantity = quantity + p_amount, updated_at = now()
    where id = p_item_id and user_id = v_uid;
  else
    if v_qty < p_amount then
      raise exception 'insufficient stock';
    end if;
    update public.items
    set quantity = quantity - p_amount, updated_at = now()
    where id = p_item_id and user_id = v_uid;
  end if;

  insert into public.stock_transactions (user_id, item_id, direction, amount, note, project)
  values (
    v_uid,
    p_item_id,
    p_direction,
    p_amount,
    coalesce(nullif(trim(p_note), ''), ''),
    coalesce(nullif(trim(p_project), ''), '')
  );

  return json_build_object('ok', true);
end;
$$;

revoke all on function public.apply_stock_move from public;
grant execute on function public.apply_stock_move to authenticated;
