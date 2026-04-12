-- items 테이블이 예전/수동으로 만들어져 barcode_code 등이 없을 때 먼저 실행하세요.
-- 그 다음 001_initial.sql 의 나머지(인덱스·RLS·함수)를 실행하면 됩니다.

alter table public.items add column if not exists barcode_code text default '';
alter table public.items add column if not exists serial_number text default '';
alter table public.items add column if not exists sh text default '';
alter table public.items add column if not exists location text default '';
alter table public.items add column if not exists description text default '';
alter table public.items add column if not exists quantity integer;
alter table public.items add column if not exists created_at timestamptz default now();
alter table public.items add column if not exists updated_at timestamptz default now();

-- quantity가 새로 생겼을 때 기본값
update public.items set quantity = 0 where quantity is null;
alter table public.items alter column quantity set default 0;
alter table public.items alter column quantity set not null;

update public.items set description = coalesce(description, '');
update public.items set barcode_code = coalesce(barcode_code, '');
update public.items set serial_number = coalesce(serial_number, '');
update public.items set sh = coalesce(sh, '');
update public.items set location = coalesce(location, '');

-- 인덱스(001에서 실패했던 부분)
create unique index if not exists items_user_barcode_unique
  on public.items (user_id, barcode_code)
  where barcode_code is not null and barcode_code <> '';
