-- The Partner order RPC must not trust a pickup time supplied by the browser.
-- Enforce the same Singapore minimum-notice setting on the server at insert.
create or replace function private.enforce_partner_pickup_notice()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_notice_hours integer;
  v_pickup_at timestamptz;
begin
  if new.partner_id is null or coalesce(new.is_b2b, false)
    or new.fulfilment_method is distinct from 'collection' then
    return new;
  end if;

  if new.collection_date is null or nullif(trim(new.collection_time), '') is null then
    raise exception 'Choose a valid Partner pickup date and time.';
  end if;

  select greatest(0, coalesce(minimum_order_notice_hours, 0))
    into v_notice_hours from public.store_settings limit 1;
  v_notice_hours := coalesce(v_notice_hours, 0);
  v_pickup_at := (new.collection_date + new.collection_time::time)
    at time zone 'Asia/Singapore';

  if v_pickup_at < now() + make_interval(hours => v_notice_hours) then
    raise exception 'Partner pickup needs at least % hour(s) notice. Choose a later time.', v_notice_hours;
  end if;
  return new;
end;
$function$;

drop trigger if exists enforce_partner_pickup_notice on public.orders;
create trigger enforce_partner_pickup_notice
before insert on public.orders
for each row execute function private.enforce_partner_pickup_notice();
