-- ============================================================
-- 기존 데이터 유지 · 빈 lot_code만 채움 (바코드 화면용)
-- 삭제하지 않음: items, stock_transactions, inventory_events 등
--
-- Supabase SQL Editor → New query → 전체 붙여넣기 → Run 1회
--
-- 하지 마세요: one_shot_reset_and_setup.sql (품목·이력 전부 삭제)
-- 이미 했다면: one_shot_fix_rpc_only.sql 만으로는 lot_code 가 채워지지 않음
--
-- backfill 후에도 바코드에 "QR 스캔 코드가 필요합니다"면:
--   → lot 행이 없을 수 있음. 먼저 sync_lots_from_item_quantity.sql 실행
-- ============================================================

do $$
declare
  r record;
  v_base text;
  v_max int;
  v_code text;
  v_try int;
  v_idx int;
  i int;
begin
  for r in
    select
      l.id,
      l.user_id,
      l.item_id,
      l.quantity,
      l.created_at
    from public.item_stock_lots l
    where btrim(coalesce(l.lot_code, '')) = ''
      and l.quantity > 0
    order by l.created_at asc, l.id asc
  loop
    select coalesce(
      nullif(btrim(i.barcode_code), ''),
      'item-' || left(r.item_id::text, 8)
    )
    into v_base
    from public.items i
    where i.id = r.item_id and i.user_id = r.user_id;

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

    if r.quantity > 1 then
      delete from public.item_stock_lots where id = r.id;

      for i in 1..r.quantity loop
        v_try := 0;
        loop
          v_code := v_base || '-' || lpad((v_max + i)::text, 3, '0');
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
        values (r.user_id, r.item_id, 1, v_code, '', r.created_at);
      end loop;
    else
      v_idx := v_max + 1;
      v_try := 0;
      loop
        v_code := v_base || '-' || lpad(v_idx::text, 3, '0');
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

      update public.item_stock_lots
      set lot_code = v_code
      where id = r.id;
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
