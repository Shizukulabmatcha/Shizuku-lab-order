-- Shizuku Lab order email trigger
-- Run this whole file once in Supabase SQL Editor.
-- The Google Apps Script URL (including ?key=...) must already be saved in
-- Admin -> Notifications.

create extension if not exists pg_net;

alter table public.orders
add column if not exists collection_point text;

alter table public.orders
drop constraint if exists orders_collection_point_check;

create or replace function public.send_shizuku_order_email()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  settings record;
  alert_event text;
  order_items_json jsonb;
begin
  select enabled, webhook_url, recipient_email,
         alert_new_order, alert_payment_proof
  into settings
  from public.notification_settings
  where id = 1;

  if not found
     or not coalesce(settings.enabled, false)
     or nullif(trim(coalesce(settings.webhook_url, '')), '') is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if not coalesce(settings.alert_new_order, false) then
      return new;
    end if;
    alert_event := 'new_order';
  elsif tg_op = 'UPDATE'
        and new.payment_status = 'submitted'
        and old.payment_status is distinct from 'submitted' then
    if not coalesce(settings.alert_payment_proof, false) then
      return new;
    end if;
    alert_event := 'payment_proof';
  else
    return new;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'product_name', oi.product_name,
    'quantity', oi.quantity,
    'unit_price', oi.unit_price
  ) order by oi.id), '[]'::jsonb)
  into order_items_json
  from public.order_items oi
  where oi.order_id::text = new.id::text;

  perform net.http_post(
    url := settings.webhook_url,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object(
      'event', alert_event,
      'order_number', new.order_number,
      'customer_name', new.customer_name,
      'customer_phone', new.customer_phone,
      'collection_date', new.collection_date,
      'collection_time', new.collection_time,
      'total', new.total,
      'payment_status', new.payment_status,
      'order_status', new.order_status,
      'notes', concat(
        'Collection point: ', coalesce(new.collection_point, '—'),
        case
          when nullif(trim(coalesce(new.notes, '')), '') is not null
          then E'\nCustomer notes: ' || new.notes
          else ''
        end
      ),
      'items', order_items_json
    )
  );

  return new;
end;
$$;

drop trigger if exists shizuku_order_email_alert on public.orders;

create trigger shizuku_order_email_alert
after insert or update of payment_status on public.orders
for each row
execute function public.send_shizuku_order_email();
