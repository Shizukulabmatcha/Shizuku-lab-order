-- Keep Singapore's existing codes and earned credits; add a separately priced
-- Malaysian referral programme. Existing reward rows retain their face value.
alter table public.store_settings
  add column if not exists referral_friend_discount_sgd numeric(10,2) not null default 1,
  add column if not exists referral_owner_reward_sgd numeric(10,2) not null default 1,
  add column if not exists referral_friend_discount_myr numeric(10,2) not null default 1,
  add column if not exists referral_owner_reward_myr numeric(10,2) not null default 1;
alter table public.store_settings
  add constraint shizuku_referral_amounts_range check (
    referral_friend_discount_sgd between 0.01 and 100 and
    referral_owner_reward_sgd between 0.01 and 100 and
    referral_friend_discount_myr between 0.01 and 100 and
    referral_owner_reward_myr between 0.01 and 100);
alter table public.orders drop constraint if exists orders_referral_discount_check;
alter table public.orders add constraint orders_referral_discount_check
  check (referral_discount between 0 and 100);
alter table private.shizuku_referral_codes
  add column if not exists market_code text not null default 'SG';
alter table private.shizuku_referral_codes drop constraint if exists shizuku_referral_owner_phone;
alter table private.shizuku_referral_codes add constraint shizuku_referral_owner_phone
  check ((market_code = 'SG' and owner_phone ~ '^[689][0-9]{7}$') or
         (market_code = 'MY' and owner_phone ~ '^601[0-9]{8,9}$'));
drop index if exists private.shizuku_referral_instagram_alias_unique;
create unique index shizuku_referral_instagram_alias_unique
  on private.shizuku_referral_codes (market_code, lower(instagram_alias))
  where instagram_alias is not null;
alter table private.shizuku_referral_claims
  add column if not exists market_code text not null default 'SG';
alter table private.shizuku_referral_rewards
  add column if not exists market_code text not null default 'SG';
alter table private.shizuku_referral_rewards drop constraint if exists shizuku_referral_rewards_amount_check;
alter table private.shizuku_referral_rewards add constraint shizuku_referral_rewards_amount_check
  check (amount between 0.01 and 100);

create or replace function private.shizuku_referral_phone(p_phone text,p_market text)
returns text language sql immutable set search_path = '' as $$
  select case when upper(p_market) = 'SG' then private.shizuku_sg_phone(p_phone)
    when upper(p_market) = 'MY' then case
      when p.digits ~ '^601[0-9]{8,9}$' then p.digits
      when p.digits ~ '^01[0-9]{8,9}$' then '6' || p.digits
      when p.digits ~ '^1[0-9]{8,9}$' then '60' || p.digits
      else null end
    else null end
  from (select pg_catalog.regexp_replace(coalesce(p_phone,''),'[^0-9]','','g') as digits) p;
$$;

create or replace function private.shizuku_referral_amount(p_market text,p_kind text)
returns numeric language sql stable set search_path = '' as $$
  select case when upper(p_market) = 'MY' then
      case when p_kind = 'owner' then referral_owner_reward_myr else referral_friend_discount_myr end
    else case when p_kind = 'owner' then referral_owner_reward_sgd else referral_friend_discount_sgd end end
  from public.store_settings limit 1;
$$;

