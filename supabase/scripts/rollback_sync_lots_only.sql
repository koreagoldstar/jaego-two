-- sync_lots_from_item_quantity.sql / fix_barcode_state [B] 로 추가된 lot만 제거
-- Run 후 items.quantity 는 lot 합계로 다시 맞춤 (삭제된 만큼 줄어듦)

delete from public.item_stock_lots where note = '[수량동기화]';

update public.items i
set
  quantity = coalesce((
    select sum(l.quantity)::int
    from public.item_stock_lots l
    where l.item_id = i.id and l.user_id = i.user_id
  ), 0),
  updated_at = now();

notify pgrst, 'reload schema';
