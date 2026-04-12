-- 입출고 시 프로젝트(현장/행사 등) 구분
alter table public.stock_transactions add column if not exists project text default '' not null;

create or replace function public.apply_stock_move(
  p_item_id uuid,
  p_direction text,
  p_amount int,
  p_note text default '',
  p_project text default ''
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_qty int;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if p_amount <= 0 then
    raise exception 'invalid amount';
  end if;
  if p_direction not in ('in', 'out') then
    raise exception 'invalid direction';
  end if;

  select quantity into v_qty from public.items where id = p_item_id and user_id = v_uid for update;
  if not found then
    raise exception 'item not found';
  end if;

  if p_direction = 'in' then
    update public.items
    set quantity = quantity + p_amount, updated_at = now()
    where id = p_item_id and user_id = v_uid;
  else
    if v_qty < p_amount then
      raise exception 'insufficient stock';
    end if;
    update public.items
    set quantity = quantity - p_amount, updated_at = now()
    where id = p_item_id and user_id = v_uid;
  end if;

  insert into public.stock_transactions (user_id, item_id, direction, amount, note, project)
  values (
    v_uid,
    p_item_id,
    p_direction,
    p_amount,
    coalesce(nullif(trim(p_note), ''), ''),
    coalesce(nullif(trim(p_project), ''), '')
  );

  return json_build_object('ok', true);
end;
$$;

revoke all on function public.apply_stock_move from public;
grant execute on function public.apply_stock_move to authenticated;
