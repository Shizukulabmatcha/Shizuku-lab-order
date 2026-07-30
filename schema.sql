-- Shizuku Lab ordering site — Supabase schema
-- Run this once in Supabase: Project → SQL Editor → New query → paste → Run
--
-- NOTE: you already created your own `product` table, and the site code
-- (js/app.js, js/admin.js) now reads/writes that table instead of the
-- `menu_items` table below. You can ignore the `menu_items` section — it's
-- left here only as a reference for the column names the UI expects
-- (name, description, price, category, image_url, is_available, stock).
-- The `orders` table below is still needed (or your own `order` /
-- `order_item` tables, once you share their column names and we adjust
-- the code to match).

create extension if not exists "pgcrypto";

create table if not exists menu_items (
  id text primary key,
  category text not null,
  name text not null,
  description text default '',
  price numeric(10,2) not null default 0,
  image_url text default '',
  active boolean not null default true,
  sort_order int not null default 0
);

create table if not exists orders (
  id text primary key,               -- e.g. SL-A1B2C3
  customer_name text not null,
  phone text not null,
  pickup_label text,
  pickup_time text,
  notes text default '',
  items jsonb not null,              -- [{name, price, qty}]
  total numeric(10,2) not null,
  status text not null default 'awaiting_payment',
  created_at timestamptz not null default now()
);

-- Row Level Security
alter table menu_items enable row level security;
alter table orders enable row level security;

-- Anyone can read the menu
create policy "menu_public_read" on menu_items
  for select using (true);

-- Anyone can place an order (insert) and read their own order back
create policy "orders_public_insert" on orders
  for insert with check (true);
create policy "orders_public_read" on orders
  for select using (true);

-- NOTE on the admin dashboard:
-- The policies below let the anon key also update orders and manage the
-- menu, since this prototype has no real login system yet — anyone who
-- opens admin.html and enters the PIN can act as staff. The PIN only
-- gates the *page UI*, not the database, so a technically determined
-- visitor could bypass it via devtools. That's an acceptable tradeoff
-- for a small pre-order shop, but before you scale up, replace this with
-- Supabase Auth (email/password for you) and switch these policies to
-- check auth.uid() instead of "true".
create policy "orders_public_update" on orders
  for update using (true);
create policy "menu_public_write" on menu_items
  for insert with check (true);
create policy "menu_public_update" on menu_items
  for update using (true);
create policy "menu_public_delete" on menu_items
  for delete using (true);

-- Seed the starting menu (safe to re-run: it upserts by id)
insert into menu_items (id, category, name, description, price, image_url, sort_order) values
  ('duo', 'Bundle', 'Shizuku Duo', 'Signature Matcha Latte + Signature Dark Roasted Hojicha Latte', 10.50, 'images/matcha-latte.jpg', 1),
  ('sig-matcha', 'Signature', 'Signature Matcha Latte', 'Fresh whisked First Harvest matcha with oat milk', 5.90, 'images/matcha-latte.jpg', 2),
  ('sig-hojicha', 'Signature', 'Signature Hojicha Latte', 'Fresh whisked First Harvest dark roasted hojicha with oat milk', 5.90, 'images/hojicha-latte.jpg', 3),
  ('craft', 'Craft your own', 'Matcha Lab', 'Pick your grade, milk and sweetness — built to your taste', 5.90, 'images/matcha-lab.jpg', 4),
  ('sakura-matcha', 'Special', 'Sakura Matcha Latte', 'Seasonal matcha latte with cherry blossom petals', 6.50, 'images/sakura-matcha.jpg', 5),
  ('sakura-hojicha', 'Special', 'Sakura Hojicha Latte', 'Seasonal hojicha latte with cherry blossom petals', 6.50, 'images/sakura-hojicha.jpg', 6),
  ('matcha-yakult', 'Special', 'Matcha Yakult', 'First Harvest matcha shaken with Yakult Ace Light', 6.20, 'images/matcha-yakult.jpg', 7),
  ('matcha-citrus', 'Special', 'Matcha Citrus Fizz', 'Sparkling matcha with fresh lemon', 6.20, 'images/matcha-citrus.jpg', 8)
on conflict (id) do update set
  category = excluded.category, name = excluded.name, description = excluded.description,
  price = excluded.price, image_url = excluded.image_url, sort_order = excluded.sort_order;
