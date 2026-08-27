-- SHIZUKU LAB TRIAL 1–5
-- Run this whole file once in Supabase SQL Editor.

alter table public.orders
  add column if not exists customer_email text,
  add column if not exists reservation_expires_at timestamptz default (now() + interval '15 minutes'),
  add column if not exists payment_rejection_reason text;

-- Expire unpaid reservations whenever the storefront refreshes stock.
create or replace function public.get_shizuku_product_stock()
returns table(product_id text, available_quantity bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.orders
  set order_status = 'cancelled',
      payment_rejection_reason = coalesce(payment_rejection_reason, 'Payment window expired. Please place a new order.')
  where payment_status = 'awaiting_payment'
    and order_status = 'pending'
    and coalesce(reservation_expires_at, created_at + interval '15 minutes') < now();

  return query
  select p.id::text,
    greatest(0, floor(p.stock::numeric - coalesce(sum(oi.quantity) filter (
      where coalesce(lower(o.order_status), 'pending') <> 'cancelled'
    ), 0)))::bigint
  from public.products p
  left join public.order_items oi on oi.product_id::text = p.id::text
  left join public.orders o on o.id::text = oi.order_id::text
  where p.stock is not null and p.stock >= 0
  group by p.id, p.stock;
end;
$$;
grant execute on function public.get_shizuku_product_stock() to anon, authenticated;

drop function if exists public.track_shizuku_order(text, text);

create function public.track_shizuku_order(p_order_number text, p_phone text)
returns setof public.orders
language sql security definer set search_path = public
as $$
  select o.* from public.orders o
  where upper(o.order_number) = upper(trim(p_order_number))
    and regexp_replace(coalesce(o.customer_phone,''),'[^0-9]','','g') in (
      regexp_replace(coalesce(p_phone,''),'[^0-9]','','g'),
      regexp_replace(regexp_replace(coalesce(p_phone,''),'[^0-9]','','g'),'^65','')
    )
  limit 1;
$$;
grant execute on function public.track_shizuku_order(text,text) to anon, authenticated;

create or replace function public.submit_payment_proof(p_order_id uuid, p_transaction_reference text, p_screenshot_path text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update public.orders
  set payment_status = 'submitted', order_status = 'awaiting_confirmation',
      payment_transaction_reference = nullif(trim(p_transaction_reference),''),
      payment_screenshot_url = p_screenshot_path, payment_rejection_reason = null,
      reservation_expires_at = null
  where id = p_order_id
    and (customer_id = auth.uid() or customer_id is null)
    and coalesce(order_status,'pending') <> 'cancelled';
  if not found then raise exception 'This order cannot accept a new payment proof.'; end if;
end;
$$;
grant execute on function public.submit_payment_proof(uuid,text,text) to authenticated;

-- Let the verified anonymous customer session receive only its own live chat.
drop policy if exists "Customers receive their own order messages" on public.order_messages;
create policy "Customers receive their own order messages" on public.order_messages
for select to authenticated
using (
  exists (
    select 1 from public.orders o
    where o.id::text = order_messages.order_id
      and o.customer_id = auth.uid()
  )
);

-- Add these tables to the Realtime publication when not already present.
do $$ begin
  alter publication supabase_realtime add table public.order_messages;
exception when duplicate_object then null;
end $$;

-- Seller alert plus customer confirmation email payload.
create or replace function public.send_shizuku_order_email()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare settings record; alert_event text; order_items_json jsonb;
begin
  select enabled, webhook_url, recipient_email, alert_new_order, alert_payment_proof
  into settings from public.notification_settings where id = 1;
  if not found or not coalesce(settings.enabled,false) or nullif(trim(coalesce(settings.webhook_url,'')),'') is null then return new; end if;

  if tg_op = 'INSERT' then
    if not coalesce(settings.alert_new_order,false) then return new; end if;
    alert_event := 'new_order';
  elsif new.payment_status = 'submitted' and old.payment_status is distinct from 'submitted' then
    alert_event := 'payment_proof';
  elsif new.payment_status = 'rejected' and old.payment_status is distinct from 'rejected' then
    alert_event := 'payment_rejected';
  elsif new.payment_status = 'paid' and old.payment_status is distinct from 'paid' then
    alert_event := 'order_confirmed';
  else return new;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('product_name',oi.product_name,'quantity',oi.quantity,'unit_price',oi.unit_price) order by oi.id),'[]'::jsonb)
  into order_items_json from public.order_items oi where oi.order_id::text = new.id::text;

  perform net.http_post(url := settings.webhook_url,
    headers := jsonb_build_object('Content-Type','application/json'),
    body := jsonb_build_object('event',alert_event,'order_number',new.order_number,'customer_name',new.customer_name,
      'customer_phone',new.customer_phone,'customer_email',new.customer_email,'collection_date',new.collection_date,
      'collection_time',new.collection_time,'collection_point',new.collection_point,'total',new.total,
      'payment_status',new.payment_status,'order_status',new.order_status,'notes',new.notes,
      'payment_rejection_reason',new.payment_rejection_reason,'items',order_items_json));
  return new;
end;
$$;

drop trigger if exists shizuku_order_email_alert on public.orders;
create trigger shizuku_order_email_alert
after insert or update of payment_status on public.orders
for each row execute function public.send_shizuku_order_email();
