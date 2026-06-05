-- ============================================================
-- items.quantity 를 item_stock_lots 합계와 맞춤 (기존 데이터 유지)
-- 출고 후 재고요약 현재재고가 안 맞을 때 Run
-- ============================================================

update public.items i
set
  quantity = coalesce((
    select sum(l.quantity)::int
    from public.item_stock_lots l
    where l.item_id = i.id
      and l.user_id = i.user_id
  ), 0),
  updated_at = now();

notify pgrst, 'reload schema';
