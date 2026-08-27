-- Run once in Supabase SQL Editor before saving the editable WhatsApp message.
-- Reuses the existing store_settings record; no new table or policy is created.
alter table public.store_settings
  add column if not exists whatsapp_confirmation_template text
  default 'Hi {customer_name}, Shizuku Lab here! Just to let you know that your order has been confirmed. See you on {date} at {time}, at {collection_point}.';

update public.store_settings
set whatsapp_confirmation_template = coalesce(
  nullif(whatsapp_confirmation_template, ''),
  'Hi {customer_name}, Shizuku Lab here! Just to let you know that your order has been confirmed. See you on {date} at {time}, at {collection_point}.'
);

notify pgrst, 'reload schema';
