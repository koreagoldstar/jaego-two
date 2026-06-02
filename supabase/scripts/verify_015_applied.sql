-- 015 마이그레이션 적용 확인용 (읽기 전용). SQL Editor에서 실행 후 결과만 확인하세요.

-- 1) apply_stock_move 함수가 6개 인자 1개만 있어야 함 (중복이면 입출고 오류)
select
  p.proname as name,
  pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'apply_stock_move'
order by arguments;
-- 기대: arguments 1행 → uuid, text, integer, text, text, uuid

-- 2) stock_transactions.lot_code 컬럼
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'stock_transactions'
  and column_name = 'lot_code';
-- 기대: lot_code | text | NO (또는 YES)

-- 3) 입고 로직에 출고 이력 반영 여부 (함수 본문에 stock_transactions 포함)
select
  case
    when pg_get_functiondef(p.oid) ilike '%stock_transactions%'
      and pg_get_functiondef(p.oid) ilike '%p_lot_id%'
      and pg_get_functiondef(p.oid) ilike '%lot_code%'
      and pg_get_functiondef(p.oid) ilike '%{3,}%'
    then 'OK: 015 패치 반영된 것으로 보임'
    else '확인 필요: 015를 다시 실행하세요'
  end as check_015
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'apply_stock_move'
  and pg_get_function_identity_arguments(p.oid) like '%uuid%uuid%';
