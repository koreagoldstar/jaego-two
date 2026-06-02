-- ============================================================
-- 바코드 화면 상태 진단 (읽기 전용)
-- SQL Editor → New query → 전체 Run
-- ============================================================

-- [1] 요약: 왜 "QR 스캔 코드가 필요합니다" / 클릭 불가인지
select
  count(*) as total_items,
  count(*) filter (where i.quantity > 0) as items_with_stock_qty,
  count(*) filter (where diag = 'OK_바코드선택가능') as ok_clickable,
  count(*) filter (where diag = 'A_재고0') as a_no_stock,
  count(*) filter (where diag = 'B_lot없음_수량만있음') as b_no_lots,
  count(*) filter (where diag = 'C_lot있으나_QR비어있음') as c_empty_lot_code,
  count(*) filter (where diag = 'D_품목QR없음') as d_no_item_barcode,
  count(*) filter (where diag = 'E_lot수량과품목수량불일치') as e_qty_mismatch
from (
  select
    i.id,
    i.quantity,
    i.barcode_code,
    case
      when coalesce(i.quantity, 0) <= 0 then 'A_재고0'
      when btrim(coalesce(i.barcode_code, '')) = '' then 'D_품목QR없음'
      when coalesce(lot_rows, 0) = 0 then 'B_lot없음_수량만있음'
      when coalesce(printable_lots, 0) = 0 then 'C_lot있으나_QR비어있음'
      when coalesce(lot_qty_sum, 0) <> i.quantity then 'E_lot수량과품목수량불일치'
      else 'OK_바코드선택가능'
    end as diag
  from public.items i
  left join lateral (
    select
      count(*)::int as lot_rows,
      coalesce(sum(l.quantity) filter (where l.quantity > 0), 0)::int as lot_qty_sum,
      count(*) filter (
        where l.quantity > 0 and btrim(coalesce(l.lot_code, '')) <> ''
      )::int as printable_lots
    from public.item_stock_lots l
    where l.item_id = i.id and l.user_id = i.user_id
  ) x on true
) t;

-- [2] 문제 품목 목록 (상위 50개)
select
  i.name,
  i.quantity as item_qty,
  i.barcode_code,
  coalesce(x.lot_rows, 0) as lot_rows,
  coalesce(x.printable_lots, 0) as printable_lots,
  coalesce(x.sync_lots, 0) as sync_added_lots,
  case
    when coalesce(i.quantity, 0) <= 0 then 'A_재고0 — 정상(라벨없음)'
    when btrim(coalesce(i.barcode_code, '')) = '' then 'D_품목 수정에서 QR 스캔 코드 입력'
    when coalesce(x.lot_rows, 0) = 0 then 'B_fix_barcode_state.sql 1단계'
    when coalesce(x.printable_lots, 0) = 0 then 'C_fix_barcode_state.sql 2단계(backfill)'
    when coalesce(x.lot_qty_sum, 0) <> i.quantity then 'E_fix 또는 수량 정리'
    else 'OK'
  end as diagnosis
from public.items i
left join lateral (
  select
    count(*)::int as lot_rows,
    coalesce(sum(l.quantity) filter (where l.quantity > 0), 0)::int as lot_qty_sum,
    count(*) filter (
      where l.quantity > 0 and btrim(coalesce(l.lot_code, '')) <> ''
    )::int as printable_lots,
    count(*) filter (where l.note = '[수량동기화]')::int as sync_lots
  from public.item_stock_lots l
  where l.item_id = i.id and l.user_id = i.user_id
) x on true
where
  coalesce(i.quantity, 0) > 0
  and (
    coalesce(x.printable_lots, 0) = 0
    or coalesce(x.lot_qty_sum, 0) <> i.quantity
  )
order by i.name
limit 50;

-- [3] sync 스크립트로 추가된 lot 개수 (되돌릴 때 참고)
select count(*) as sync_lots_to_rollback
from public.item_stock_lots
where note = '[수량동기화]';

-- [4] 계정별 lot (로그인 계정 확인용)
select
  u.email,
  i.user_id,
  count(distinct i.id) as items,
  count(l.id) filter (
    where l.quantity > 0 and btrim(coalesce(l.lot_code, '')) <> ''
  ) as printable_lots
from public.items i
left join auth.users u on u.id = i.user_id
left join public.item_stock_lots l on l.item_id = i.id and l.user_id = i.user_id
group by i.user_id, u.email
order by printable_lots desc;
