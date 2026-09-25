-- ============================================================
-- 오늘의 재고 (판매용) — 새 Supabase 프로젝트 초기 설치 (빈 DB 전용)
-- Supabase → SQL Editor → New query → 이 파일 전체 붙여넣기 → Run 1회
-- supabase/migrations/001~ 을 순서대로 합친 파일입니다. (000 은 예전 수동 테이블 보정용이라 제외)
-- 한 번에 실행할 때 겹치는 apply_stock_move 옛 버전 권한 줄은 뺐습니다 (014·015 에서 최종 권한 부여).
-- 재생성: python scripts/build-saas-setup.py
-- ============================================================


-- ------------------------------------------------------------
-- 001_initial.sql
-- ------------------------------------------------------------
-- BroadStock / jaego — Supabase SQL (SQL Editor에서 한 번에 실행)

create extension if not exists pgcrypto;

create table if not exists public.items (
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

-- (합본에서 제외) revoke all on function public.apply_stock_move from public;
-- (합본에서 제외) grant execute on function public.apply_stock_move to authenticated;

-- ------------------------------------------------------------
-- 002_stock_transaction_project.sql
-- ------------------------------------------------------------
-- 입출고 시 프로젝트(현장/행사 등) 구분
alter table public.stock_transactions add column if not exists project text default '' not null;

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

-- (합본에서 제외) revoke all on function public.apply_stock_move from public;
-- (합본에서 제외) grant execute on function public.apply_stock_move to authenticated;

-- ------------------------------------------------------------
-- 003_rename_sku_to_sh.sql
-- ------------------------------------------------------------
-- 기존 DB: items.sku → items.sh (내부코드 SH)
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'items'
      and column_name = 'sku'
  ) then
    alter table public.items rename column sku to sh;
  end if;
end $$;

-- ------------------------------------------------------------
-- 004_inventory_events.sql
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- 005_project_usage_plans.sql
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- 006_project_usage_install_date.sql
-- ------------------------------------------------------------
alter table public.project_usage_plans
  add column if not exists install_date date;

create index if not exists project_usage_plans_install_date_idx
  on public.project_usage_plans (user_id, install_date, project_name);

-- ------------------------------------------------------------
-- 007_item_stock_lots.sql
-- ------------------------------------------------------------
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

-- (합본에서 제외) revoke all on function public.apply_stock_move from public;
-- (합본에서 제외) grant execute on function public.apply_stock_move to authenticated;

-- PostgREST가 새 테이블을 바로 노출하도록 (선택, 일부 프로젝트에서만 필요)
NOTIFY pgrst, 'reload schema';

-- ------------------------------------------------------------
-- 008_postgrest_reload_schema.sql
-- ------------------------------------------------------------
-- PostgREST(API) 스키마 캐시만 갱신합니다. CREATE POLICY 등은 없습니다.
-- ⚠️ 다른 마이그레이션 파일과 한 번에 붙여 넣지 마세요. 아래 한 줄만 새 쿼리에 넣고 실행하세요.
NOTIFY pgrst, 'reload schema';

-- ------------------------------------------------------------
-- 009_item_stock_lots_lot_code.sql
-- ------------------------------------------------------------
-- 입고 단위별 QR(스캔 코드). 동일 품목 내 비어 있지 않은 값은 유일해야 함.

alter table public.item_stock_lots
  add column if not exists lot_code text not null default '';

create unique index if not exists item_stock_lots_unique_qr_per_item
  on public.item_stock_lots (user_id, item_id, (lower(btrim(lot_code))))
  where btrim(lot_code) <> '';

notify pgrst, 'reload schema';

-- ------------------------------------------------------------
-- 010_split_legacy_lots_to_unit_qr.sql
-- ------------------------------------------------------------
-- 기존 묶음 lot(quantity > 1)를 1개 단위 lot로 분해합니다.
-- 기존 라벨 관행에 맞춰 base-001, base-002 ... 형태를 우선 사용합니다.
-- 동일 품목 내 중복이 생기면 뒤에 -rN 접미사를 붙여 충돌을 피합니다.

