-- One transaction for Pop-up counter and customer QR orders. Prices and pickup
-- details come from current products/options and the saved menu, not the browser.
create or replace function public.create_shizuku_popup_order(p_order jsonb, p_items jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $function$
declare
  v_admin boolean := public.is_shizuku_admin();
  v_market text := upper(coalesce(p_order->>'market_code','SG'));
  v_menu public.popup_menus%rowtype;
  v_settings public.store_settings%rowtype;
  v_product public.products%rowtype;
  v_option public.options%rowtype;
  v_item jsonb;
  v_id bigint;
  v_option_id bigint;
  v_qty integer;
  v_base numeric;
  v_unit numeric;
  v_discount numeric;
  v_percent numeric;
  v_total numeric := 0;
  v_order public.orders%rowtype;
  v_order_item_id bigint;
  v_selected_groups bigint[];
  v_group record;
  v_method text := coalesce(p_order->>'payment_method','PayNow');
  v_counter boolean := coalesce((p_order->>'counter_sale')::boolean,false);
begin
  if v_market not in ('SG','MY') then raise exception 'Invalid market'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 30 then raise exception 'Choose 1 to 30 drinks'; end if;
  if v_counter and not v_admin then raise exception 'Counter access required'; end if;
  if not v_counter then
    if auth.uid() is null then raise exception 'Sign in session required'; end if;
    select * into v_menu from public.popup_menus
      where id = nullif(p_order->>'popup_menu_id','')::uuid and active and market_code = v_market
        and collection_date >= (now() at time zone 'Asia/Singapore')::date;
    if not found then raise exception 'This Pop-up menu is no longer available'; end if;
    if nullif(btrim(p_order->>'customer_name'),'') is null or nullif(btrim(p_order->>'customer_phone'),'') is null then
      raise exception 'Name and phone are required';
    end if;
  end if;
  select * into v_settings from public.store_settings order by id limit 1;

  -- Validate all lines and compute total before writing anything.
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_id := nullif(v_item->>'product_id','')::bigint;
    v_qty := nullif(v_item->>'quantity','')::integer;
    if v_qty is null or v_qty not between 1 and 50 then raise exception 'Invalid quantity'; end if;
    if not v_counter and not (v_id = any(v_menu.product_ids)) then raise exception 'Drink is not on this Pop-up menu'; end if;
    select * into v_product from public.products where id=v_id and not coalesce(sold_out,false)
      and coalesce(is_bundle,false)=false and coalesce(is_b2b,false)=false
      and (case when v_market='MY' then malaysia_available=true else is_available is distinct from false end);
    if not found then raise exception 'A drink is no longer available'; end if;
    v_base := greatest(coalesce(case when v_market='MY' then v_product.myr_price else v_product.price end,0),0);
    v_discount := case when v_market='MY' then v_product.myr_discount_price else v_product.discount_price end;
    if v_discount is not null and v_discount>0 and v_discount<v_base then v_base:=v_discount; end if;
    v_percent := 0;
    if coalesce((case when v_market='MY' then v_settings.malaysia_storewide_sale_enabled else v_settings.storewide_sale_enabled end),false)
      and (coalesce((case when v_market='MY' then v_settings.malaysia_storewide_sale_scope else v_settings.storewide_sale_scope end),'all') <> 'selected'
        or exists(select 1 from jsonb_array_elements_text(coalesce((case when v_market='MY' then v_settings.malaysia_storewide_sale_product_ids else v_settings.storewide_sale_product_ids end),'[]'::jsonb)) x where x.value=v_id::text))
    then v_percent := greatest(0,least(100,coalesce((case when v_market='MY' then v_settings.malaysia_storewide_sale_percent else v_settings.storewide_sale_percent end),0))); end if;
    v_base := least(v_base,round(greatest(coalesce(case when v_market='MY' then v_product.myr_price else v_product.price end,0),0)*(1-v_percent/100),2));
    v_unit := v_base;
    v_selected_groups := '{}'::bigint[];
    if jsonb_typeof(coalesce(v_item->'option_ids','[]'::jsonb)) <> 'array' then raise exception 'Invalid options'; end if;
    for v_option_id in select distinct value::bigint from jsonb_array_elements_text(coalesce(v_item->'option_ids','[]'::jsonb)) loop
      select o.* into v_option from public.options o
        join public.option_groups g on g.id=o.option_group_id and g.is_visible
          and (case when v_market='MY' then g.show_in_malaysia is distinct from false else g.show_in_singapore is distinct from false end)
        join public.product_option_groups pg on pg.option_group_id=g.id and pg.product_id=v_id
        where o.id=v_option_id and o.is_available is distinct from false;
      if not found then raise exception 'An option is unavailable for this drink'; end if;
      if v_option.option_group_id=any(v_selected_groups) then raise exception 'Choose one option per group'; end if;
      v_selected_groups:=array_append(v_selected_groups,v_option.option_group_id);
      v_unit:=v_unit+coalesce(v_option.price,0);
    end loop;
    for v_group in select g.id from public.option_groups g join public.product_option_groups pg on pg.option_group_id=g.id
      where pg.product_id=v_id and g.is_visible and g.required
        and (case when v_market='MY' then g.show_in_malaysia is distinct from false else g.show_in_singapore is distinct from false end)
    loop
      if not (v_group.id=any(v_selected_groups)) then raise exception 'A required option is missing'; end if;
    end loop;
    v_total:=v_total+round(greatest(v_unit,0)*v_qty,2);
  end loop;
  v_total:=round(v_total,2);
  if v_total<=0 then raise exception 'Sale total must be above zero'; end if;

  insert into public.orders(order_number,customer_id,customer_name,customer_phone,customer_email,instagram,
    collection_date,collection_time,collection_point,notes,total,payment_status,order_status,payment_method,payment_reference,
    market_code,currency_code,is_offline,offline_reason,counts_as_sale,popup_menu_id,order_kind,fulfilment_method)
  values(coalesce(nullif(p_order->>'order_number',''),'SL-P'||upper(substr(md5(random()::text),1,6))),
    case when v_counter then null else auth.uid() end,
    case when v_counter then coalesce(nullif(btrim(p_order->>'customer_name'),''),'Walk-in') else btrim(p_order->>'customer_name') end,
    case when v_counter then '' else btrim(p_order->>'customer_phone') end,null,
    coalesce(p_order->>'instagram',''),
    case when v_counter then (now() at time zone 'Asia/Singapore')::date else v_menu.collection_date end,
    case when v_counter then to_char(now() at time zone 'Asia/Singapore','HH12:MI AM') else v_menu.collection_time end,
    case when v_counter then 'Pop-up counter' else v_menu.collection_point end,
    nullif(p_order->>'notes',''),v_total,'awaiting_payment','pending',
    case when v_counter and v_method='Cash' then 'Cash' when v_market='MY' then 'Touch ''n Go' else 'PayNow' end,
    coalesce(p_order->>'order_number',''),v_market,case when v_market='MY' then 'MYR' else 'SGD' end,
    true,case when v_counter then 'popup_sale' else 'popup_qr' end,true,
    case when v_counter then null else v_menu.id end,'retail','collection') returning * into v_order;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_id:=(v_item->>'product_id')::bigint;
    v_qty:=(v_item->>'quantity')::integer;
    select * into v_product from public.products where id=v_id;
    v_base:=greatest(coalesce(case when v_market='MY' then v_product.myr_price else v_product.price end,0),0);
    v_discount:=case when v_market='MY' then v_product.myr_discount_price else v_product.discount_price end;
    if v_discount is not null and v_discount>0 and v_discount<v_base then v_base:=v_discount; end if;
    v_percent:=0;
    if coalesce((case when v_market='MY' then v_settings.malaysia_storewide_sale_enabled else v_settings.storewide_sale_enabled end),false)
      and (coalesce((case when v_market='MY' then v_settings.malaysia_storewide_sale_scope else v_settings.storewide_sale_scope end),'all') <> 'selected'
        or exists(select 1 from jsonb_array_elements_text(coalesce((case when v_market='MY' then v_settings.malaysia_storewide_sale_product_ids else v_settings.storewide_sale_product_ids end),'[]'::jsonb)) x where x.value=v_id::text))
    then v_percent:=greatest(0,least(100,coalesce((case when v_market='MY' then v_settings.malaysia_storewide_sale_percent else v_settings.storewide_sale_percent end),0))); end if;
    v_base:=least(v_base,round(greatest(coalesce(case when v_market='MY' then v_product.myr_price else v_product.price end,0),0)*(1-v_percent/100),2));
    v_unit:=v_base;
    for v_option_id in select distinct value::bigint from jsonb_array_elements_text(coalesce(v_item->'option_ids','[]'::jsonb)) loop
      select * into v_option from public.options where id=v_option_id;
      v_unit:=v_unit+coalesce(v_option.price,0);
    end loop;
    v_unit:=round(greatest(v_unit,0),2);
    insert into public.order_items(order_id,product_id,product_name,quantity,unit_price,subtotal)
      values(v_order.id,v_id,v_product.name,v_qty,v_unit,round(v_unit*v_qty,2)) returning id into v_order_item_id;
    for v_option_id in select distinct value::bigint from jsonb_array_elements_text(coalesce(v_item->'option_ids','[]'::jsonb)) loop
      select * into v_option from public.options where id=v_option_id;
      insert into public.order_item_options(order_item_id,option_id,option_name,price)
        values(v_order_item_id,v_option.id,v_option.name,coalesce(v_option.price,0));
    end loop;
  end loop;

  if v_counter and v_method='Cash' then
    update public.orders set payment_status='paid',order_status='collected' where id=v_order.id returning * into v_order;
    perform public.reconcile_shizuku_order_inventory(v_order.id::text);
  end if;
  return to_jsonb(v_order);
end;
$function$;

revoke all on function public.create_shizuku_popup_order(jsonb,jsonb) from public;
revoke all on function public.create_shizuku_popup_order(jsonb,jsonb) from anon;
grant execute on function public.create_shizuku_popup_order(jsonb,jsonb) to authenticated;

create or replace function public.confirm_shizuku_popup_payment(p_order_id bigint)
returns jsonb language plpgsql security definer set search_path = '' as $function$
declare v_order public.orders%rowtype;
begin
  if not public.is_shizuku_admin() then raise exception 'Admin access required'; end if;
  select * into v_order from public.orders where id=p_order_id and offline_reason='popup_sale' for update;
  if not found then raise exception 'Pop-up counter order not found'; end if;
  if v_order.payment_status='paid' then return to_jsonb(v_order); end if;
  if v_order.payment_status<>'awaiting_payment' then raise exception 'This order is not awaiting payment'; end if;
  update public.orders set payment_status='paid',order_status='collected' where id=p_order_id returning * into v_order;
  perform public.reconcile_shizuku_order_inventory(v_order.id::text);
  return to_jsonb(v_order);
end;
$function$;
revoke all on function public.confirm_shizuku_popup_payment(bigint) from public;
revoke all on function public.confirm_shizuku_popup_payment(bigint) from anon;
grant execute on function public.confirm_shizuku_popup_payment(bigint) to authenticated;
