-- Optional customer-facing highlight, separate from the existing small menu label.
alter table public.products
  add column if not exists menu_badge text;

alter table public.products
  drop constraint if exists products_menu_badge_check;
alter table public.products
  add constraint products_menu_badge_check
  check (menu_badge is null or char_length(menu_badge) <= 24);

notify pgrst, 'reload schema';