do $$
declare
  r record;
  i integer;
  suffix_try integer;
  raw_code text;
  base_code text;
  candidate text;
begin
  for r in
    select id, user_id, item_id, quantity, lot_code, note, created_at
    from public.item_stock_lots
    where quantity > 1
    order by created_at asc, id asc
  loop
    raw_code := btrim(coalesce(r.lot_code, ''));
    if raw_code = '' then
      base_code := 'lot-' || left(r.id::text, 8);
    elsif raw_code ~ '-[0-9]{3}$' then
      base_code := regexp_replace(raw_code, '-[0-9]{3}$', '');
    else
      base_code := raw_code;
    end if;

    delete from public.item_stock_lots where id = r.id;

    for i in 1..r.quantity loop
      candidate := base_code || '-' || lpad(i::text, 3, '0');
      suffix_try := 1;

      while exists (
        select 1
        from public.item_stock_lots l
        where l.user_id = r.user_id
          and l.item_id = r.item_id
          and lower(btrim(l.lot_code)) = lower(btrim(candidate))
      ) loop
        suffix_try := suffix_try + 1;
        candidate := base_code || '-' || lpad(i::text, 3, '0') || '-r' || suffix_try::text;
      end loop;

      insert into public.item_stock_lots (user_id, item_id, quantity, lot_code, note, created_at)
      values (r.user_id, r.item_id, 1, candidate, coalesce(r.note, ''), r.created_at);
    end loop;
  end loop;
end $$;

notify pgrst, 'reload schema';

-- ------------------------------------------------------------
-- 011_apply_stock_move_unit_lot_codes.sql
-- ------------------------------------------------------------
-- 입고 시 수량만큼 1개 단위 lot + 고유 lot_code(뒷번호 증가) 생성. 출고는 기존 FIFO 유지.

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
  v_base text;
  v_max int;
  v_idx int;
  v_code text;
  v_try int;
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
    select coalesce(nullif(btrim(barcode_code), ''), 'item-' || left(p_item_id::text, 8))
    into v_base
    from public.items
    where id = p_item_id and user_id = v_uid;

    select coalesce(max(
      (regexp_match(btrim(l.lot_code), '-([0-9]{3})(?:-r[0-9]+)?$'))[1]::int
    ), 0)
    into v_max
    from public.item_stock_lots l
    where l.item_id = p_item_id
      and l.user_id = v_uid
      and btrim(l.lot_code) <> '';

    for v_idx in 1..p_amount loop
      v_try := 0;
      loop
        v_code := v_base || '-' || lpad((v_max + v_idx)::text, 3, '0');
        if v_try > 0 then
          v_code := v_code || '-r' || v_try::text;
        end if;
        exit when not exists (
          select 1
          from public.item_stock_lots l
          where l.user_id = v_uid
            and l.item_id = p_item_id
            and lower(btrim(l.lot_code)) = lower(btrim(v_code))
        );
        v_try := v_try + 1;
      end loop;

      insert into public.item_stock_lots (user_id, item_id, quantity, lot_code, note, created_at)
      values (v_uid, p_item_id, 1, v_code, coalesce(nullif(trim(p_note), ''), ''), now());
    end loop;
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

-- (합본에서 제외) revoke all on function public.apply_stock_move from public;
-- (합본에서 제외) grant execute on function public.apply_stock_move to authenticated;

notify pgrst, 'reload schema';

-- ------------------------------------------------------------
-- 012_apply_stock_move_target_lot.sql
-- ------------------------------------------------------------
-- 출고 시 특정 입고 단위(lot) 지정 가능 (p_lot_id). 미지정 시 기존 FIFO.

