-- ============================================================
-- 품목 병합: source → target
-- QR·lot·거래 이력 유지, source 품목 행만 삭제
--
-- ★ Supabase SQL Editor에서 [0]→[1] 결과 확인 후 [2] Run
-- ★ 이름이 DB와 다르면 [2] 안의 UUID를 [1] 결과로 바꿔 넣으세요
-- ============================================================

-- [0] 비슷한 이름 품목 검색 (정확한 name 확인)
select
  i.id,
  i.name,
  length(i.name) as name_len,
  i.quantity,
  i.barcode_code,
  i.sh
from public.items i
where i.name ilike '%비상판넬%'
   or i.name ilike '%EP500%'
   or i.sh ilike '%EP500%'
order by i.name;

-- [1] 병합 대상 상세 (lot·이력 개수)
select
  i.id,
  i.name,
  i.quantity,
  i.barcode_code,
  count(l.id) as lot_rows,
  count(*) filter (where l.quantity > 0 and btrim(coalesce(l.lot_code, '')) <> '') as active_qr_lots,
  (select count(*) from public.stock_transactions st where st.item_id = i.id) as tx_rows,
  (select count(*) from public.project_usage_plans p where p.item_id = i.id) as plan_rows
from public.items i
left join public.item_stock_lots l on l.item_id = i.id and l.user_id = i.user_id
where i.name ilike '%비상판넬%'
   or i.name ilike '%EP500%'
group by i.id, i.name, i.quantity, i.barcode_code
order by i.name;

-- [2] 병합 실행 — 아래 UUID가 [1]과 다르면 수정 후 Run
do $$
declare
  -- 이름 (자동 매칭용)
  v_target_name text := '비상판넬(SH-EP500)';
  v_source_name text := '비상판넬(SH-EP500)-6.1';
  -- [1]에서 복사한 id 로 직접 지정하면 이름 오차와 무관하게 병합됩니다 (null 이면 이름으로 찾음)
  v_target_id uuid := null;
  v_source_id uuid := null;

  r record;
  v_user_id uuid;
  v_plan record;
  v_target_plan_id uuid;
  v_new_code text;
  v_try int;
  lot_r record;
  v_merged int := 0;
  v_has_inventory_events boolean;
  v_has_project_plans boolean;
  v_has_install_date boolean;
  v_has_plan_updated_at boolean;
  v_lots_moved int;
  v_tx_moved int;
