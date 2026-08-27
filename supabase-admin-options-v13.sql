-- Run this one file once for v13. It is safe if an earlier column already exists.
alter table public.store_settings
  add column if not exists whatsapp_confirmation_template text
  default 'Hi {customer_name}, Shizuku Lab here! Just to let you know that your order has been confirmed. See you on {date} at {time}, at {collection_point}.';

alter table public.store_settings
  add column if not exists show_dashboard_refresh boolean not null default true;

alter table public.products
  add column if not exists food_cost_confirmed_zero boolean not null default false;

update public.store_settings
set whatsapp_confirmation_template = coalesce(
  nullif(whatsapp_confirmation_template, ''),
  'Hi {customer_name}, Shizuku Lab here! Just to let you know that your order has been confirmed. See you on {date} at {time}, at {collection_point}.'
);

notify pgrst, 'reload schema';