create or replace function public.apply_stock_move(
  p_item_id uuid,
  p_direction text,
  p_amount int,
  p_note text default '',
  p_project text default '',
  p_lot_id uuid default null
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
  v_base text;
  v_max int;
  v_idx int;
  v_code text;
  v_try int;
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
  if p_direction = 'in' and p_lot_id is not null then
    raise exception 'lot id is only for outbound';
  end if;

  select quantity into v_qty
  from public.items
  where id = p_item_id and user_id = v_uid
  for update;

  if not found then
    raise exception 'item not found';
  end if;

  if p_direction = 'in' then
    select coalesce(nullif(btrim(barcode_code), ''), 'item-' || left(p_item_id::text, 8))
    into v_base
    from public.items
    where id = p_item_id and user_id = v_uid;

    select coalesce(max(
      (regexp_match(btrim(l.lot_code), '-([0-9]{3})(?:-r[0-9]+)?$'))[1]::int
    ), 0)
    into v_max
    from public.item_stock_lots l
    where l.item_id = p_item_id
      and l.user_id = v_uid
      and btrim(l.lot_code) <> '';

    for v_idx in 1..p_amount loop
      v_try := 0;
      loop
        v_code := v_base || '-' || lpad((v_max + v_idx)::text, 3, '0');
        if v_try > 0 then
          v_code := v_code || '-r' || v_try::text;
        end if;
        exit when not exists (
          select 1
          from public.item_stock_lots l
          where l.user_id = v_uid
            and l.item_id = p_item_id
            and lower(btrim(l.lot_code)) = lower(btrim(v_code))
        );
        v_try := v_try + 1;
      end loop;

      insert into public.item_stock_lots (user_id, item_id, quantity, lot_code, note, created_at)
      values (v_uid, p_item_id, 1, v_code, coalesce(nullif(trim(p_note), ''), ''), now());
    end loop;
  else
    if v_qty < p_amount then
      raise exception 'insufficient stock';
    end if;

    if p_lot_id is not null then
      select id, quantity
      into r
      from public.item_stock_lots
      where id = p_lot_id
        and item_id = p_item_id
        and user_id = v_uid
      for update;

      if not found then
        raise exception 'lot not found';
      end if;
      if r.quantity < p_amount then
        raise exception 'insufficient stock';
      end if;

      if r.quantity <= p_amount then
        delete from public.item_stock_lots where id = r.id;
      else
        update public.item_stock_lots
        set quantity = r.quantity - p_amount
        where id = r.id;
      end if;
    else
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

revoke all on function public.apply_stock_move(uuid, text, int, text, text, uuid) from public;
grant execute on function public.apply_stock_move(uuid, text, int, text, text, uuid) to authenticated;

notify pgrst, 'reload schema';

-- ------------------------------------------------------------
-- 013_stock_transaction_lot_code.sql
-- ------------------------------------------------------------
-- 입출고 이력에 단위 QR(lot_code) 저장·표시

alter table public.stock_transactions
  add column if not exists lot_code text default '' not null;

create or replace function public.apply_stock_move(
  p_item_id uuid,
  p_direction text,
  p_amount int,
  p_note text default '',
  p_project text default '',
  p_lot_id uuid default null
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
  v_base text;
  v_max int;
  v_idx int;
  v_code text;
  v_try int;
  v_lot_codes text := '';
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
  if p_direction = 'in' and p_lot_id is not null then
    raise exception 'lot id is only for outbound';
  end if;

  select quantity into v_qty
  from public.items
  where id = p_item_id and user_id = v_uid
  for update;

  if not found then
    raise exception 'item not found';
  end if;

  if p_direction = 'in' then
    select coalesce(nullif(btrim(barcode_code), ''), 'item-' || left(p_item_id::text, 8))
    into v_base
    from public.items
    where id = p_item_id and user_id = v_uid;

    select coalesce(max(
      (regexp_match(btrim(l.lot_code), '-([0-9]{3})(?:-r[0-9]+)?$'))[1]::int
    ), 0)
    into v_max
    from public.item_stock_lots l
    where l.item_id = p_item_id
      and l.user_id = v_uid
      and btrim(l.lot_code) <> '';

    for v_idx in 1..p_amount loop
      v_try := 0;
      loop
        v_code := v_base || '-' || lpad((v_max + v_idx)::text, 3, '0');
        if v_try > 0 then
          v_code := v_code || '-r' || v_try::text;
        end if;
        exit when not exists (
          select 1
          from public.item_stock_lots l
          where l.user_id = v_uid
            and l.item_id = p_item_id
            and lower(btrim(l.lot_code)) = lower(btrim(v_code))
        );
        v_try := v_try + 1;
      end loop;

      insert into public.item_stock_lots (user_id, item_id, quantity, lot_code, note, created_at)
      values (v_uid, p_item_id, 1, v_code, coalesce(nullif(trim(p_note), ''), ''), now());

      if btrim(v_lot_codes) = '' then
        v_lot_codes := v_code;
      else
        v_lot_codes := v_lot_codes || ',' || v_code;
      end if;
    end loop;
  else
    if v_qty < p_amount then
      raise exception 'insufficient stock';
    end if;

    if p_lot_id is not null then
      select id, quantity, lot_code
      into r
      from public.item_stock_lots
      where id = p_lot_id
        and item_id = p_item_id
        and user_id = v_uid
      for update;

      if not found then
        raise exception 'lot not found';
      end if;
      if r.quantity < p_amount then
        raise exception 'insufficient stock';
      end if;

      v_lot_codes := btrim(coalesce(r.lot_code, ''));

      if r.quantity <= p_amount then
        delete from public.item_stock_lots where id = r.id;
      else
        update public.item_stock_lots
        set quantity = r.quantity - p_amount
        where id = r.id;
      end if;
    else
      v_rem := p_amount;
      for r in
        select id, quantity, lot_code
        from public.item_stock_lots
        where item_id = p_item_id and user_id = v_uid
        order by created_at asc, id asc
        for update
      loop
        exit when v_rem <= 0;
        if r.quantity <= v_rem then
          if btrim(coalesce(r.lot_code, '')) <> '' then
            if btrim(v_lot_codes) = '' then
              v_lot_codes := btrim(r.lot_code);
            else
              v_lot_codes := v_lot_codes || ',' || btrim(r.lot_code);
            end if;
          end if;
          delete from public.item_stock_lots where id = r.id;
          v_rem := v_rem - r.quantity;
        else
          if btrim(coalesce(r.lot_code, '')) <> '' then
            if btrim(v_lot_codes) = '' then
              v_lot_codes := btrim(r.lot_code);
            else
              v_lot_codes := v_lot_codes || ',' || btrim(r.lot_code);
            end if;
          end if;
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
  end if;

  insert into public.stock_transactions (user_id, item_id, direction, amount, note, project, lot_code)
  values (
    v_uid,
    p_item_id,
    p_direction,
    p_amount,
    coalesce(nullif(trim(p_note), ''), ''),
    coalesce(nullif(trim(p_project), ''), ''),
    coalesce(v_lot_codes, '')
  );

  return json_build_object('ok', true);
end;
$$;

revoke all on function public.apply_stock_move(uuid, text, int, text, text, uuid) from public;
grant execute on function public.apply_stock_move(uuid, text, int, text, text, uuid) to authenticated;

notify pgrst, 'reload schema';

-- ------------------------------------------------------------
-- 014_drop_apply_stock_move_duplicate.sql
-- ------------------------------------------------------------
-- apply_stock_move 5인자·6인자 중복 등록 시 PostgREST "Could not choose the best candidate" 해결
-- 구버전(5인자)을 모두 제거하고 6인자 단일 시그니처만 유지합니다.

do $$
declare
  r record;
begin
  for r in
    select pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'apply_stock_move'
  loop
    execute format('drop function if exists public.apply_stock_move(%s)', r.args);
  end loop;
end $$;

create function public.apply_stock_move(
  p_item_id uuid,
  p_direction text,
  p_amount int,
  p_note text default '',
  p_project text default '',
  p_lot_id uuid default null
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
  v_base text;
  v_max int;
  v_idx int;
  v_code text;
  v_try int;
  v_lot_codes text := '';
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
  if p_direction = 'in' and p_lot_id is not null then
    raise exception 'lot id is only for outbound';
  end if;

  select quantity into v_qty
  from public.items
  where id = p_item_id and user_id = v_uid
  for update;

  if not found then
    raise exception 'item not found';
  end if;

  if p_direction = 'in' then
    select coalesce(nullif(btrim(barcode_code), ''), 'item-' || left(p_item_id::text, 8))
    into v_base
    from public.items
    where id = p_item_id and user_id = v_uid;

    select coalesce(max(
      (regexp_match(btrim(l.lot_code), '-([0-9]{3})(?:-r[0-9]+)?$'))[1]::int
    ), 0)
    into v_max
    from public.item_stock_lots l
    where l.item_id = p_item_id
      and l.user_id = v_uid
      and btrim(l.lot_code) <> '';

    for v_idx in 1..p_amount loop
      v_try := 0;
      loop
        v_code := v_base || '-' || lpad((v_max + v_idx)::text, 3, '0');
        if v_try > 0 then
          v_code := v_code || '-r' || v_try::text;
        end if;
        exit when not exists (
          select 1
          from public.item_stock_lots l
          where l.user_id = v_uid
            and l.item_id = p_item_id
            and lower(btrim(l.lot_code)) = lower(btrim(v_code))
        );
        v_try := v_try + 1;
      end loop;

      insert into public.item_stock_lots (user_id, item_id, quantity, lot_code, note, created_at)
      values (v_uid, p_item_id, 1, v_code, coalesce(nullif(trim(p_note), ''), ''), now());

      if btrim(v_lot_codes) = '' then
        v_lot_codes := v_code;
      else
        v_lot_codes := v_lot_codes || ',' || v_code;
      end if;
    end loop;
  else
    if v_qty < p_amount then
      raise exception 'insufficient stock';
    end if;

    if p_lot_id is not null then
      select id, quantity, lot_code
      into r
      from public.item_stock_lots
      where id = p_lot_id
        and item_id = p_item_id
        and user_id = v_uid
      for update;

      if not found then
        raise exception 'lot not found';
      end if;
      if r.quantity < p_amount then
        raise exception 'insufficient stock';
      end if;

      v_lot_codes := btrim(coalesce(r.lot_code, ''));

      if r.quantity <= p_amount then
        delete from public.item_stock_lots where id = r.id;
      else
        update public.item_stock_lots
        set quantity = r.quantity - p_amount
        where id = r.id;
      end if;
    else
      v_rem := p_amount;
      for r in
        select id, quantity, lot_code
        from public.item_stock_lots
        where item_id = p_item_id and user_id = v_uid
        order by created_at asc, id asc
        for update
      loop
        exit when v_rem <= 0;
        if r.quantity <= v_rem then
          if btrim(coalesce(r.lot_code, '')) <> '' then
            if btrim(v_lot_codes) = '' then
              v_lot_codes := btrim(r.lot_code);
            else
              v_lot_codes := v_lot_codes || ',' || btrim(r.lot_code);
            end if;
          end if;
          delete from public.item_stock_lots where id = r.id;
          v_rem := v_rem - r.quantity;
        else
          if btrim(coalesce(r.lot_code, '')) <> '' then
            if btrim(v_lot_codes) = '' then
              v_lot_codes := btrim(r.lot_code);
            else
              v_lot_codes := v_lot_codes || ',' || btrim(r.lot_code);
            end if;
          end if;
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
  end if;

  insert into public.stock_transactions (user_id, item_id, direction, amount, note, project, lot_code)
  values (
    v_uid,
    p_item_id,
    p_direction,
    p_amount,
    coalesce(nullif(trim(p_note), ''), ''),
    coalesce(nullif(trim(p_project), ''), ''),
    coalesce(v_lot_codes, '')
  );

  return json_build_object('ok', true);
end;
$$;

revoke all on function public.apply_stock_move(uuid, text, int, text, text, uuid) from public;
grant execute on function public.apply_stock_move(uuid, text, int, text, text, uuid) to authenticated;

notify pgrst, 'reload schema';

-- ------------------------------------------------------------
-- 015_apply_stock_move_max_from_history.sql
-- ------------------------------------------------------------
-- 입고 시 lot 번호: 현재 lot + 출고 이력(stock_transactions.lot_code)까지 반영해 다음 번호 발급

create or replace function public.apply_stock_move(
  p_item_id uuid,
  p_direction text,
  p_amount int,
  p_note text default '',
  p_project text default '',
  p_lot_id uuid default null
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
  v_base text;
  v_max int;
  v_idx int;
  v_code text;
  v_try int;
  v_lot_codes text := '';
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
  if p_direction = 'in' and p_lot_id is not null then
    raise exception 'lot id is only for outbound';
  end if;

  select quantity into v_qty
  from public.items
  where id = p_item_id and user_id = v_uid
  for update;

  if not found then
    raise exception 'item not found';
  end if;

  if p_direction = 'in' then
    select coalesce(nullif(btrim(barcode_code), ''), 'item-' || left(p_item_id::text, 8))
    into v_base
    from public.items
    where id = p_item_id and user_id = v_uid;

    select coalesce(max(
      (regexp_match(btrim(src.lot_code), '-([0-9]{3,})(?:-r[0-9]+)?$'))[1]::int
    ), 0)
    into v_max
    from (
      select l.lot_code
      from public.item_stock_lots l
      where l.item_id = p_item_id
        and l.user_id = v_uid
        and btrim(l.lot_code) <> ''
      union all
      select trim(p) as lot_code
      from public.stock_transactions st,
           lateral unnest(string_to_array(st.lot_code, ',')) as p
      where st.item_id = p_item_id
        and st.user_id = v_uid
        and btrim(st.lot_code) <> ''
        and btrim(p) <> ''
    ) src;

    for v_idx in 1..p_amount loop
      v_try := 0;
      loop
        v_code := v_base || '-' || lpad((v_max + v_idx)::text, 3, '0');
        if v_try > 0 then
          v_code := v_code || '-r' || v_try::text;
        end if;
        exit when not exists (
          select 1
          from public.item_stock_lots l
          where l.user_id = v_uid
            and l.item_id = p_item_id
            and lower(btrim(l.lot_code)) = lower(btrim(v_code))
        );
        v_try := v_try + 1;
      end loop;

      insert into public.item_stock_lots (user_id, item_id, quantity, lot_code, note, created_at)
      values (v_uid, p_item_id, 1, v_code, coalesce(nullif(trim(p_note), ''), ''), now());

      if btrim(v_lot_codes) = '' then
        v_lot_codes := v_code;
      else
        v_lot_codes := v_lot_codes || ',' || v_code;
      end if;
    end loop;
  else
    if v_qty < p_amount then
      raise exception 'insufficient stock';
    end if;

    if p_lot_id is not null then
      select id, quantity, lot_code
      into r
      from public.item_stock_lots
      where id = p_lot_id
        and item_id = p_item_id
        and user_id = v_uid
      for update;

      if not found then
        raise exception 'lot not found';
      end if;
      if r.quantity < p_amount then
        raise exception 'insufficient stock';
      end if;

      v_lot_codes := btrim(coalesce(r.lot_code, ''));

      if r.quantity <= p_amount then
        delete from public.item_stock_lots where id = r.id;
      else
        update public.item_stock_lots
        set quantity = r.quantity - p_amount
        where id = r.id;
      end if;
    else
      v_rem := p_amount;
      for r in
        select id, quantity, lot_code
        from public.item_stock_lots
        where item_id = p_item_id and user_id = v_uid
        order by created_at asc, id asc
        for update
      loop
        exit when v_rem <= 0;
        if r.quantity <= v_rem then
          if btrim(coalesce(r.lot_code, '')) <> '' then
            if btrim(v_lot_codes) = '' then
              v_lot_codes := btrim(r.lot_code);
            else
              v_lot_codes := v_lot_codes || ',' || btrim(r.lot_code);
            end if;
          end if;
          delete from public.item_stock_lots where id = r.id;
          v_rem := v_rem - r.quantity;
        else
          if btrim(coalesce(r.lot_code, '')) <> '' then
            if btrim(v_lot_codes) = '' then
              v_lot_codes := btrim(r.lot_code);
            else
              v_lot_codes := v_lot_codes || ',' || btrim(r.lot_code);
            end if;
          end if;
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
  end if;

  insert into public.stock_transactions (user_id, item_id, direction, amount, note, project, lot_code)
  values (
    v_uid,
    p_item_id,
    p_direction,
    p_amount,
    coalesce(nullif(trim(p_note), ''), ''),
    coalesce(nullif(trim(p_project), ''), ''),
    coalesce(v_lot_codes, '')
  );

  return json_build_object('ok', true);
end;
$$;

revoke all on function public.apply_stock_move(uuid, text, int, text, text, uuid) from public;
grant execute on function public.apply_stock_move(uuid, text, int, text, text, uuid) to authenticated;

notify pgrst, 'reload schema';

-- ------------------------------------------------------------
-- 016_align_stock_lots_for_scan.sql
-- ------------------------------------------------------------
-- 스캔·출고 정합: lot_code trim, 빈 코드 채우기, 수량·lot 개수 맞춤 (데이터 삭제 없음)
-- Supabase SQL Editor → New query → 전체 Run

update public.item_stock_lots
set lot_code = btrim(lot_code)
where lot_code is not null and lot_code <> btrim(lot_code);

do $$
declare
  r record;
  v_base text;
  v_max int;
  v_code text;
  v_try int;
  v_idx int;
  i int;
  v_need int;
  v_i int;
begin
  for r in
    select l.id, l.user_id, l.item_id, l.quantity, l.created_at
    from public.item_stock_lots l
    where btrim(coalesce(l.lot_code, '')) = '' and l.quantity > 0
    order by l.created_at asc, l.id asc
  loop
    select coalesce(nullif(btrim(i.barcode_code), ''), 'item-' || left(r.item_id::text, 8))
    into v_base
    from public.items i where i.id = r.item_id and i.user_id = r.user_id;

    select coalesce(max(
      (regexp_match(btrim(src.lot_code), '-([0-9]{3,})(?:-r[0-9]+)?$'))[1]::int
    ), 0) into v_max
    from (
      select l2.lot_code from public.item_stock_lots l2
      where l2.item_id = r.item_id and l2.user_id = r.user_id and btrim(l2.lot_code) <> ''
      union all
      select trim(p) from public.stock_transactions st,
        lateral unnest(string_to_array(st.lot_code, ',')) as p
      where st.item_id = r.item_id and st.user_id = r.user_id
        and btrim(st.lot_code) <> '' and btrim(p) <> ''
    ) src;

    if r.quantity > 1 then
      delete from public.item_stock_lots where id = r.id;
      for i in 1..r.quantity loop
        v_try := 0;
        loop
          v_code := v_base || '-' || lpad((v_max + i)::text, 3, '0');
          if v_try > 0 then v_code := v_code || '-r' || v_try::text; end if;
          exit when not exists (
            select 1 from public.item_stock_lots l2
            where l2.user_id = r.user_id and l2.item_id = r.item_id
              and lower(btrim(l2.lot_code)) = lower(btrim(v_code))
          );
          v_try := v_try + 1;
        end loop;
        insert into public.item_stock_lots (user_id, item_id, quantity, lot_code, note, created_at)
        values (r.user_id, r.item_id, 1, v_code, '[스캔정합]', r.created_at);
      end loop;
    else
      v_idx := v_max + 1;
      v_try := 0;
      loop
        v_code := v_base || '-' || lpad(v_idx::text, 3, '0');
        if v_try > 0 then v_code := v_code || '-r' || v_try::text; end if;
        exit when not exists (
          select 1 from public.item_stock_lots l2
          where l2.user_id = r.user_id and l2.item_id = r.item_id
            and lower(btrim(l2.lot_code)) = lower(btrim(v_code))
        );
        v_try := v_try + 1;
      end loop;
      update public.item_stock_lots set lot_code = v_code where id = r.id;
    end if;
  end loop;

  for r in
    select i.id as item_id, i.user_id, i.quantity, i.barcode_code, i.created_at,
      coalesce((
        select sum(l.quantity)::int from public.item_stock_lots l
        where l.item_id = i.id and l.user_id = i.user_id and l.quantity > 0
      ), 0) as lot_qty_sum
    from public.items i
    where i.quantity > 0
  loop
    v_need := r.quantity - r.lot_qty_sum;
    if v_need <= 0 then continue; end if;

    select coalesce(nullif(btrim(r.barcode_code), ''), 'item-' || left(r.item_id::text, 8)) into v_base;

    select coalesce(max(
      (regexp_match(btrim(src.lot_code), '-([0-9]{3,})(?:-r[0-9]+)?$'))[1]::int
    ), 0) into v_max
    from (
      select l2.lot_code from public.item_stock_lots l2
      where l2.item_id = r.item_id and l2.user_id = r.user_id and btrim(l2.lot_code) <> ''
      union all
      select trim(p) from public.stock_transactions st,
        lateral unnest(string_to_array(st.lot_code, ',')) as p
      where st.item_id = r.item_id and st.user_id = r.user_id
        and btrim(st.lot_code) <> '' and btrim(p) <> ''
    ) src;

    for v_i in 1..v_need loop
      v_try := 0;
      loop
        v_code := v_base || '-' || lpad((v_max + v_i)::text, 3, '0');
        if v_try > 0 then v_code := v_code || '-r' || v_try::text; end if;
        exit when not exists (
          select 1 from public.item_stock_lots l2
          where l2.user_id = r.user_id and l2.item_id = r.item_id
            and lower(btrim(l2.lot_code)) = lower(btrim(v_code))
        );
        v_try := v_try + 1;
      end loop;
      insert into public.item_stock_lots (user_id, item_id, quantity, lot_code, note, created_at)
      values (r.user_id, r.item_id, 1, v_code, '[스캔정합]', coalesce(r.created_at, now()));
    end loop;
  end loop;
end $$;

update public.items i
set
  quantity = coalesce((
    select sum(l.quantity)::int
    from public.item_stock_lots l
    where l.item_id = i.id and l.user_id = i.user_id
  ), 0),
  updated_at = now();

notify pgrst, 'reload schema';

-- ------------------------------------------------------------
-- 017_project_completion.sql
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- 018_saas_workspaces.sql
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- 019_plan_prices_vat_included.sql
-- ------------------------------------------------------------
-- 요금 변경 (2026-09-25): 가격은 부가세 포함 금액으로 저장
--   베이직   품목 2,000개까지  25,000원
--   스탠다드 품목 5,000개까지  45,000원
--   프로     5,000개 초과·무제한 70,000원
-- 앱 표시값 lib/saas/plans.ts 와 같게 유지하세요.
update public.plans set item_limit = 2000, monthly_price = 25000 where id = 'basic';
update public.plans set item_limit = 5000, monthly_price = 45000 where id = 'standard';
update public.plans set item_limit = null, monthly_price = 70000 where id = 'pro';
comment on column public.plans.monthly_price is '원/월, 부가세 포함';

-- ------------------------------------------------------------
-- 020_account_members.sql
-- ------------------------------------------------------------
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
