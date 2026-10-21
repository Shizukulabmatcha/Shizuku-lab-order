-- Admin-selected past/today dates are collected immediately; future dates
-- reserve a credit until the existing order-collection flow applies it.
create or replace function public.admin_redeem_shizuku_matcha_pass_on_date(
  p_pass_id uuid, p_product_id text, p_idempotency_key text,
  p_top_up_paid boolean, p_collection_date date
)
returns jsonb
language plpgsql security definer set search_path = ''
as $function$
declare
  pass_row public.ritual_passes%rowtype;
  pass_product public.products%rowtype;
  drink public.products%rowtype;
  v_order public.orders%rowtype;
  v_batch uuid;
  v_existing record;
  v_reserved integer;
  v_position integer;
  v_topup numeric;
  v_result jsonb;
  v_order_id bigint;
  v_today date := (now() at time zone 'Asia/Singapore')::date;
  v_time text := 'To be arranged';
begin
  if not public.is_shizuku_admin() then raise exception 'Not authorised'; end if;
  if p_collection_date is null then raise exception 'Choose a collection date'; end if;
  if nullif(trim(coalesce(p_idempotency_key,'')),'') is null then
    raise exception 'Missing redemption reference';
  end if;

  select * into pass_row from public.ritual_passes where id=p_pass_id for update;
  if not found then raise exception 'Matcha Pass not found'; end if;
  if p_collection_date < (pass_row.purchased_at at time zone 'Asia/Singapore')::date then
    raise exception 'Collection date cannot be before this Pass was purchased';
  end if;
  if p_collection_date > (pass_row.expires_at at time zone 'Asia/Singapore')::date then
    raise exception 'Collection date cannot be after this Pass expires';
  end if;

  select o.id,o.order_number,o.matcha_pass_top_up,o.order_status,o.collection_date
    into v_existing
  from public.ritual_redemption_batches b
  join public.orders o on o.id::text=b.order_id
  where b.pass_id=p_pass_id and b.idempotency_key=p_idempotency_key
    and o.matcha_pass_admin_redeemed;
  if found then
    return jsonb_build_object('ok',true,'duplicate',true,'order_id',v_existing.id,
      'order_number',v_existing.order_number,'top_up_total',v_existing.matcha_pass_top_up,
      'collection_date',v_existing.collection_date,
      'reserved',lower(v_existing.order_status)<>'collected',
      'remaining',greatest(pass_row.total_drinks-pass_row.redeemed_drinks,0));
  end if;

  if p_collection_date <= v_today then
    v_result := public.admin_redeem_shizuku_matcha_pass(
      p_pass_id,p_product_id,p_idempotency_key,p_top_up_paid);
    v_order_id := (v_result->>'order_id')::bigint;
    update public.orders set collection_date=p_collection_date
      where id=v_order_id and matcha_pass_admin_redeemed;
    update public.ritual_redemption_batches set collection_date=p_collection_date
      where pass_id=p_pass_id and order_id=v_order_id::text;
    update public.ritual_redemptions set collection_date=p_collection_date
      where pass_id=p_pass_id and order_id=v_order_id::text;
    return v_result || jsonb_build_object('collection_date',p_collection_date,'reserved',false);
  end if;

  if pass_row.status <> 'active' or pass_row.expires_at < now() then
    raise exception 'This Matcha Pass is not active';
  end if;
  select * into pass_product from public.products where id::text=pass_row.product_id;
  if not found then raise exception 'Matcha Pass product not found'; end if;
  select * into drink from public.products
    where id::text=p_product_id and is_available is true
      and coalesce(is_bundle,false)=false and coalesce(is_b2b,false)=false;
  if not found then raise exception 'This drink is unavailable or not eligible'; end if;
  if jsonb_array_length(coalesce(pass_product.bundle_product_ids,'[]'::jsonb)) > 0
    and not exists (
      select 1 from jsonb_array_elements_text(pass_product.bundle_product_ids) as x(value)
      where x.value=drink.id::text
    ) then raise exception '% is not included in this Matcha Pass',drink.name;
  end if;

  select coalesce(sum(b.credits_used),0)::integer into v_reserved
  from public.ritual_redemption_batches b
  join public.orders o on o.id::text=b.order_id
  where b.pass_id=p_pass_id and b.status='active' and b.credits_applied_at is null
    and lower(coalesce(o.order_status,'')) not in ('cancelled','collected');
  if pass_row.total_drinks-pass_row.redeemed_drinks-v_reserved < 1 then
    raise exception 'No available Matcha Pass credits remain';
  end if;

  v_topup := case
    when coalesce(pass_product.bundle_option_prices,'{}'::jsonb) ? drink.id::text
      then greatest(0,coalesce((pass_product.bundle_option_prices->>drink.id::text)::numeric,0))
    when lower(drink.name) in ('signature matcha latte','houjicha latte') then 0
    when coalesce(drink.discount_price,drink.price)>=8.90 then 2.50
    when coalesce(drink.discount_price,drink.price)>=7.90 then 2.00
    when coalesce(drink.discount_price,drink.price)>=6.90 then 1.00
    else 0 end;
  if v_topup > 0 and not coalesce(p_top_up_paid,false) then
    raise exception 'Confirm the SGD % top-up was paid before reserving',to_char(v_topup,'FM999990.00');
  end if;

  insert into public.orders(
    order_number,customer_name,customer_phone,customer_email,collection_date,
    collection_time,collection_point,total,payment_status,order_status,
    payment_method,payment_reference,market_code,currency_code,is_b2b,is_offline,
    order_kind,matcha_pass_id,matcha_pass_credits_used,matcha_pass_top_up,
    matcha_pass_admin_redeemed
  ) values (
    'SL-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)),
    pass_row.customer_name,pass_row.customer_phone,pass_row.customer_email,
    p_collection_date,v_time,'In-store',v_topup,'paid','confirmed',
    'Matcha Pass · Admin','MP-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),
    'SG','SGD',false,true,'matcha_pass_redemption',pass_row.id,1,v_topup,true
  ) returning * into v_order;

  insert into public.ritual_redemption_batches(
    pass_id,order_id,idempotency_key,credits_used,top_up_total,
    collection_date,collection_time,collection_point
  ) values (pass_row.id,v_order.id::text,p_idempotency_key,1,v_topup,
    p_collection_date,v_time,'In-store') returning id into v_batch;

  select coalesce(max(redemption_number),0)+1 into v_position
    from public.ritual_redemptions where pass_id=p_pass_id and status<>'cancelled';
  insert into public.order_items(order_id,product_id,product_name,quantity,unit_price,subtotal)
    values(v_order.id,drink.id,drink.name,1,v_topup,v_topup);
  insert into public.ritual_redemptions(
    pass_id,batch_id,order_id,redemption_number,product_id,product_name,
    original_price,pass_top_up,collection_date,collection_time,collection_point,status
  ) values (
    pass_row.id,v_batch,v_order.id::text,v_position,drink.id::text,drink.name,
    coalesce(drink.discount_price,drink.price),v_topup,p_collection_date,v_time,
    'In-store','reserved'
  );

  return jsonb_build_object('ok',true,'reserved',true,'order_id',v_order.id,
    'order_number',v_order.order_number,'product_name',drink.name,
    'top_up_total',v_topup,'collection_date',p_collection_date,
    'remaining',greatest(pass_row.total_drinks-pass_row.redeemed_drinks-v_reserved-1,0),
    'email_notification_sent',false);
end;
$function$;

revoke all on function public.admin_redeem_shizuku_matcha_pass_on_date(uuid,text,text,boolean,date) from public,anon;
grant execute on function public.admin_redeem_shizuku_matcha_pass_on_date(uuid,text,text,boolean,date) to authenticated;

-- The existing order-email trigger sends a Ready email for customer-created
-- reservations. Keep that behavior, but suppress it for admin-created ones.
do $migration$
declare
  definition text;
  needle text := $needle$elsif evt in ('payment_proof', 'payment_rejected', 'order_ready_for_collection') then$needle$;
begin
  select pg_get_functiondef('public.send_shizuku_order_email()'::regprocedure)
    into definition;
  if definition is null or strpos(definition, needle) = 0 then
    raise exception 'Order notification function changed; review the migration';
  end if;
  execute replace(definition, needle,
    $replacement$elsif evt in ('payment_proof', 'payment_rejected', 'order_ready_for_collection')
          and not coalesce(new.matcha_pass_admin_redeemed,false) then$replacement$);
end;
$migration$;
