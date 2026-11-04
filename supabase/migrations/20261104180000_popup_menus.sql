-- Persist one shareable Pop-up menu per market. The opaque id is used in the QR.
create table if not exists public.popup_menus (
  id uuid primary key default gen_random_uuid(),
  market_code text not null check (market_code in ('SG', 'MY')),
  name text not null default 'Pop-up',
  product_ids bigint[] not null default '{}',
  collection_date date not null,
  collection_time text not null,
  collection_point text not null default 'Pop-up counter',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint popup_menus_has_products check (cardinality(product_ids) between 1 and 30)
);

create index if not exists popup_menus_market_active_idx
  on public.popup_menus (market_code, active, updated_at desc);

alter table public.popup_menus enable row level security;
create policy "Public reads active pop-up menus" on public.popup_menus
  for select to anon, authenticated using (active and collection_date >= (now() at time zone 'Asia/Singapore')::date);
create policy "Admin manages pop-up menus" on public.popup_menus
  for all to authenticated using (public.is_shizuku_admin())
  with check (public.is_shizuku_admin());

comment on table public.popup_menus is 'Selected products and collection details for shareable Pop-up ordering QR links.';

alter table public.orders add column if not exists popup_menu_id uuid references public.popup_menus(id);
create index if not exists orders_popup_menu_id_idx on public.orders (popup_menu_id) where popup_menu_id is not null;
