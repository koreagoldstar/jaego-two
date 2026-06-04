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
