-- 기존 DB: items.sku → items.sh (내부코드 SH)
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'items'
      and column_name = 'sku'
  ) then
    alter table public.items rename column sku to sh;
  end if;
end $$;
