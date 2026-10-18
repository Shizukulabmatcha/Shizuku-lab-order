-- Matcha Pass reservations deserve their own owner alert even when the
-- general "new order" alert is off. Defer until all order items exist.
create or replace function private.queue_matcha_pass_owner_reservation_from_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  reservation public.orders%rowtype;
  notification_key text;
begin
  select * into reservation from public.orders where id = new.order_id;
  if not found or reservation.order_kind is distinct from 'matcha_pass_redemption' then
    return new;
  end if;

  notification_key := reservation.id::text || ':matcha-pass-reservation:owner';
  perform private.queue_order_notification(
    reservation.id, 'matcha_pass_owner_reservation', 'owner', notification_key
  );
  update public.notification_outbox
  set template_snapshot = jsonb_build_object(
        'subject', 'New Matcha Pass drink reservation 🍵',
        'heading', 'A Matcha Pass drink was reserved',
        'message', 'A customer has chosen the following drink(s):' || E'\n' ||
                   '{order_items}' || E'\n\n' ||
                   'Collection: {date} · {time}' || E'\n' ||
                   'Collection point: {collection_point}' || E'\n' ||
                   'Top-up: {total}'
      ),
      template_key = 'matcha_pass_owner_reservation'
  where dedupe_key = notification_key and audience = 'owner';
  return new;
exception when others then
  raise log 'Matcha Pass owner notification failed for order %, SQLSTATE %', new.order_id, sqlstate;
  return new;
end;
$function$;

revoke all on function private.queue_matcha_pass_owner_reservation_from_item() from public, anon, authenticated;

drop trigger if exists queue_matcha_pass_owner_reservation_from_item on public.order_items;
create constraint trigger queue_matcha_pass_owner_reservation_from_item
after insert on public.order_items
deferrable initially deferred
for each row execute function private.queue_matcha_pass_owner_reservation_from_item();