create or replace function private.ensure_shizuku_referral_code(p_phone text,p_market text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_market text := upper(coalesce(p_market,''));
        v_phone text := private.shizuku_referral_phone(p_phone,p_market);
        v_code text;
        v_attempt integer;
begin
  if v_phone is null then return null; end if;
  select c.code into v_code from private.shizuku_referral_codes c
    where c.owner_phone = v_phone and c.market_code = v_market;
  if v_code is not null then return v_code; end if;
  for v_attempt in 1..5 loop
    v_code := 'SHZ' || upper(substr(md5(gen_random_uuid()::text),1,9));
    begin
      insert into private.shizuku_referral_codes(code,owner_phone,market_code)
        values (v_code,v_phone,v_market);
      return v_code;
    exception when unique_violation then
      select c.code into v_code from private.shizuku_referral_codes c
        where c.owner_phone = v_phone and c.market_code = v_market;
      if v_code is not null then return v_code; end if;
    end;
  end loop;
  raise exception 'Could not create referral code';
end;
$$;

create or replace function public.get_shizuku_referral(p_phone text,p_market_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_market text := upper(coalesce(p_market_code,''));
        v_phone text := private.shizuku_referral_phone(p_phone,p_market_code);
        v_code text;
        v_alias text;
        v_mode text;
begin
  if (select auth.uid()) is null or v_phone is null then return null; end if;
  if not exists (select 1 from public.orders o
      where private.shizuku_referral_phone(o.customer_phone,v_market) = v_phone
        and o.market_code = v_market and o.payment_status = 'paid'
        and o.order_status is distinct from 'cancelled'
        and coalesce(o.order_kind,'retail') = 'retail' and o.deleted_at is null)
  then return null; end if;
  v_code := private.ensure_shizuku_referral_code(v_phone,v_market);
  select c.instagram_alias,c.share_mode into v_alias,v_mode
    from private.shizuku_referral_codes c where c.code = v_code;
  return jsonb_build_object(
    'code',v_code,'market_code',v_market,'instagram_alias',v_alias,
    'share_mode',v_mode,'share_code',case when v_mode = 'instagram' and v_alias is not null
      then '@' || v_alias else v_code end,
    'friend_amount',private.shizuku_referral_amount(v_market,'friend'),
    'owner_amount',private.shizuku_referral_amount(v_market,'owner'),
    'available',(select count(*) from private.shizuku_referral_rewards r
      where r.owner_phone = v_phone and r.market_code = v_market and r.status = 'available'),
    'available_total',(select coalesce(sum(r.amount),0) from private.shizuku_referral_rewards r
      where r.owner_phone = v_phone and r.market_code = v_market and r.status = 'available'),
    'successful',(select count(*) from private.shizuku_referral_claims c
      where c.owner_phone = v_phone and c.market_code = v_market and c.status = 'earned')
  );
end;
$$;

create or replace function public.check_shizuku_referral(p_code text,p_phone text,p_market_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_market text := upper(coalesce(p_market_code,''));
        v_phone text := private.shizuku_referral_phone(p_phone,p_market_code);
        v_input text := lower(regexp_replace(btrim(coalesce(p_code,'')),'^@','','g'));
        v_code text;
        v_owner text;
        v_reward_amount numeric;
begin
  if (select auth.uid()) is null or v_phone is null or length(v_input) > 30
     or v_input !~ '^[a-z0-9._]{2,30}$' then return null; end if;
  select c.code,c.owner_phone into v_code,v_owner
    from private.shizuku_referral_codes c
    where c.market_code = v_market and (lower(c.code) = v_input or c.instagram_alias = v_input)
    limit 1;
  if v_owner is null then return null; end if;
  if v_owner = v_phone then
    select r.amount into v_reward_amount from private.shizuku_referral_rewards r
      where r.owner_phone = v_phone and r.market_code = v_market and r.status = 'available'
      order by r.created_at,r.id limit 1;
    if v_reward_amount is not null then
      return jsonb_build_object('kind','reward','code',v_code,'amount',v_reward_amount,
        'owner_amount',private.shizuku_referral_amount(v_market,'owner'));
    end if;
    return null;
  end if;
  if exists (select 1 from public.orders o
      where o.market_code = v_market and coalesce(o.order_kind,'retail') = 'retail'
        and private.shizuku_referral_phone(o.customer_phone,v_market) = v_phone
        and o.order_status is distinct from 'cancelled' and o.deleted_at is null
        and (o.payment_status = 'paid' or o.created_at > now() - interval '1 day'))
    or exists (select 1 from private.shizuku_referral_claims c
      where c.friend_phone = v_phone and c.market_code = v_market
        and c.status in ('pending','earned'))
  then return null; end if;
  return jsonb_build_object('kind','friend','code',v_code,
    'amount',private.shizuku_referral_amount(v_market,'friend'),
    'owner_amount',private.shizuku_referral_amount(v_market,'owner'));
end;
$$;

create or replace function public.admin_set_shizuku_referral(
  p_phone text,p_instagram_alias text,p_share_mode text,p_market_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_market text := upper(coalesce(p_market_code,''));
        v_phone text := private.shizuku_referral_phone(p_phone,p_market_code);
        v_alias text := lower(regexp_replace(btrim(coalesce(p_instagram_alias,'')),'^@','','g'));
        v_mode text := lower(btrim(coalesce(p_share_mode,'')));
        v_code text;
begin
  if not exists (select 1 from public.studio_users u
    where u.auth_user_id = (select auth.uid()) and u.is_active)
  then raise exception 'Admin access required'; end if;
  if v_phone is null then raise exception 'Enter a valid phone number'; end if;
  if v_mode not in ('code','instagram') then raise exception 'Choose code or Instagram'; end if;
  if v_alias <> '' and (v_alias !~ '^[a-z0-9._]{2,30}$' or v_alias ~ '^shz[a-f0-9]{9}$')
  then raise exception 'Instagram name must be 2–30 letters, numbers, dots or underscores'; end if;
  if v_mode = 'instagram' and v_alias = '' then
    raise exception 'Enter an Instagram name to use this option'; end if;
  if not exists (select 1 from public.orders o
    where private.shizuku_referral_phone(o.customer_phone,v_market) = v_phone
      and o.market_code = v_market and o.payment_status = 'paid'
      and o.order_status is distinct from 'cancelled'
      and coalesce(o.order_kind,'retail') = 'retail' and o.deleted_at is null)
  then raise exception 'Referral is available after a paid order'; end if;
  v_code := private.ensure_shizuku_referral_code(v_phone,v_market);
  begin
    update private.shizuku_referral_codes c
      set instagram_alias = nullif(v_alias,''),share_mode = v_mode where c.code = v_code;
  exception when unique_violation then
    raise exception 'This Instagram name is already used by another referral';
  end;
  return jsonb_build_object('code',v_code,'owner_phone',v_phone,'market_code',v_market,
    'instagram_alias',nullif(v_alias,''),'share_mode',v_mode);
end;
$$;

create or replace function public.admin_list_shizuku_referrals()
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.studio_users u
    where u.auth_user_id = (select auth.uid()) and u.is_active)
  then raise exception 'Admin access required'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'code',c.code,'owner_phone',c.owner_phone,'market_code',c.market_code,
    'instagram_alias',c.instagram_alias,'share_mode',c.share_mode
  )) from private.shizuku_referral_codes c),'[]'::jsonb);
