-- Two-stage customer email flow:
-- 1. payment proof submitted -> review email
-- 2. payment confirmed -> confirmation email
-- New-order emails continue to notify the owner only.

alter table public.notification_settings
  add column if not exists payment_review_email_subject_template text not null
    default 'We received your order · {order_number}',
  add column if not exists payment_review_email_heading_template text not null
    default 'Hi {customer_name}, we received your order',
  add column if not exists payment_review_email_message_template text not null
    default 'Your payment screenshot has been submitted for review. We’ll email you again once your order is confirmed.';

update public.notification_settings
set customer_email_manual_only = false,
    customer_email_subject_template = 'Your order is confirmed · {order_number}',
    customer_email_heading_template = 'Your order is confirmed',
    customer_email_message_template = 'Thank you for ordering with Shizuku Lab. We look forward to preparing your order.'
where id = 1;

create or replace function public.send_shizuku_new_order_email_from_item()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  settings record;
  order_row public.orders%rowtype;
  order_items_json jsonb;
  should_send_owner boolean := false;
  claimed integer := 0;
begin
  select * into order_row from public.orders where id = new.order_id;
  if not found then return new; end if;

  select * into settings from public.notification_settings where id = 1;
  if not found or nullif(trim(coalesce(settings.webhook_url, '')), '') is null then return new; end if;

  should_send_owner := coalesce(settings.enabled, false) and coalesce(settings.alert_new_order, false);
  if not should_send_owner then return new; end if;

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
      'send_owner', true,
      'send_customer', false,
      'order_number', order_row.order_number,
      'customer_name', order_row.customer_name,
      'customer_phone', order_row.customer_phone,
      'customer_email', null,
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
$function$;

create or replace function public.send_shizuku_order_email()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  settings record;
  alert_event text;
  order_items_json jsonb;
  should_send_owner boolean := false;
  should_send_customer boolean := false;
begin
  select * into settings from public.notification_settings where id = 1;
  if not found or nullif(trim(coalesce(settings.webhook_url, '')), '') is null then return new; end if;

  if new.payment_status = 'submitted' and old.payment_status is distinct from 'submitted' then
    alert_event := 'payment_proof';
    should_send_owner := coalesce(settings.enabled, false) and coalesce(settings.alert_payment_proof, false);
  elsif new.payment_status = 'rejected' and old.payment_status is distinct from 'rejected' then
    alert_event := 'payment_rejected';
    should_send_owner := coalesce(settings.enabled, false);
  elsif new.payment_status = 'paid' and old.payment_status is distinct from 'paid' then
    alert_event := 'order_confirmed';
    should_send_owner := coalesce(settings.enabled, false);
  else
    return new;
  end if;

  should_send_customer := coalesce(settings.customer_email_enabled, true)
    and nullif(trim(coalesce(new.customer_email, '')), '') is not null;
  if not should_send_owner and not should_send_customer then return new; end if;

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
      'send_owner', should_send_owner,
      'send_customer', should_send_customer,
      'payment_review_email_subject_template', settings.payment_review_email_subject_template,
      'payment_review_email_heading_template', settings.payment_review_email_heading_template,
      'payment_review_email_message_template', settings.payment_review_email_message_template,
      'customer_email_subject_template', settings.customer_email_subject_template,
      'customer_email_heading_template', settings.customer_email_heading_template,
      'customer_email_message_template', settings.customer_email_message_template,
      'order_number', new.order_number,
      'customer_name', new.customer_name,
      'customer_phone', new.customer_phone,
      'customer_email', case when should_send_customer then new.customer_email else null end,
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
$function$;

revoke execute on function public.send_shizuku_new_order_email_from_item() from public, anon, authenticated;
revoke execute on function public.send_shizuku_order_email() from public, anon, authenticated;
