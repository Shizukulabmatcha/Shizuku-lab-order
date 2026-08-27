-- Slow Studio order confirmations for both the store owner and customers.
-- New-order email is queued only after order items exist, so the email contains the order.

create table if not exists public.order_email_events (
  order_id bigint not null references public.orders(id) on delete cascade,
  event_name text not null,
  created_at timestamptz not null default now(),
  primary key (order_id, event_name)
);

alter table public.order_email_events enable row level security;
revoke all on table public.order_email_events from anon, authenticated;

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
  select enabled, webhook_url, recipient_email, alert_new_order, alert_payment_proof
  into settings from public.notification_settings where id = 1;

  if not found
     or not coalesce(settings.enabled, false)
     or nullif(trim(coalesce(settings.webhook_url, '')), '') is null then
    return new;
  end if;

  if new.payment_status = 'submitted' and old.payment_status is distinct from 'submitted' then
    if not coalesce(settings.alert_payment_proof, false) then return new; end if;
    alert_event := 'payment_proof';
  elsif new.payment_status = 'rejected' and old.payment_status is distinct from 'rejected' then
    alert_event := 'payment_rejected';
  elsif new.payment_status = 'paid' and old.payment_status is distinct from 'paid' then
    alert_event := 'order_confirmed';
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
  where oi.order_id = new.id;

  perform net.http_post(
    url := settings.webhook_url,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object(
      'event', alert_event,
      'order_number', new.order_number,
      'customer_name', new.customer_name,
      'customer_phone', new.customer_phone,
      'customer_email', new.customer_email,
      'collection_date', new.collection_date,
      'collection_time', new.collection_time,
      'collection_point', new.collection_point,
      'total', new.total,
      'payment_status', new.payment_status,
      'order_status', new.order_status,
      'notes', new.notes,
      'payment_rejection_reason', new.payment_rejection_reason,
      'items', order_items_json
    )
  );
  return new;
end;
$$;

drop trigger if exists shizuku_order_email_alert on public.orders;
create trigger shizuku_order_email_alert
after update of payment_status on public.orders
for each row execute function public.send_shizuku_order_email();

create or replace function public.send_shizuku_new_order_email_from_item()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  settings record;
  order_row public.orders%rowtype;
  order_items_json jsonb;
  should_send_owner boolean := false;
  claimed integer := 0;
begin
  select * into order_row from public.orders where id = new.order_id;
  if not found then return new; end if;

  select enabled, webhook_url, recipient_email, alert_new_order
  into settings from public.notification_settings where id = 1;
  if not found or nullif(trim(coalesce(settings.webhook_url, '')), '') is null then return new; end if;

  should_send_owner := coalesce(settings.enabled, false) and coalesce(settings.alert_new_order, false);
  if not should_send_owner and nullif(trim(coalesce(order_row.customer_email, '')), '') is null then return new; end if;

  insert into public.order_email_events(order_id, event_name)
  values (new.order_id, 'new_order')
  on conflict do nothing;
  get diagnostics claimed = row_count;
  if claimed = 0 then return new; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'product_name', oi.product_name,
    'quantity', oi.quantity,
    'unit_price', oi.unit_price
  ) order by oi.id), '[]'::jsonb)
  into order_items_json from public.order_items oi where oi.order_id = new.order_id;

  perform net.http_post(
    url := settings.webhook_url,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object(
      'event', 'new_order',
      'send_owner', should_send_owner,
      'order_number', order_row.order_number,
      'customer_name', order_row.customer_name,
      'customer_phone', order_row.customer_phone,
      'customer_email', order_row.customer_email,
      'collection_date', order_row.collection_date,
      'collection_time', order_row.collection_time,
      'collection_point', order_row.collection_point,
      'total', order_row.total,
      'payment_status', order_row.payment_status,
      'order_status', order_row.order_status,
      'notes', order_row.notes,
      'items', order_items_json
    )
  );
  return new;
end;
$$;

revoke all on function public.send_shizuku_new_order_email_from_item() from public, anon, authenticated;

drop trigger if exists shizuku_new_order_email_after_items on public.order_items;
create constraint trigger shizuku_new_order_email_after_items
after insert on public.order_items
deferrable initially deferred
for each row execute function public.send_shizuku_new_order_email_from_item();

-- Upgrade the existing editable WhatsApp template only when it still has the old default.
update public.store_settings
set whatsapp_confirmation_template = E'Hi {customer_name}, Shizuku Lab here! Just to let you know that your order has been confirmed. See you on {date} at {time}, at {collection_point}.\n\nYour order:\n{order_items}'
where whatsapp_confirmation_template is null
   or trim(whatsapp_confirmation_template) = ''
   or whatsapp_confirmation_template = 'Hi {customer_name}, Shizuku Lab here! Just to let you know that your order has been confirmed. See you on {date} at {time}, at {collection_point}.';