end;
$$;

create or replace function private.validate_shizuku_referral_order()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_market text := upper(coalesce(new.market_code,''));
        v_phone text := private.shizuku_referral_phone(new.customer_phone,new.market_code);
        v_code text := upper(btrim(coalesce(new.referral_code,'')));
        v_owner text;
        v_amount numeric;
begin
  if v_code = '' then
    if new.referral_kind is not null or coalesce(new.referral_discount,0) <> 0
    then raise exception 'Referral details are incomplete'; end if;
    return new;
  end if;
  if v_phone is null or v_market not in ('SG','MY')
    or (v_market = 'MY' and new.currency_code <> 'MYR')
    or (v_market = 'SG' and new.currency_code <> 'SGD')
    or coalesce(new.order_kind,'retail') <> 'retail' or coalesce(new.is_b2b,false)
    or new.partner_id is not null or new.referral_discount <= 0 or new.total < 0
  then raise exception 'Referral offer is not available for this order'; end if;
  select c.owner_phone into v_owner from private.shizuku_referral_codes c
    where c.code = v_code and c.market_code = v_market;
  if v_owner is null then raise exception 'Referral code is not valid for this store'; end if;
  if v_owner = v_phone then
    if new.referral_kind <> 'reward' then raise exception 'No referral credit is available'; end if;
    select r.amount into v_amount from private.shizuku_referral_rewards r
      where r.owner_phone = v_phone and r.market_code = v_market and r.status = 'available'
      order by r.created_at,r.id limit 1;
    if v_amount is null then raise exception 'No referral credit is available'; end if;
  else
    if new.referral_kind <> 'friend' then
      raise exception 'Referral is for a first order only';
    end if;
    if exists (select 1 from public.orders o
      where o.market_code = v_market and coalesce(o.order_kind,'retail') = 'retail'
        and private.shizuku_referral_phone(o.customer_phone,v_market) = v_phone
        and o.order_status is distinct from 'cancelled' and o.deleted_at is null
        and (o.payment_status = 'paid' or o.created_at > now() - interval '1 day'))
    then raise exception 'Referral is for a first order only'; end if;
    v_amount := private.shizuku_referral_amount(v_market,'friend');
  end if;
  if new.referral_discount > v_amount then
    raise exception 'Referral amount has changed. Apply the code again'; end if;
  new.referral_code := v_code;
  return new;
