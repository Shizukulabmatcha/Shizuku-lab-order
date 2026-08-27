-- Run once to choose whether the Admin mobile menu is on the left or top.
alter table public.store_settings
add column if not exists admin_mobile_nav_position text not null default 'left';
