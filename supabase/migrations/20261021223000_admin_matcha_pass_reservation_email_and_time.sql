-- Give admin-created reservations a real pickup time and an optional,
-- explicitly requested reservation email. Customer checkout is unchanged.

create function public.admin_redeem_shizuku_matcha_pass_at_time(
  p_pass_id uuid, p_product_id text, p_idempotency_key text,
  p_top_up_paid boolean, p_collection_date date, p_collection_time text
)
returns jsonb
language plpgsql security definer set search_path = ''
as $function$
declare
  v_result jsonb;
  v_order_id bigint;
begin
  if not public.is_shizuku_admin() then raise exception 'Not authorised'; end if;
  if coalesce(p_collection_time,'') !~ '^(0?[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$' then
    raise exception 'Choose a valid collection time';
  end if;
  v_result := public.admin_redeem_shizuku_matcha_pass_on_date(
    p_pass_id,p_product_id,p_idempotency_key,p_top_up_paid,p_collection_date);
  v_order_id := (v_result->>'order_id')::bigint;
  if coalesce((v_result->>'duplicate')::boolean,false) then
    return v_result;
  end if;
  update public.orders set collection_time=p_collection_time
    where id=v_order_id and matcha_pass_admin_redeemed;
  update public.ritual_redemption_batches set collection_time=p_collection_time
    where pass_id=p_pass_id and order_id=v_order_id::text;
  update public.ritual_redemptions set collection_time=p_collection_time
    where pass_id=p_pass_id and order_id=v_order_id::text;
  return v_result || jsonb_build_object('collection_time',p_collection_time);
end;
$function$;

revoke all on function public.admin_redeem_shizuku_matcha_pass_at_time(uuid,text,text,boolean,date,text) from public,anon;
grant execute on function public.admin_redeem_shizuku_matcha_pass_at_time(uuid,text,text,boolean,date,text) to authenticated;

create function public.admin_update_matcha_pass_collection_time(
  p_order_id bigint, p_collection_time text
)
returns jsonb
language plpgsql security definer set search_path = ''
as $function$
declare
  v_order public.orders%rowtype;
begin
  if not public.is_shizuku_admin() then raise exception 'Not authorised'; end if;
  if coalesce(p_collection_time,'') !~ '^(0?[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$' then
    raise exception 'Choose a valid collection time';
  end if;
  select * into v_order from public.orders where id=p_order_id for update;
  if not found or v_order.order_kind <> 'matcha_pass_redemption'
    or not v_order.matcha_pass_admin_redeemed
    or lower(v_order.order_status) not in ('confirmed','ready') then
    raise exception 'An active admin Matcha Pass reservation is required';
  end if;
  update public.orders set collection_time=p_collection_time where id=p_order_id;
  update public.ritual_redemption_batches set collection_time=p_collection_time
    where order_id=p_order_id::text and pass_id=v_order.matcha_pass_id;
  update public.ritual_redemptions set collection_time=p_collection_time
    where order_id=p_order_id::text and pass_id=v_order.matcha_pass_id;
  return jsonb_build_object('ok',true,'collection_time',p_collection_time);
end;
$function$;

revoke all on function public.admin_update_matcha_pass_collection_time(bigint,text) from public,anon;
grant execute on function public.admin_update_matcha_pass_collection_time(bigint,text) to authenticated;

create function public.admin_send_matcha_pass_reservation_email(p_order_id bigint)
returns jsonb
language plpgsql security definer set search_path = ''
as $function$
declare
  v_order public.orders%rowtype;
  v_settings public.notification_settings%rowtype;
  v_drink text;
  v_recipient text;
  v_status text := 'queued';
  v_error text;
  v_id uuid;
  v_date text;
