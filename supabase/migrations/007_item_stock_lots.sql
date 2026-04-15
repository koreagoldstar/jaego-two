-- 품목별 재고 입고 단위(날짜·수량별 행). items.quantity = 해당 품목 lots 합계(트리거 유지).

create table if not exists public.item_stock_lots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  item_id uuid not null references public.items (id) on delete cascade,
  quantity integer not null check (quantity > 0),
  note text default '' not null,
  created_at timestamptz not null default now()
);

create index if not exists item_stock_lots_item_idx
  on public.item_stock_lots (item_id, created_at asc);

alter table public.item_stock_lots enable row level security;

create policy item_stock_lots_select
  on public.item_stock_lots for select
  using (auth.uid() = user_id);

create policy item_stock_lots_insert
  on public.item_stock_lots for insert
  with check (auth.uid() = user_id);

create policy item_stock_lots_update
  on public.item_stock_lots for update
  using (auth.uid() = user_id);

create policy item_stock_lots_delete
  on public.item_stock_lots for delete
  using (auth.uid() = user_id);

create or replace function public.sync_item_quantity_from_lots()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item uuid;
begin
  if tg_op = 'DELETE' then
    v_item := old.item_id;
  else
    v_item := new.item_id;
  end if;

  update public.items i
  set
    quantity = coalesce((
      select sum(l.quantity)::int
      from public.item_stock_lots l
      where l.item_id = v_item and l.user_id = i.user_id
    ), 0),
    updated_at = now()
  where i.id = v_item;

  return null;
end;
$$;

drop trigger if exists trg_sync_item_qty_from_lots on public.item_stock_lots;
create trigger trg_sync_item_qty_from_lots
  after insert or update or delete on public.item_stock_lots
  for each row
  execute procedure public.sync_item_quantity_from_lots();

-- 기존 재고를 단일 lot으로 이관 (입고일 = 품목 등록일)
insert into public.item_stock_lots (user_id, item_id, quantity, note, created_at)
select
  i.user_id,
  i.id,
  i.quantity,
  '',
  i.created_at
from public.items i
where i.quantity > 0
  and not exists (select 1 from public.item_stock_lots l where l.item_id = i.id);

-- items.quantity를 lot 합계와 맞춤 (트리거가 이미 돌았을 수 있음 — 재계산)
update public.items i
set quantity = coalesce((
  select sum(l.quantity)::int
  from public.item_stock_lots l
  where l.item_id = i.id
), 0);

-- 입출고 RPC: 입고는 lot 추가, 출고는 lot FIFO 차감
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
  v_rem int;
  r record;
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

  select quantity into v_qty
  from public.items
  where id = p_item_id and user_id = v_uid
  for update;

  if not found then
    raise exception 'item not found';
  end if;

  if p_direction = 'in' then
    insert into public.item_stock_lots (user_id, item_id, quantity, note, created_at)
    values (v_uid, p_item_id, p_amount, '', now());
  else
    if v_qty < p_amount then
      raise exception 'insufficient stock';
    end if;

    v_rem := p_amount;
    for r in
      select id, quantity
      from public.item_stock_lots
      where item_id = p_item_id and user_id = v_uid
      order by created_at asc, id asc
      for update
    loop
      exit when v_rem <= 0;
      if r.quantity <= v_rem then
        delete from public.item_stock_lots where id = r.id;
        v_rem := v_rem - r.quantity;
      else
        update public.item_stock_lots
        set quantity = r.quantity - v_rem
        where id = r.id;
        v_rem := 0;
      end if;
    end loop;

    if v_rem > 0 then
      raise exception 'insufficient stock (lots)';
    end if;
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
