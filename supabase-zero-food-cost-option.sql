-- Run once in Supabase SQL Editor.
-- Allows Admin to distinguish an intentionally confirmed $0 cost from missing costing data.
alter table public.products
  add column if not exists food_cost_confirmed_zero boolean not null default false;

notify pgrst, 'reload schema';
