-- Additional product photos; existing image_url remains the cover image.
-- Does not alter product IDs, pricing, inventory, recipes or costing links.
alter table public.products
  add column if not exists image_urls jsonb not null default '[]'::jsonb;

comment on column public.products.image_urls is
  'Additional product photo URLs in display order; image_url remains the cover.';
