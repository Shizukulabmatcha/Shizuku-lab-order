-- Optional label displayed below each product on the customer menu.
alter table public.products add column if not exists menu_tag text;
