-- Independent Singapore / Malaysia inventory, recipes and direct costing.
-- Safe to run more than once. Existing rows remain Singapore records.

alter table public.inventory_items
  add column if not exists market_code text;

update public.inventory_items
set market_code = 'SG'
where market_code is null or trim(market_code) = '';

alter table public.inventory_items
  alter column market_code set default 'SG',
  alter column market_code set not null;

alter table public.inventory_items
  drop constraint if exists inventory_items_market_code_check,
  add constraint inventory_items_market_code_check
    check (market_code in ('SG', 'MY'));

alter table public.product_recipes
  add column if not exists market_code text;

update public.product_recipes
set market_code = 'SG'
where market_code is null or trim(market_code) = '';

alter table public.product_recipes
  alter column market_code set default 'SG',
  alter column market_code set not null;

alter table public.product_recipes
  drop constraint if exists product_recipes_market_code_check,
  add constraint product_recipes_market_code_check
    check (market_code in ('SG', 'MY'));

alter table public.products
  add column if not exists malaysia_food_cost_confirmed_zero boolean not null default false;

alter table public.product_recipes
  drop constraint if exists product_recipes_product_id_inventory_item_id_key;

create unique index if not exists product_recipes_product_market_inventory_key
  on public.product_recipes(product_id, market_code, inventory_item_id);

create or replace function public.save_shizuku_market_product_recipe(
  p_product_id text,
  p_market_code text,
  p_recipe jsonb
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare selected_market text := upper(coalesce(nullif(trim(p_market_code),''),'SG'));
begin
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Admin sign-in required.';
  end if;
  if selected_market not in ('SG','MY') then raise exception 'Unsupported market.'; end if;

  delete from public.product_recipes
  where product_id=p_product_id and market_code=selected_market;

  insert into public.product_recipes(product_id, inventory_item_id, quantity_used, market_code)
  select p_product_id,
         (row_data->>'inventory_item_id')::uuid,
         greatest(0,coalesce((row_data->>'quantity_used')::numeric,0)),
         selected_market
  from jsonb_array_elements(coalesce(p_recipe,'[]'::jsonb)) row_data
  join public.inventory_items inventory
    on inventory.id=(row_data->>'inventory_item_id')::uuid
   and inventory.market_code=selected_market
  where coalesce((row_data->>'quantity_used')::numeric,0)>0;
end $function$;

create or replace function public.save_shizuku_product_recipe(
  p_product_id text,
  p_recipe jsonb
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  perform public.save_shizuku_market_product_recipe(p_product_id,'SG',p_recipe);
end $function$;

create or replace function public.reconcile_shizuku_order_inventory(p_order_id text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare movement record; order_row record; requirement record;
begin
  for movement in
    select inventory_item_id,quantity_change from public.inventory_movements
    where order_id=p_order_id and reason='paid_order'
  loop
    update public.inventory_items
    set stock_quantity=greatest(0,stock_quantity-movement.quantity_change),updated_at=now()
    where id=movement.inventory_item_id;
  end loop;
  delete from public.inventory_movements where order_id=p_order_id and reason='paid_order';

  select payment_status,order_status,coalesce(market_code,'SG') market_code into order_row
  from public.orders where id::text=p_order_id limit 1;
  if not found or order_row.payment_status<>'paid' or order_row.order_status='cancelled' then return; end if;

  for requirement in
    select pr.inventory_item_id,sum(pr.quantity_used*oi.quantity)::numeric required_quantity
    from public.order_items oi
    join public.product_recipes pr
      on pr.product_id=oi.product_id::text
     and pr.market_code=order_row.market_code
    where oi.order_id::text=p_order_id
    group by pr.inventory_item_id
  loop
    update public.inventory_items
    set stock_quantity=greatest(0,stock_quantity-requirement.required_quantity),updated_at=now()
    where id=requirement.inventory_item_id;
    insert into public.inventory_movements(inventory_item_id,order_id,quantity_change,reason)
    values(requirement.inventory_item_id,p_order_id,-requirement.required_quantity,'paid_order');
  end loop;
end $function$;

comment on column public.inventory_items.market_code is
  'Country costing ledger: SG or MY. The two inventories never share stock or pack costs.';
comment on column public.product_recipes.market_code is
  'Country-specific recipe used for direct costing and paid-order inventory deduction.';
comment on column public.products.malaysia_food_cost_confirmed_zero is
  'Explicit confirmation that the Malaysia direct cost is genuinely zero.';

-- These mutation helpers are for signed-in Admin users only. Database triggers
-- can still call reconcile_shizuku_order_inventory internally.
revoke execute on function public.save_shizuku_market_product_recipe(text,text,jsonb) from public, anon;
grant execute on function public.save_shizuku_market_product_recipe(text,text,jsonb) to authenticated;

revoke execute on function public.save_shizuku_product_recipe(text,jsonb) from public, anon;
grant execute on function public.save_shizuku_product_recipe(text,jsonb) to authenticated;

revoke execute on function public.reconcile_shizuku_order_inventory(text) from public, anon;
grant execute on function public.reconcile_shizuku_order_inventory(text) to authenticated;