end;
$$;

create or replace function private.sync_shizuku_referral_order()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_phone text;
        v_owner text;
        v_reward_id bigint;
        v_order public.orders%rowtype;
begin
  if tg_op = 'DELETE' then v_order := old; else v_order := new; end if;
  if v_order.market_code not in ('SG','MY') then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  if v_order.payment_status = 'paid' and coalesce(v_order.order_kind,'retail') = 'retail'
    and v_order.order_status is distinct from 'cancelled' and v_order.deleted_at is null
    and (tg_op = 'INSERT' or old.payment_status is distinct from 'paid')
  then perform private.ensure_shizuku_referral_code(v_order.customer_phone,v_order.market_code); end if;
  if v_order.referral_code is null then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  v_phone := private.shizuku_referral_phone(v_order.customer_phone,v_order.market_code);
  if tg_op = 'INSERT' then
    if v_order.referral_kind = 'friend' then
      update private.shizuku_referral_claims c set status = 'cancelled'
      from public.orders o
      where c.order_id = o.id and c.friend_phone = v_phone and c.status = 'pending'
        and o.payment_status <> 'paid' and o.created_at < now() - interval '1 day';
      select c.owner_phone into v_owner from private.shizuku_referral_codes c
        where c.code = v_order.referral_code;
      insert into private.shizuku_referral_claims(order_id,code,friend_phone,owner_phone,market_code)
        values (v_order.id,v_order.referral_code,v_phone,v_owner,v_order.market_code);
    else
      update private.shizuku_referral_rewards r
        set status = 'reserved',redemption_order_id = v_order.id
        where r.id = (select id from private.shizuku_referral_rewards
          where owner_phone = v_phone and market_code = v_order.market_code and status = 'available'
          order by created_at,id for update skip locked limit 1)
        returning id into v_reward_id;
      if v_reward_id is null then raise exception 'No referral credit is available'; end if;
    end if;
  end if;
  if tg_op = 'DELETE' or v_order.order_status = 'cancelled' or v_order.deleted_at is not null then
    if v_order.referral_kind = 'friend' then
      update private.shizuku_referral_claims set status = 'cancelled' where order_id = v_order.id;
      update private.shizuku_referral_rewards set status = 'void'
        where claim_order_id = v_order.id and status = 'available';
    else
      update private.shizuku_referral_rewards
        set status = 'available',redemption_order_id = null,redeemed_at = null
        where redemption_order_id = v_order.id;
    end if;
  elsif v_order.payment_status = 'paid' and (tg_op = 'INSERT' or old.payment_status is distinct from 'paid') then
    if v_order.referral_kind = 'friend' then
      update private.shizuku_referral_claims set status = 'earned',earned_at = now()
        where order_id = v_order.id and status = 'pending' returning owner_phone into v_owner;
      if v_owner is not null then
        insert into private.shizuku_referral_rewards(claim_order_id,owner_phone,market_code,amount)
          values (v_order.id,v_owner,v_order.market_code,
            private.shizuku_referral_amount(v_order.market_code,'owner'))
          on conflict (claim_order_id) do nothing;
      end if;
    else
      update private.shizuku_referral_rewards set status = 'redeemed',redeemed_at = now()
        where redemption_order_id = v_order.id and status = 'reserved';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

revoke all on function private.shizuku_referral_phone(text,text),
  private.shizuku_referral_amount(text,text),
  private.ensure_shizuku_referral_code(text,text),
  private.validate_shizuku_referral_order(),
  private.sync_shizuku_referral_order() from public,anon,authenticated;
revoke all on function public.get_shizuku_referral(text,text),
  public.check_shizuku_referral(text,text,text),
  public.admin_set_shizuku_referral(text,text,text,text),
  public.admin_list_shizuku_referrals() from public,anon,authenticated;
grant execute on function public.get_shizuku_referral(text,text),
  public.check_shizuku_referral(text,text,text),
  public.admin_set_shizuku_referral(text,text,text,text),
  public.admin_list_shizuku_referrals() to authenticated;
