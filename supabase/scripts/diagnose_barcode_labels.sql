-- 바코드 화면 "QR 스캔 코드가 필요합니다" 원인 확인 (읽기 전용)
-- SQL Editor → New query → Run

select
  i.name,
  i.quantity as item_qty,
  btrim(coalesce(i.barcode_code, '')) = '' as no_item_barcode,
  count(l.id) as lot_rows,
  coalesce(sum(l.quantity) filter (where l.quantity > 0), 0) as lot_qty_sum,
  count(*) filter (
    where l.quantity > 0 and btrim(coalesce(l.lot_code, '')) <> ''
  ) as printable_lots,
  case
    when i.quantity <= 0 then '재고 0 → 라벨 없음 (정상)'
    when count(l.id) = 0 then 'lot 행 없음 → sync 스크립트 필요'
    when count(*) filter (
      where l.quantity > 0 and btrim(coalesce(l.lot_code, '')) <> ''
    ) = 0 then 'lot는 있으나 QR 비어 있음 → backfill 다시 또는 sync'
    when coalesce(sum(l.quantity) filter (where l.quantity > 0), 0) < i.quantity
      then 'lot 수량 < 품목 수량 → sync 스크립트 필요'
    else 'OK (바코드에 나와야 함)'
  end as diagnosis
from public.items i
left join public.item_stock_lots l on l.item_id = i.id and l.user_id = i.user_id
group by i.id, i.name, i.quantity, i.barcode_code
order by i.name;
