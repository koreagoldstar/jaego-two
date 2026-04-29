-- 기존 묶음 lot(quantity > 1)를 1개 단위 lot로 분해합니다.
-- 기존 라벨 관행에 맞춰 base-001, base-002 ... 형태를 우선 사용합니다.
-- 동일 품목 내 중복이 생기면 뒤에 -rN 접미사를 붙여 충돌을 피합니다.

do $$
declare
  r record;
  i integer;
  suffix_try integer;
  raw_code text;
  base_code text;
  candidate text;
begin
  for r in
    select id, user_id, item_id, quantity, lot_code, note, created_at
    from public.item_stock_lots
    where quantity > 1
    order by created_at asc, id asc
  loop
    raw_code := btrim(coalesce(r.lot_code, ''));
    if raw_code = '' then
      base_code := 'lot-' || left(r.id::text, 8);
    elsif raw_code ~ '-[0-9]{3}$' then
      base_code := regexp_replace(raw_code, '-[0-9]{3}$', '');
    else
      base_code := raw_code;
    end if;

    delete from public.item_stock_lots where id = r.id;

    for i in 1..r.quantity loop
      candidate := base_code || '-' || lpad(i::text, 3, '0');
      suffix_try := 1;

      while exists (
        select 1
        from public.item_stock_lots l
        where l.user_id = r.user_id
          and l.item_id = r.item_id
          and lower(btrim(l.lot_code)) = lower(btrim(candidate))
      ) loop
        suffix_try := suffix_try + 1;
        candidate := base_code || '-' || lpad(i::text, 3, '0') || '-r' || suffix_try::text;
      end loop;

      insert into public.item_stock_lots (user_id, item_id, quantity, lot_code, note, created_at)
      values (r.user_id, r.item_id, 1, candidate, coalesce(r.note, ''), r.created_at);
    end loop;
  end loop;
end $$;

notify pgrst, 'reload schema';
