-- 요금 변경 (2026-09-25): 가격은 부가세 포함 금액으로 저장
--   베이직   품목 2,000개까지  25,000원
--   스탠다드 품목 5,000개까지  45,000원
--   프로     5,000개 초과·무제한 70,000원
-- 앱 표시값 lib/saas/plans.ts 와 같게 유지하세요.
update public.plans set item_limit = 2000, monthly_price = 25000 where id = 'basic';
update public.plans set item_limit = 5000, monthly_price = 45000 where id = 'standard';
update public.plans set item_limit = null, monthly_price = 70000 where id = 'pro';
comment on column public.plans.monthly_price is '원/월, 부가세 포함';
