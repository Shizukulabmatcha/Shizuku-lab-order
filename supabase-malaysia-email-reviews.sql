alter table public.store_settings add column if not exists malaysia_enabled boolean not null default false;
alter table public.store_settings add column if not exists touchngo_name text;
alter table public.store_settings add column if not exists touchngo_number text;
alter table public.store_settings add column if not exists touchngo_qr_url text;
alter table public.store_settings add column if not exists malaysia_collection_points jsonb not null default '[]'::jsonb;
alter table public.products add column if not exists malaysia_available boolean not null default false;
alter table public.products add column if not exists myr_price numeric;
alter table public.products add column if not exists bundle_myr_option_prices jsonb not null default '{}'::jsonb;
alter table public.products add column if not exists bundle_myr_display_from_price numeric;
alter table public.orders add column if not exists market_code text not null default 'SG';
alter table public.orders add column if not exists currency_code text not null default 'SGD';
alter table public.orders add column if not exists customer_confirmation_email_sent_at timestamptz;
alter table public.notification_settings add column if not exists customer_email_manual_only boolean not null default true;
alter table public.customer_reviews add column if not exists product_summary text;

update public.products set bundle_show_choice_prices=false
where lower(coalesce(name,'')) like '%mix%match%';

create or replace function public.find_reviewable_shizuku_orders(p_lookup text)
returns table(order_id text, customer_name text, collection_date date, product_summary text, already_reviewed boolean)
language sql security definer set search_path=''
as $$
  with wanted as (select regexp_replace(lower(trim(coalesce(p_lookup,''))), '[^a-z0-9]', '', 'g') v)
  select o.id::text, o.customer_name, o.collection_date,
    coalesce(string_agg(oi.quantity::text || ' × ' || oi.product_name, ', ' order by oi.id), 'Shizuku drink') as product_summary,
    exists(select 1 from public.customer_reviews r where r.order_id=o.id::text)
  from public.orders o cross join wanted w
  left join public.order_items oi on oi.order_id=o.id
  where lower(coalesce(o.payment_status,''))='paid' and lower(coalesce(o.order_status,''))='collected'
    and (regexp_replace(lower(o.order_number),'[^a-z0-9]','','g')=w.v
      or regexp_replace(coalesce(o.customer_phone,''),'[^0-9]','','g') in (w.v, regexp_replace(w.v,'^(65|60)','','g'))
      or regexp_replace(coalesce(o.customer_phone,''),'[^0-9]','','g')=regexp_replace(w.v,'^(65|60)','','g'))
  group by o.id,o.customer_name,o.collection_date,o.created_at order by o.created_at desc limit 20
$$;
revoke all on function public.find_reviewable_shizuku_orders(text) from public;
grant execute on function public.find_reviewable_shizuku_orders(text) to anon,authenticated;

create or replace function public.submit_shizuku_order_review(p_order_id text,p_lookup text,p_customer_name text,p_rating integer,p_review_text text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.orders%rowtype; summary text; digits text:=regexp_replace(coalesce(p_lookup,''),'[^0-9]','','g');
begin
 if p_rating not between 1 and 5 or char_length(trim(p_review_text)) not between 3 and 600 then raise exception 'Please complete your rating and review.'; end if;
 select * into o from public.orders where id::text=p_order_id and lower(coalesce(payment_status,''))='paid' and lower(coalesce(order_status,''))='collected';
 if not found or not (regexp_replace(lower(o.order_number),'[^a-z0-9]','','g')=regexp_replace(lower(coalesce(p_lookup,'')),'[^a-z0-9]','','g') or regexp_replace(o.customer_phone,'[^0-9]','','g') in (digits,regexp_replace(digits,'^(65|60)','','g'))) then raise exception 'We could not verify that order.'; end if;
 select coalesce(string_agg(quantity::text||' × '||product_name,', ' order by id),'Shizuku drink') into summary from public.order_items where order_id=o.id;
 insert into public.customer_reviews(order_id,order_number,customer_name,rating,review_text,status,product_summary) values(o.id::text,o.order_number,coalesce(nullif(trim(p_customer_name),''),o.customer_name),p_rating,trim(p_review_text),'pending',summary);
 return jsonb_build_object('ok',true);
exception when unique_violation then raise exception 'A review has already been submitted for this order.';
end $$;
revoke all on function public.submit_shizuku_order_review(text,text,text,integer,text) from public;
grant execute on function public.submit_shizuku_order_review(text,text,text,integer,text) to anon,authenticated;

create or replace function public.send_customer_order_confirmation(p_order_id bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.orders%rowtype; n public.notification_settings%rowtype; items jsonb; req bigint;
begin
 if auth.uid() is null or not exists(select 1 from public.studio_users u where u.auth_user_id=auth.uid() and u.is_active) then raise exception 'Not authorised'; end if;
 select * into o from public.orders where id=p_order_id and lower(coalesce(payment_status,''))='paid' and lower(coalesce(order_status,''))<>'cancelled';
 if not found then raise exception 'Confirm payment before emailing the customer.'; end if;
 if coalesce(trim(o.customer_email),'')='' then raise exception 'This customer did not provide an email.'; end if;
 select * into n from public.notification_settings where id=1;
 if not coalesce(n.customer_email_enabled,false) or coalesce(trim(n.webhook_url),'')='' then raise exception 'Customer email is not enabled or the Web app URL is missing.'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('product_name',product_name,'quantity',quantity,'unit_price',unit_price,'options',options) order by id),'[]'::jsonb) into items from public.order_items where order_id=o.id;
 select net.http_post(url:=n.webhook_url,headers:=jsonb_build_object('Content-Type','application/json'),body:=jsonb_build_object('event','order_confirmed','send_owner',false,'send_customer',true,'recipient_email',n.recipient_email,'customer_email',o.customer_email,'customer_email_subject_template',n.customer_email_subject_template,'customer_email_heading_template',n.customer_email_heading_template,'customer_email_message_template',n.customer_email_message_template,'order',to_jsonb(o),'items',items)) into req;
 update public.orders set customer_confirmation_email_sent_at=now() where id=o.id;
 return jsonb_build_object('ok',true,'request_id',req);
end $$;
revoke all on function public.send_customer_order_confirmation(bigint) from public;
grant execute on function public.send_customer_order_confirmation(bigint) to authenticated;
