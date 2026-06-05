-- ============================================================
-- 랙(SHRC-2075N) 복구 + 랙(SHRC-1675N) 병합
-- 아래 전체 복사 → Supabase SQL Editor → Run 한 번
-- ============================================================

do $$
declare
  pairs constant text[][] := array[
    array['랙(SHRC-2075N)', '랙(SHRC-2075N)-5.27'],
    array['랙(SHRC-1675N)', '랙(SHRC-1675N)-5.27']
  ];
  v_target_name text;
  v_source_name text;
  i int;
  r record;
  v_plan record;
  v_target_plan_id uuid;
  v_new_code text;
  v_try int;
  lot_r record;
  v_fixed int := 0;
  v_has_events boolean;
  v_has_plans boolean;
begin
  v_has_events := to_regclass('public.inventory_events') is not null;
  v_has_plans := to_regclass('public.project_usage_plans') is not null;

  for i in 1..array_length(pairs, 1) loop
    v_target_name := pairs[i][1];
    v_source_name := pairs[i][2];

    -- 기본 품목 없고 -5.27 만 있으면 이름만 변경 (QR·lot 유지)
    for r in
      select s.id, s.user_id, s.name
      from public.items s
      where btrim(s.name) = btrim(v_source_name)
        and not exists (
          select 1 from public.items t
          where t.user_id = s.user_id
            and btrim(t.name) = btrim(v_target_name)
        )
    loop
      update public.items
      set name = v_target_name, updated_at = now()
      where id = r.id;

      update public.items
      set
        quantity = coalesce((
          select sum(l.quantity)::int
          from public.item_stock_lots l
          where l.item_id = r.id and l.user_id = r.user_id
        ), 0),
        updated_at = now()
      where id = r.id;

      raise notice '이름 복구: "%" → "%"', r.name, v_target_name;
      v_fixed := v_fixed + 1;
    end loop;

    -- 둘 다 있으면 병합
    for r in
      select
        t.id as target_id,
        s.id as source_id,
        t.user_id,
        t.name as target_name,
        s.name as source_name
      from public.items t
      inner join public.items s
        on s.user_id = t.user_id
        and s.id <> t.id
        and btrim(s.name) = btrim(v_source_name)
      where btrim(t.name) = btrim(v_target_name)
    loop
      raise notice '병합: "%" → "%"', r.source_name, r.target_name;

      for lot_r in
        select l.id, l.lot_code
        from public.item_stock_lots l
        where l.item_id = r.source_id
          and l.user_id = r.user_id
          and btrim(coalesce(l.lot_code, '')) <> ''
          and exists (
            select 1 from public.item_stock_lots t
            where t.user_id = l.user_id
              and t.item_id = r.target_id
              and lower(btrim(t.lot_code)) = lower(btrim(l.lot_code))
          )
      loop
        v_try := 1;
        loop
          v_new_code := lot_r.lot_code || '-mg' || v_try::text;
          exit when not exists (
            select 1 from public.item_stock_lots t
            where t.user_id = r.user_id
              and t.item_id in (r.target_id, r.source_id)
              and lower(btrim(t.lot_code)) = lower(btrim(v_new_code))
          );
          v_try := v_try + 1;
        end loop;
        update public.item_stock_lots set lot_code = v_new_code where id = lot_r.id;
      end loop;

      update public.item_stock_lots
      set item_id = r.target_id
      where item_id = r.source_id and user_id = r.user_id;

      update public.stock_transactions
      set item_id = r.target_id
      where item_id = r.source_id and user_id = r.user_id;

      if v_has_plans then
        for v_plan in
          select id, project_name, planned_qty
          from public.project_usage_plans
          where item_id = r.source_id and user_id = r.user_id
        loop
          v_target_plan_id := null;
          select id into v_target_plan_id
          from public.project_usage_plans
          where user_id = r.user_id
            and project_name = v_plan.project_name
            and item_id = r.target_id
          limit 1;

          if v_target_plan_id is not null then
            update public.project_usage_plans
            set planned_qty = planned_qty + v_plan.planned_qty
            where id = v_target_plan_id;
            delete from public.project_usage_plans where id = v_plan.id;
          else
            update public.project_usage_plans
            set item_id = r.target_id
            where id = v_plan.id;
          end if;
        end loop;
      end if;

      if v_has_events then
        update public.inventory_events
        set item_id = r.target_id
        where item_id = r.source_id and user_id = r.user_id;
      end if;

      delete from public.items
      where id = r.source_id and user_id = r.user_id;

      update public.items
      set
        quantity = coalesce((
          select sum(l.quantity)::int
          from public.item_stock_lots l
          where l.item_id = r.target_id and l.user_id = r.user_id
        ), 0),
        updated_at = now()
      where id = r.target_id and user_id = r.user_id;

      v_fixed := v_fixed + 1;
    end loop;
  end loop;

  raise notice '총 %건 처리', v_fixed;
end $$;

select
  i.name,
  i.quantity as 현재재고,
  i.barcode_code as 바코드,
  count(l.id) as lot수
from public.items i
left join public.item_stock_lots l on l.item_id = i.id and l.user_id = i.user_id
where i.name ilike '%SHRC-2075N%'
   or i.name ilike '%SHRC-1675N%'
group by i.id, i.name, i.quantity, i.barcode_code
order by i.name;

notify pgrst, 'reload schema';