begin
  v_has_inventory_events := to_regclass('public.inventory_events') is not null;
  v_has_project_plans := to_regclass('public.project_usage_plans') is not null;

  if v_has_project_plans then
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'project_usage_plans' and column_name = 'install_date'
    ) into v_has_install_date;
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'project_usage_plans' and column_name = 'updated_at'
    ) into v_has_plan_updated_at;
  end if;

  for r in
    select
      t.id as target_id,
      s.id as source_id,
      t.user_id
    from public.items t
    inner join public.items s on s.user_id = t.user_id
    where
      (
        v_target_id is not null
        and v_source_id is not null
        and t.id = v_target_id
        and s.id = v_source_id
      )
      or (
        v_target_id is null
        and v_source_id is null
        and btrim(t.name) = btrim(v_target_name)
        and btrim(s.name) = btrim(v_source_name)
      )
  loop
    v_target_id := r.target_id;
    v_source_id := r.source_id;
    v_user_id := r.user_id;

    if v_target_id = v_source_id then
      raise exception 'target과 source가 같은 품목입니다.';
    end if;

    raise notice '병합 시작: % → %', v_source_id, v_target_id;

    -- QR 중복 시 source 쪽 코드만 변경
    for lot_r in
      select l.id, l.lot_code
      from public.item_stock_lots l
      where l.item_id = v_source_id
        and l.user_id = v_user_id
        and btrim(coalesce(l.lot_code, '')) <> ''
        and exists (
          select 1 from public.item_stock_lots t
          where t.user_id = l.user_id
            and t.item_id = v_target_id
            and lower(btrim(t.lot_code)) = lower(btrim(l.lot_code))
        )
    loop
      v_try := 1;
      loop
        v_new_code := lot_r.lot_code || '-mg' || v_try::text;
        exit when not exists (
          select 1 from public.item_stock_lots t
          where t.user_id = v_user_id
            and t.item_id in (v_target_id, v_source_id)
            and lower(btrim(t.lot_code)) = lower(btrim(v_new_code))
        );
        v_try := v_try + 1;
      end loop;
      update public.item_stock_lots set lot_code = v_new_code where id = lot_r.id;
    end loop;

    update public.item_stock_lots
    set item_id = v_target_id
    where item_id = v_source_id and user_id = v_user_id;
    get diagnostics v_lots_moved = row_count;

    update public.stock_transactions
    set item_id = v_target_id
    where item_id = v_source_id and user_id = v_user_id;
    get diagnostics v_tx_moved = row_count;

    if v_has_project_plans then
      for v_plan in
        select id, project_name, planned_qty, install_date
        from public.project_usage_plans
        where item_id = v_source_id and user_id = v_user_id
      loop
        v_target_plan_id := null;
        select id into v_target_plan_id
        from public.project_usage_plans
        where user_id = v_user_id
          and project_name = v_plan.project_name
          and item_id = v_target_id
        limit 1;

        if v_target_plan_id is not null then
          if v_has_install_date and v_has_plan_updated_at then
            update public.project_usage_plans
            set
              planned_qty = planned_qty + v_plan.planned_qty,
              install_date = coalesce(install_date, v_plan.install_date),
              updated_at = now()
            where id = v_target_plan_id;
          elsif v_has_install_date then
            update public.project_usage_plans
            set
              planned_qty = planned_qty + v_plan.planned_qty,
              install_date = coalesce(install_date, v_plan.install_date)
            where id = v_target_plan_id;
          elsif v_has_plan_updated_at then
            update public.project_usage_plans
            set planned_qty = planned_qty + v_plan.planned_qty, updated_at = now()
            where id = v_target_plan_id;
          else
            update public.project_usage_plans
            set planned_qty = planned_qty + v_plan.planned_qty
            where id = v_target_plan_id;
          end if;
          delete from public.project_usage_plans where id = v_plan.id;
        else
          if v_has_plan_updated_at then
            update public.project_usage_plans
            set item_id = v_target_id, updated_at = now()
            where id = v_plan.id;
          else
            update public.project_usage_plans
            set item_id = v_target_id
            where id = v_plan.id;
          end if;
        end if;
      end loop;
    end if;

    if v_has_inventory_events then
      update public.inventory_events
      set item_id = v_target_id
      where item_id = v_source_id and user_id = v_user_id;
    end if;

    delete from public.items
    where id = v_source_id and user_id = v_user_id;

    if not found then
      raise exception 'source 품목 삭제 실패 (id=%). 남은 lot/이력이 있는지 [1]에서 확인하세요.', v_source_id;
    end if;

    update public.items i
    set
      quantity = coalesce((
        select sum(l.quantity)::int
        from public.item_stock_lots l
        where l.item_id = v_target_id and l.user_id = v_user_id
      ), 0),
      updated_at = now()
    where i.id = v_target_id and i.user_id = v_user_id;

    v_merged := v_merged + 1;
    raise notice '병합 완료 — lot %건, 거래 %건 이동', v_lots_moved, v_tx_moved;
  end loop;

  if v_merged = 0 then
    raise exception
      '병합할 품목 쌍을 찾지 못했습니다. [0][1] 결과의 id 를 [2]의 v_target_id / v_source_id 에 넣고 다시 Run 하세요. (이름: "%" / "%")',
      v_target_name, v_source_name;
  end if;
end $$;

-- [3] 병합 후 확인
select
  i.id,
  i.name,
  i.quantity,
  i.barcode_code,
  count(l.id) as lot_rows,
  count(*) filter (where l.quantity > 0 and btrim(coalesce(l.lot_code, '')) <> '') as active_qr_lots
from public.items i
left join public.item_stock_lots l on l.item_id = i.id and l.user_id = i.user_id
where i.name ilike '%비상판넬%'
   or i.name ilike '%EP500%'
group by i.id, i.name, i.quantity, i.barcode_code
order by i.name;

notify pgrst, 'reload schema';
