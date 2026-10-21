-- Admin in-store Matcha Pass redemption is recorded as a collected order.
-- Customer-initiated reservations and their notification procedure stay unchanged.
alter table public.orders
  add column if not exists matcha_pass_admin_redeemed boolean not null default false;

do $migration$
declare
  definition text;
  needle text := $needle$  if not found then raise exception 'Order not found'; end if;$needle$;
begin
  select pg_get_functiondef('private.queue_matcha_pass_notification(bigint,text,text)'::regprocedure)
    into definition;
  if definition is null or strpos(definition, needle) = 0 then
    raise exception 'Matcha Pass notification function changed; review the migration';
  end if;
  execute replace(definition, needle, needle || E'\n  if p_event = ''matcha_pass_redemption'' and coalesce(o.matcha_pass_admin_redeemed,false)\n     and current_setting(''app.admin_matcha_pass_send_email'',true) is distinct from ''on'' then\n    return null;\n  end if;');
end;
$migration$;

create or replace function public.admin_redeem_shizuku_matcha_pass(
  p_pass_id uuid, p_product_id text, p_idempotency_key text, p_top_up_paid boolean default false
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
  v_date date := (now() at time zone 'Asia/Singapore')::date;
  v_time text := to_char(now() at time zone 'Asia/Singapore','HH12:MI AM');
begin
  if not public.is_shizuku_admin() then raise exception 'Not authorised'; end if;
  if nullif(trim(coalesce(p_idempotency_key,'')),'') is null then raise exception 'Missing redemption reference'; end if;

  select * into pass_row from public.ritual_passes where id=p_pass_id for update;
  if not found then raise exception 'Matcha Pass not found'; end if;

  select o.id,o.order_number,o.matcha_pass_top_up into v_existing
  from public.ritual_redemption_batches b
  join public.orders o on o.id::text=b.order_id
  where b.pass_id=p_pass_id and b.idempotency_key=p_idempotency_key
    and o.matcha_pass_admin_redeemed;
  if found then
    return jsonb_build_object('ok',true,'duplicate',true,'order_id',v_existing.id,
      'order_number',v_existing.order_number,'top_up_total',v_existing.matcha_pass_top_up,
      'remaining',greatest(pass_row.total_drinks-pass_row.redeemed_drinks,0));
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
    raise exception 'Confirm the SGD % top-up was paid before redeeming',to_char(v_topup,'FM999990.00');
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
    v_date,v_time,'In-store',v_topup,'paid','confirmed',
    'Matcha Pass · Admin','MP-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),
    'SG','SGD',false,true,'matcha_pass_redemption',pass_row.id,1,v_topup,true
  ) returning * into v_order;

  insert into public.ritual_redemption_batches(
    pass_id,order_id,idempotency_key,credits_used,top_up_total,
    collection_date,collection_time,collection_point
  ) values (pass_row.id,v_order.id::text,p_idempotency_key,1,v_topup,v_date,v_time,'In-store')
  returning id into v_batch;

  select coalesce(max(redemption_number),0)+1 into v_position
    from public.ritual_redemptions where pass_id=p_pass_id and status<>'cancelled';
  insert into public.order_items(order_id,product_id,product_name,quantity,unit_price,subtotal)
    values(v_order.id,drink.id,drink.name,1,v_topup,v_topup);
  insert into public.ritual_redemptions(
    pass_id,batch_id,order_id,redemption_number,product_id,product_name,
    original_price,pass_top_up,collection_date,collection_time,collection_point,status
  ) values (
    pass_row.id,v_batch,v_order.id::text,v_position,drink.id::text,drink.name,
    coalesce(drink.discount_price,drink.price),v_topup,v_date,v_time,'In-store','reserved'
  );
  update public.orders set order_status='collected' where id=v_order.id;

  return jsonb_build_object('ok',true,'order_id',v_order.id,'order_number',v_order.order_number,
    'product_name',drink.name,'top_up_total',v_topup,
    'remaining',greatest(pass_row.total_drinks-pass_row.redeemed_drinks-1,0),
    'email_notification_sent',false);
