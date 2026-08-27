-- Shizuku Lab: Costing Overview, Wholesale / B2B, Suppliers, Inspiration and Margin Guide
-- Safe to run more than once.
create extension if not exists pgcrypto;

alter table public.inventory_items
  add column if not exists cost_type text not null default 'ingredient';

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_person text,
  phone text,
  email text,
  website_instagram text,
  products_supplied text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wholesale_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  origin text,
  purchase_pack_size numeric not null default 1 check (purchase_pack_size > 0),
  purchase_price numeric not null default 0 check (purchase_price >= 0),
  cost_unit text not null default 'g',
  wholesale_pack_size numeric not null default 1 check (wholesale_pack_size >= 0),
  wholesale_selling_price numeric not null default 0 check (wholesale_selling_price >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inspiration_ideas (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  notes text,
  category text not null default 'Other',
  status text not null default 'active',
  is_pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.margin_guide_settings (
  id integer primary key default 1 check (id = 1),
  very_low_max numeric not null default 20,
  low_max numeric not null default 30,
  acceptable_max numeric not null default 40,
  healthy_max numeric not null default 50,
  strong_max numeric not null default 60,
  direct_target_min numeric not null default 50,
  direct_target_max numeric not null default 70,
  wholesale_target_min numeric not null default 30,
  wholesale_target_max numeric not null default 50,
  updated_at timestamptz not null default now()
);
insert into public.margin_guide_settings(id) values (1) on conflict (id) do nothing;

alter table public.suppliers enable row level security;
alter table public.wholesale_products enable row level security;
alter table public.inspiration_ideas enable row level security;
alter table public.margin_guide_settings enable row level security;

drop policy if exists "admin suppliers access" on public.suppliers;
create policy "admin suppliers access" on public.suppliers for all to authenticated using (true) with check (true);
drop policy if exists "admin wholesale access" on public.wholesale_products;
create policy "admin wholesale access" on public.wholesale_products for all to authenticated using (true) with check (true);
drop policy if exists "admin inspiration access" on public.inspiration_ideas;
create policy "admin inspiration access" on public.inspiration_ideas for all to authenticated using (true) with check (true);
drop policy if exists "admin margin guide access" on public.margin_guide_settings;
create policy "admin margin guide access" on public.margin_guide_settings for all to authenticated using (true) with check (true);

grant select, insert, update, delete on public.suppliers to authenticated;
grant select, insert, update, delete on public.wholesale_products to authenticated;
grant select, insert, update, delete on public.inspiration_ideas to authenticated;
grant select, insert, update on public.margin_guide_settings to authenticated;
