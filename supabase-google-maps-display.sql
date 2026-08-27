-- Run once in Supabase SQL Editor before saving the new map settings.
alter table public.store_settings
  add column if not exists collection_area_label text default 'Near Creamier · Toa Payoh',
  add column if not exists google_maps_url text,
  add column if not exists show_collection_map_home boolean not null default true,
  add column if not exists show_collection_map_payment boolean not null default true;

alter table public.store_settings
  add column if not exists collection_point_details jsonb not null default '[]'::jsonb;

update public.store_settings
set collection_area_label = 'Near Creamier · Toa Payoh'
where collection_area_label is null or btrim(collection_area_label) = '';
