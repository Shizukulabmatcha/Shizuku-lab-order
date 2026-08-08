-- Shizuku Lab: required payment proof + Gmail notification trigger
-- Run once in Supabase SQL Editor after deploying the accompanying
-- google-apps-script-email-notifications.gs as a web app.

create extension if not exists pg_net with schema extensions;

create table if not exists public.notification_settings (
  id integer primary key default 1 check (id = 1),
  recipient_email text,
  webhook_url text,
  webhook_secret text,
  enabled boolean not null default false,
  alert_new_order boolean not null default false,
  alert_payment_proof boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.notification_settings
  add column if not exists webhook_secret text,
  add column if not exists updated_at timestamptz not null default now();

insert into public.notification_settings (id, recipient_email)
values (1, 'tinghuioh29@gmail.com')
on conflict (id) do update set recipient_email = excluded.recipient_email;

-- Only authenticated admin sessions may read or change the private webhook.
alter table public.notification_settings enable row level security;
drop policy if exists "admin can read notification settings" on public.notification_settings;
drop policy if exists "admin can update notification settings" on public.notification_settings;
create policy "admin can read notification settings"
on public.notification_settings for select to authenticated
using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'tinghuioh29@gmail.com');
create policy "admin can update notification settings"
on public.notification_settings for all to authenticated
using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'tinghuioh29@gmail.com')
with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'tinghuioh29@gmail.com');

-- Replace both placeholders, then run this statement with the rest of the file.
update public.notification_settings
set webhook_url = 'PASTE_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE',
    webhook_secret = 'REPLACE_WITH_THE_SAME_LONG_RANDOM_SECRET',
    enabled = true,
    alert_new_order = false,
    alert_payment_proof = true,
    updated_at = now()
where id = 1;

create or replace function public.submit_payment_proof(
  p_order_id uuid,
  p_transaction_reference text,
  p_screenshot_path text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if nullif(trim(coalesce(p_screenshot_path, '')), '') is null then
    raise exception 'Payment screenshot is required.';
  end if;

  update public.orders
  set transaction_reference = nullif(trim(coalesce(p_transaction_reference, '')), ''),
      payment_screenshot_url = trim(p_screenshot_path),
      payment_status = 'submitted',
      order_status = 'awaiting_confirmation'
  where id = p_order_id;

  if not found then
    raise exception 'Order not found.';
  end if;
end;
$$;

grant execute on function public.submit_payment_proof(uuid, text, text) to anon, authenticated;

create or replace function public.notify_shizuku_payment_proof()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  settings public.notification_settings%rowtype;
  order_items_json jsonb;
begin
  if new.payment_status is distinct from 'submitted'
     or old.payment_status is not distinct from 'submitted'
     or nullif(trim(coalesce(new.payment_screenshot_url, '')), '') is null then
    return new;
  end if;

  select * into settings from public.notification_settings where id = 1;
  if not found or not settings.enabled or not settings.alert_payment_proof
     or nullif(trim(coalesce(settings.webhook_url, '')), '') is null
     or nullif(trim(coalesce(settings.webhook_secret, '')), '') is null then
    return new;
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'product_name', oi.product_name,
      'quantity', oi.quantity,
      'unit_price', oi.unit_price,
      'subtotal', oi.subtotal,
      'options', coalesce((
        select jsonb_agg(jsonb_build_object('option_name', oio.option_name, 'price', oio.price))
        from public.order_item_options oio
        where oio.order_item_id = oi.id
      ), '[]'::jsonb)
    ) order by oi.id
  ), '[]'::jsonb)
  into order_items_json
  from public.order_items oi
  where oi.order_id = new.id;

  perform net.http_post(
    url := settings.webhook_url,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object(
      'secret', settings.webhook_secret,
      'event', 'payment_proof_submitted',
      'order', to_jsonb(new),
      'items', order_items_json
    )
  );
  return new;
end;
$$;

drop trigger if exists shizuku_payment_proof_email on public.orders;
create trigger shizuku_payment_proof_email
after update of payment_status, payment_screenshot_url on public.orders
for each row execute function public.notify_shizuku_payment_proof();
