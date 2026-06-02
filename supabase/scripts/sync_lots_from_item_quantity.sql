-- ============================================================
-- 기존 데이터 유지 · 품목 수량(items.quantity) 기준으로 lot 보강
--
-- backfill_empty_lot_codes.sql 은 "이미 있는 lot 행"만 채웁니다.
-- 수량은 있는데 lot 행이 없으면 이 스크립트를 Run 하세요.
--
-- 순서 권장:
--   1) sync_lots_from_item_quantity.sql  (이 파일)
--   2) backfill_empty_lot_codes.sql       (빈 QR 채우기)
-- ============================================================

do $$
declare
  r record;
  v_base text;
  v_max int;
  v_code text;
  v_try int;
  v_need int;
  v_i int;
begin
  for r in
    select
      i.id as item_id,
      i.user_id,
      i.quantity,
      i.barcode_code,
      i.created_at,
      coalesce((
        select sum(l.quantity)::int
        from public.item_stock_lots l
        where l.item_id = i.id
          and l.user_id = i.user_id
          and l.quantity > 0
      ), 0) as lot_qty_sum
    from public.items i
    where i.quantity > 0
  loop
    v_need := r.quantity - r.lot_qty_sum;
    if v_need <= 0 then
      continue;
    end if;

    select coalesce(
      nullif(btrim(r.barcode_code), ''),
      'item-' || left(r.item_id::text, 8)
    )
    into v_base;

    select coalesce(max(
      (regexp_match(btrim(src.lot_code), '-([0-9]{3,})(?:-r[0-9]+)?$'))[1]::int
    ), 0)
    into v_max
    from (
      select l2.lot_code
      from public.item_stock_lots l2
      where l2.item_id = r.item_id
        and l2.user_id = r.user_id
        and btrim(l2.lot_code) <> ''
      union all
      select trim(p) as lot_code
      from public.stock_transactions st,
           lateral unnest(string_to_array(st.lot_code, ',')) as p
      where st.item_id = r.item_id
        and st.user_id = r.user_id
        and btrim(st.lot_code) <> ''
        and btrim(p) <> ''
    ) src;

    for v_i in 1..v_need loop
      v_try := 0;
      loop
        v_code := v_base || '-' || lpad((v_max + v_i)::text, 3, '0');
        if v_try > 0 then
          v_code := v_code || '-r' || v_try::text;
        end if;
        exit when not exists (
          select 1
          from public.item_stock_lots l2
          where l2.user_id = r.user_id
            and l2.item_id = r.item_id
            and lower(btrim(l2.lot_code)) = lower(btrim(v_code))
        );
        v_try := v_try + 1;
      end loop;

      insert into public.item_stock_lots (user_id, item_id, quantity, lot_code, note, created_at)
      values (
        r.user_id,
        r.item_id,
        1,
        v_code,
        '[수량동기화]',
        coalesce(r.created_at, now())
      );
    end loop;
  end loop;
end $$;

-- lot 합계로 items.quantity 맞춤 (트리거가 있어도 한 번 더)
update public.items i
set
  quantity = coalesce((
    select sum(l.quantity)::int
    from public.item_stock_lots l
    where l.item_id = i.id and l.user_id = i.user_id
  ), 0),
  updated_at = now();

notify pgrst, 'reload schema';
