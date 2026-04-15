-- 입고 단위별 QR(스캔 코드). 동일 품목 내 비어 있지 않은 값은 유일해야 함.

alter table public.item_stock_lots
  add column if not exists lot_code text not null default '';

create unique index if not exists item_stock_lots_unique_qr_per_item
  on public.item_stock_lots (user_id, item_id, (lower(btrim(lot_code))))
  where btrim(lot_code) <> '';

notify pgrst, 'reload schema';
