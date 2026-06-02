-- ============================================================
-- 바코드 화면 복구 (품목·입출고 이력 삭제 없음)
--
-- 순서:
--   1) diagnose_barcode_state.sql 실행 → 문제 유형 확인
--   2) (선택) sync 롤백: 아래 delete 주석 해제 후 이 파일만 Run
--   3) 이 파일 전체 Run
--   4) diagnose 다시 → ok_clickable 확인
--   5) 앱 Ctrl+F5 새로고침
--
-- 주의: one_shot_reset / 전체 drop 은 하지 마세요.
-- one_shot_fix_rpc_only 는 되돌리지 마세요 (입출고 RPC).
-- ============================================================

-- [선택] sync_lots_from_item_quantity.sql 로 넣은 lot만 제거
-- delete from public.item_stock_lots where note = '[수량동기화]';

-- [A] 빈 lot_code 채우기
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
        values (r.user_id, r.item_id, 1, v_code, '', r.created_at);
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
end $$;

-- [B] 수량은 있는데 lot 행이 없는 품목만 lot 추가 (전체 quantity 덮어쓰기 없음)
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
      values (r.user_id, r.item_id, 1, v_code, '[수량동기화]', coalesce(r.created_at, now()));
    end loop;
  end loop;
end $$;

notify pgrst, 'reload schema';