end;
$function$;

revoke all on function public.admin_redeem_shizuku_matcha_pass(uuid,text,text,boolean) from public,anon;
grant execute on function public.admin_redeem_shizuku_matcha_pass(uuid,text,text,boolean) to authenticated;

create or replace function public.admin_send_matcha_pass_redemption_email(p_order_id bigint)
returns jsonb
language plpgsql security definer set search_path = ''
as $function$
declare
  v_order public.orders%rowtype;
  v_id uuid;
  v_status text;
begin
  if not public.is_shizuku_admin() then raise exception 'Not authorised'; end if;
  select * into v_order from public.orders where id=p_order_id;
  if not found or v_order.order_kind <> 'matcha_pass_redemption'
    or not v_order.matcha_pass_admin_redeemed or v_order.order_status <> 'collected' then
    raise exception 'A collected admin Matcha Pass redemption is required';
  end if;
  perform set_config('app.admin_matcha_pass_send_email','on',true);
  v_id := private.queue_matcha_pass_notification(
    v_order.id,'matcha_pass_redemption',v_order.id||':matcha-pass-admin-manual');
  select status into v_status from public.notification_outbox where id=v_id;
  return jsonb_build_object('ok',true,'notification_id',v_id,'status',v_status,
    'queued',v_status='queued');
end;
$function$;

revoke all on function public.admin_send_matcha_pass_redemption_email(bigint) from public,anon;
grant execute on function public.admin_send_matcha_pass_redemption_email(bigint) to authenticated;

create or replace function public.admin_list_shizuku_matcha_passes(p_search text default '')
returns jsonb
language plpgsql security definer set search_path = ''
as $function$
begin
  if not public.is_shizuku_admin() then raise exception 'Not authorised'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id',p.id,'pass_code',p.pass_code,'product_id',p.product_id,
    'customer_name',p.customer_name,'customer_phone',p.customer_phone,'customer_email',p.customer_email,
    'order_id',p.order_id,'order_number',p.order_number,'purchased_at',p.purchased_at,'expires_at',p.expires_at,
    'total_drinks',p.total_drinks,'redeemed_drinks',p.redeemed_drinks,
    'remaining_credits',greatest(p.total_drinks-p.redeemed_drinks,0),
    'reserved_credits',coalesce(x.reserved_credits,0),
    'available_credits',greatest(p.total_drinks-p.redeemed_drinks-coalesce(x.reserved_credits,0),0),
    'status',case when p.status='active' and p.expires_at<now() then 'expired' else p.status end,
    'redemptions',coalesce((
      select jsonb_agg(to_jsonb(r)||jsonb_build_object(
        'admin_redeemed',coalesce(o.matcha_pass_admin_redeemed,false),
        'notification_status',(select n.status from public.notification_outbox n
          where n.dedupe_key=o.id||':matcha-pass-admin-manual' limit 1)
      ) order by r.redemption_number)
      from public.ritual_redemptions r
      left join public.orders o on o.id::text=r.order_id
      where r.pass_id=p.id and r.status<>'cancelled'
    ),'[]'::jsonb)
  ) order by p.created_at desc)
  from public.ritual_passes p
  left join lateral (
    select coalesce(sum(b.credits_used),0)::integer reserved_credits
    from public.ritual_redemption_batches b
    join public.orders o on o.id::text=b.order_id
    where b.pass_id=p.id and b.status='active' and b.credits_applied_at is null
      and lower(coalesce(o.order_status,'')) not in ('cancelled','collected')
  ) x on true
  where trim(coalesce(p_search,''))='' or p.customer_name ilike '%'||p_search||'%'
    or p.customer_phone ilike '%'||p_search||'%' or p.pass_code ilike '%'||p_search||'%'),'[]'::jsonb);
end;
$function$;
