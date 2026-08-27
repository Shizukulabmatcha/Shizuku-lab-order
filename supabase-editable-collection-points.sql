-- Run once to manage Checkout collection points from Admin > Store settings.
alter table public.store_settings
add column if not exists collection_points jsonb not null
default '["Blk 130A", "Near Creamier"]'::jsonb;

alter table public.store_settings
add column if not exists store_tagline text default '雫ラボ · crafted drop by drop';

update public.store_settings
set collection_points = '["Blk 130A", "Near Creamier"]'::jsonb
where collection_points is null or jsonb_array_length(collection_points) = 0;

alter table public.orders
drop constraint if exists orders_collection_point_check;
