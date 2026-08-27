-- Shizuku Lab inventory, recipe food cost and automatic stock deduction
-- Run this whole file once in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit text not null default 'g',
  stock_quantity numeric not null default 0 check (stock_quantity >= 0),
  low_stock_level numeric not null default 0 check (low_stock_level >= 0),
  pack_size numeric not null default 1 check (pack_size > 0),
  pack_cost numeric not null default 0 check (pack_cost >= 0),
  supplier text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_recipes (
  id uuid primary key default gen_random_uuid(),
  product_id text not null,
  inventory_item_id uuid not null references public.inventory_items(id) on delete cascade,
  quantity_used numeric not null default 0 check (quantity_used >= 0),
  created_at timestamptz not null default now(),
  unique(product_id, inventory_item_id)
);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  inventory_item_id uuid not null references public.inventory_items(id) on delete cascade,
  order_id text,
  quantity_change numeric not null,
  reason text not null,
  created_at timestamptz not null default now()
);

alter table public.inventory_items enable row level security;
alter table public.product_recipes enable row level security;
alter table public.inventory_movements enable row level security;

drop policy if exists "admin inventory access" on public.inventory_items;
create policy "admin inventory access" on public.inventory_items for all to authenticated using (true) with check (true);
drop policy if exists "admin recipe access" on public.product_recipes;
create policy "admin recipe access" on public.product_recipes for all to authenticated using (true) with check (true);
drop policy if exists "admin movement access" on public.inventory_movements;
create policy "admin movement access" on public.inventory_movements for select to authenticated using (true);

create or replace function public.reconcile_shizuku_order_inventory(p_order_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  movement record;
  order_row record;
  requirement record;
begin
  -- Reverse anything previously deducted for this order.
  for movement in
    select inventory_item_id, quantity_change
    from public.inventory_movements
    where order_id = p_order_id and reason = 'paid_order'
  loop
    update public.inventory_items
    set stock_quantity = greatest(0, stock_quantity - movement.quantity_change), updated_at = now()
    where id = movement.inventory_item_id;
  end loop;
  delete from public.inventory_movements where order_id = p_order_id and reason = 'paid_order';

  select payment_status, order_status into order_row
  from public.orders where id::text = p_order_id limit 1;
  if not found or order_row.payment_status <> 'paid' or order_row.order_status = 'cancelled' then return; end if;

  for requirement in
    select pr.inventory_item_id, sum(pr.quantity_used * oi.quantity)::numeric as required_quantity
    from public.order_items oi
    join public.product_recipes pr on pr.product_id = oi.product_id::text
    where oi.order_id::text = p_order_id
    group by pr.inventory_item_id
  loop
    update public.inventory_items
    set stock_quantity = greatest(0, stock_quantity - requirement.required_quantity), updated_at = now()
    where id = requirement.inventory_item_id;
    insert into public.inventory_movements(inventory_item_id, order_id, quantity_change, reason)
    values (requirement.inventory_item_id, p_order_id, -requirement.required_quantity, 'paid_order');
  end loop;
end;
$$;

create or replace function public.shizuku_inventory_order_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.payment_status = 'paid'
     and (tg_op = 'INSERT' or old.payment_status is distinct from 'paid' or old.order_status is distinct from new.order_status) then
    perform public.reconcile_shizuku_order_inventory(new.id::text);
  elsif tg_op = 'UPDATE' and old.payment_status = 'paid'
        and (new.payment_status is distinct from 'paid' or new.order_status = 'cancelled') then
    perform public.reconcile_shizuku_order_inventory(new.id::text);
  end if;
  return new;
end;
$$;

drop trigger if exists shizuku_inventory_on_order on public.orders;
create trigger shizuku_inventory_on_order
after insert or update of payment_status, order_status on public.orders
for each row execute function public.shizuku_inventory_order_trigger();

revoke all on function public.reconcile_shizuku_order_inventory(text) from public;
grant execute on function public.reconcile_shizuku_order_inventory(text) to authenticated;

-- Save a complete recipe in one request so the Admin page does not reload
-- after every ingredient edit.
create or replace function public.save_shizuku_product_recipe(p_product_id text, p_recipe jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Admin sign-in required.';
  end if;

  delete from public.product_recipes where product_id = p_product_id;

  insert into public.product_recipes(product_id, inventory_item_id, quantity_used)
  select
    p_product_id,
    (row_data ->> 'inventory_item_id')::uuid,
    greatest(0, coalesce((row_data ->> 'quantity_used')::numeric, 0))
  from jsonb_array_elements(coalesce(p_recipe, '[]'::jsonb)) as row_data
  where coalesce((row_data ->> 'quantity_used')::numeric, 0) > 0;
end;
$$;

revoke all on function public.save_shizuku_product_recipe(text, jsonb) from public;
grant execute on function public.save_shizuku_product_recipe(text, jsonb) to authenticated;
