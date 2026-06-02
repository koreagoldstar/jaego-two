-- 「샘플」 품목 상태 확인 (읽기 전용)
-- printable_lots 가 0 이고 quantity > 0 이면 fix_barcode_state.sql Run

select
  i.id,
  i.name,
  i.quantity,
  i.barcode_code,
  count(l.id) as lot_rows,
  count(*) filter (
    where l.quantity > 0 and btrim(coalesce(l.lot_code, '')) <> ''
  ) as printable_lots,
  case
    when coalesce(i.quantity, 0) <= 0 then '재고 0'
    when count(*) filter (
      where l.quantity > 0 and btrim(coalesce(l.lot_code, '')) <> ''
    ) > 0 then 'OK — 앱 새로고침'
    when count(l.id) = 0 then 'lot 없음 → fix_barcode_state.sql'
    else 'QR 비어 있음 → fix_barcode_state.sql'
  end as next_step
from public.items i
left join public.item_stock_lots l on l.item_id = i.id and l.user_id = i.user_id
where i.name = '샘플'
group by i.id, i.name, i.quantity, i.barcode_code;
