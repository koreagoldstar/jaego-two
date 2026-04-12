-- BroadStock / jaego — Supabase SQL (SQL Editor에서 한 번에 실행)

create extension if not exists pgcrypto;

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  description text default '' not null,
  sku text default '',
  barcode_code text default '',
  serial_number text default '',
  quantity integer not null default 0 check (quantity >= 0),
  location text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists items_user_barcode_unique
  on public.items (user_id, barcode_code)
  where barcode_code is not null and barcode_code <> '';

create table if not exists public.stock_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  item_id uuid not null references public.items (id) on delete cascade,
  direction text not null check (direction in ('in', 'out')),
  amount integer not null check (amount > 0),
  note text default '',
  created_at timestamptz not null default now()
);

create index if not exists items_user_idx on public.items (user_id);
create index if not exists stock_tx_user_idx on public.stock_transactions (user_id);
create index if not exists stock_tx_item_idx on public.stock_transactions (item_id);

alter table public.items enable row level security;
alter table public.stock_transactions enable row level security;

create policy items_select on public.items for select using (auth.uid() = user_id);
create policy items_insert on public.items for insert with check (auth.uid() = user_id);
create policy items_update on public.items for update using (auth.uid() = user_id);
create policy items_delete on public.items for delete using (auth.uid() = user_id);

create policy tx_select on public.stock_transactions for select using (auth.uid() = user_id);
create policy tx_insert on public.stock_transactions for insert with check (auth.uid() = user_id);
create policy tx_update on public.stock_transactions for update using (auth.uid() = user_id);
create policy tx_delete on public.stock_transactions for delete using (auth.uid() = user_id);

create or replace function public.apply_stock_move(
  p_item_id uuid,
  p_direction text,
  p_amount int,
  p_note text default ''
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

  insert into public.stock_transactions (user_id, item_id, direction, amount, note)
  values (v_uid, p_item_id, p_direction, p_amount, coalesce(p_note, ''));

  return json_build_object('ok', true);
end;
$$;

revoke all on function public.apply_stock_move from public;
grant execute on function public.apply_stock_move to authenticated;
