-- Shizuku Lab: enable the Save food cost button.
-- Run this whole file once in Supabase SQL Editor.

create or replace function public.save_shizuku_product_recipe(
  p_product_id text,
  p_recipe jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Admin sign-in required.';
  end if;

  delete from public.product_recipes
  where product_id = p_product_id;

  insert into public.product_recipes(
    product_id,
    inventory_item_id,
    quantity_used
  )
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