begin
  if not public.is_shizuku_admin() then raise exception 'Not authorised'; end if;
  select * into v_order from public.orders where id=p_order_id;
  if not found or v_order.order_kind <> 'matcha_pass_redemption'
    or not v_order.matcha_pass_admin_redeemed
    or lower(v_order.order_status) not in ('confirmed','ready') then
    raise exception 'An active admin Matcha Pass reservation is required';
  end if;
  if coalesce(v_order.collection_time,'') !~ '^(0?[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$' then
    raise exception 'Set a collection time before sending the reservation email';
  end if;
  select product_name into v_drink from public.order_items
    where order_id=p_order_id order by id limit 1;
  select * into v_settings from public.notification_settings where id=1;
  v_recipient:=trim(coalesce(v_order.customer_email,''));
  v_date:=to_char(v_order.collection_date,'DD Mon YYYY');
  if not coalesce(v_settings.customer_email_enabled,true) then
    v_status:='skipped'; v_error:='Customer email disabled in settings';
  elsif v_recipient !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    v_status:='failed'; v_error:='Recipient email is missing or invalid';
  end if;
  insert into public.notification_outbox(
    order_id,event,audience,dedupe_key,template_key,template_snapshot,
    recipient,status,error_message,due_at
  ) values (
    p_order_id,'matcha_pass_reservation','customer',
    p_order_id||':matcha-pass-admin-reservation-manual',
    'matcha_pass_reservation',
    jsonb_build_object(
      'subject','Your Matcha Pass drink is reserved for '||v_date||' 🍵',
      'heading','Your drink is reserved',
      'message','Hi {customer_name},'||E'\n\n'||coalesce(v_drink,'Your drink')||
        ' is reserved for '||v_date||' at '||v_order.collection_time||'.'||E'\n\n'||
        'One Matcha Pass credit is reserved now and will be deducted when your drink is collected.'||
        E'\n\n'||'Thank you for supporting Shizuku Lab. 🤍',
      'cta_label','View my Matcha Pass'),
    v_recipient,v_status,v_error,now()
  ) on conflict(dedupe_key) do nothing returning id into v_id;
  if v_id is null then
    select id,status into v_id,v_status from public.notification_outbox
      where dedupe_key=p_order_id||':matcha-pass-admin-reservation-manual';
  end if;
  return jsonb_build_object('ok',true,'notification_id',v_id,'status',v_status,
    'queued',v_status='queued');
end;
$function$;

revoke all on function public.admin_send_matcha_pass_reservation_email(bigint) from public,anon;
grant execute on function public.admin_send_matcha_pass_reservation_email(bigint) to authenticated;

-- The email worker should show Pass details, rather than generic order rows,
-- for this new reservation event.
do $migration$
declare
  definition text;
  old_events text := '(''matcha_pass_purchase'',''matcha_pass_redemption'')';
begin
  select pg_get_functiondef('private.process_notification_outbox()'::regprocedure)
    into definition;
  if definition is null or strpos(definition, old_events)=0 then
    raise exception 'Notification worker changed; review the migration';
  end if;
  definition := replace(definition,old_events,
    '(''matcha_pass_purchase'',''matcha_pass_redemption'',''matcha_pass_reservation'')');
  definition := replace(definition,
    'if q.event=''matcha_pass_redemption'' then rows:=',
    'if q.event in (''matcha_pass_redemption'',''matcha_pass_reservation'') then rows:=');
  execute definition;
end;
$migration$;

-- Expose the separate reservation-email status alongside the existing
-- collected-redemption status, so either manual email can be sent once.
do $migration$
declare
  definition text;
  needle text := $needle$'notification_status',(select n.status from public.notification_outbox n
          where n.dedupe_key=o.id||':matcha-pass-admin-manual' limit 1)$needle$;
begin
  select pg_get_functiondef('public.admin_list_shizuku_matcha_passes(text)'::regprocedure)
    into definition;
  if definition is null or strpos(definition,needle)=0 then
    raise exception 'Matcha Pass list function changed; review the migration';
  end if;
  execute replace(definition,needle,needle||$more$,
        'reservation_notification_status',(select n.status from public.notification_outbox n
          where n.dedupe_key=o.id||':matcha-pass-admin-reservation-manual' limit 1)$more$);
end;
$migration$;
