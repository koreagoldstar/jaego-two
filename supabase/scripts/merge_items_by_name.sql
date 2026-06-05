-- ============================================================
-- 품목 병합: source → target (이름으로 지정)
-- · item_stock_lots (단위 QR) · stock_transactions · project_usage_plans 이동/합산
-- · target 품목명·barcode_code 유지, source 품목 행만 삭제
--
-- 사용: 아래 v_target_name / v_source_name 확인 후 Supabase SQL Editor → Run
-- ============================================================

-- [1] 병합 전 확인 (읽기 전용)
select
  i.id,
  i.name,
  i.quantity,
  i.barcode_code,
  i.sh,
  count(l.id) as lot_rows,
  count(*) filter (where l.quantity > 0 and btrim(coalesce(l.lot_code, '')) <> '') as active_qr_lots
from public.items i
left join public.item_stock_lots l on l.item_id = i.id and l.user_id = i.user_id
where i.name in ('비상판넬(SH-EP500)', '비상판넬(SH-EP500)-6.1')
group by i.id, i.name, i.quantity, i.barcode_code, i.sh
order by i.name;

-- [2] 병합 실행
do $$
declare
  v_target_name text := '비상판넬(SH-EP500)';
  v_source_name text := '비상판넬(SH-EP500)-6.1';
  r record;
  v_target_id uuid;
  v_source_id uuid;
  v_user_id uuid;
  v_plan record;
  v_target_plan_id uuid;
  v_new_code text;
  v_try int;
  lot_r record;
begin
  for r in
    select
      t.id as target_id,
      s.id as source_id,
      t.user_id
    from public.items t
    inner join public.items s
      on s.user_id = t.user_id
      and s.name = v_source_name
    where t.name = v_target_name
  loop
    v_target_id := r.target_id;
    v_source_id := r.source_id;
    v_user_id := r.user_id;

    if v_target_id = v_source_id then
      raise exception 'target과 source가 같은 품목입니다.';
    end if;

    raise notice '병합: "%" → "%" (user %)', v_source_name, v_target_name, v_user_id;

    -- QR 중복: target에 같은 lot_code가 있으면 source 쪽에 접미사 부여 후 이동
    for lot_r in
      select l.id, l.lot_code
      from public.item_stock_lots l
      where l.item_id = v_source_id
        and l.user_id = v_user_id
        and btrim(coalesce(l.lot_code, '')) <> ''
        and exists (
          select 1
          from public.item_stock_lots t
          where t.user_id = l.user_id
            and t.item_id = v_target_id
            and lower(btrim(t.lot_code)) = lower(btrim(l.lot_code))
        )
    loop
      v_try := 1;
      loop
        v_new_code := lot_r.lot_code || '-mg' || v_try::text;
        exit when not exists (
          select 1
          from public.item_stock_lots t
          where t.user_id = v_user_id
            and t.item_id in (v_target_id, v_source_id)
            and lower(btrim(t.lot_code)) = lower(btrim(v_new_code))
        );
        v_try := v_try + 1;
      end loop;
      update public.item_stock_lots
      set lot_code = v_new_code
      where id = lot_r.id;
      raise notice '  lot QR 중복 → %', v_new_code;
    end loop;

    update public.item_stock_lots
    set item_id = v_target_id
    where item_id = v_source_id
      and user_id = v_user_id;

  -- 거래 이력
    update public.stock_transactions
    set item_id = v_target_id
    where item_id = v_source_id
      and user_id = v_user_id;

  -- 프로젝트 예정: 같은 프로젝트면 수량 합산
    for v_plan in
      select *
      from public.project_usage_plans
      where item_id = v_source_id
        and user_id = v_user_id
    loop
      select id
      into v_target_plan_id
      from public.project_usage_plans
      where user_id = v_user_id
        and project_name = v_plan.project_name
        and item_id = v_target_id
      limit 1;

      if v_target_plan_id is not null then
        update public.project_usage_plans
        set
          planned_qty = planned_qty + v_plan.planned_qty,
          install_date = coalesce(install_date, v_plan.install_date),
          updated_at = now()
        where id = v_target_plan_id;

        delete from public.project_usage_plans where id = v_plan.id;
      else
        update public.project_usage_plans
        set item_id = v_target_id, updated_at = now()
        where id = v_plan.id;
      end if;
    end loop;

    update public.inventory_events
    set item_id = v_target_id
    where item_id = v_source_id
      and user_id = v_user_id;

    delete from public.items
    where id = v_source_id
      and user_id = v_user_id;

    update public.items i
    set
      quantity = coalesce((
        select sum(l.quantity)::int
        from public.item_stock_lots l
        where l.item_id = v_target_id
          and l.user_id = v_user_id
      ), 0),
      updated_at = now()
    where i.id = v_target_id
      and i.user_id = v_user_id;

    raise notice '  완료 — target 수량: %', (
      select quantity from public.items where id = v_target_id
    );
  end loop;
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
where i.name in ('비상판넬(SH-EP500)', '비상판넬(SH-EP500)-6.1')
group by i.id, i.name, i.quantity, i.barcode_code
order by i.name;

notify pgrst, 'reload schema';
