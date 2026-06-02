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
