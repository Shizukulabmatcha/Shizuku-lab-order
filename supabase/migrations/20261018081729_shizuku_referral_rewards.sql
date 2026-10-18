-- Singapore Refer a Friend: first paid order earns a $1 future credit for its referrer.
-- A friend's first retail order gets $1 off immediately. The same referral code lets
-- the owner spend one earned $1 credit on a later order.
create schema if not exists private;

alter table public.orders
  add column if not exists referral_code text,
  add column if not exists referral_kind text,
  add column if not exists referral_discount numeric not null default 0;

alter table public.orders drop constraint if exists orders_referral_kind_check;
alter table public.orders add constraint orders_referral_kind_check
  check (referral_kind is null or referral_kind in ('friend', 'reward'));
alter table public.orders drop constraint if exists orders_referral_discount_check;
alter table public.orders add constraint orders_referral_discount_check
  check (referral_discount in (0, 1));

create table if not exists private.shizuku_referral_codes (
  code text primary key,
  owner_phone text not null unique,
  created_at timestamptz not null default now(),
  constraint shizuku_referral_codes_format check (code ~ '^SHZ[A-F0-9]{9}$'),
  constraint shizuku_referral_owner_phone check (owner_phone ~ '^[689][0-9]{7}$')
);
create table if not exists private.shizuku_referral_claims (
  order_id bigint primary key references public.orders(id) on delete cascade,
  code text not null references private.shizuku_referral_codes(code),
  friend_phone text not null,
  owner_phone text not null,
  status text not null default 'pending' check (status in ('pending','earned','cancelled')),
  created_at timestamptz not null default now(),
  earned_at timestamptz
);
create unique index if not exists shizuku_referral_one_active_friend
  on private.shizuku_referral_claims(friend_phone)
  where status in ('pending','earned');
create table if not exists private.shizuku_referral_rewards (
  id bigint generated always as identity primary key,
  claim_order_id bigint not null unique references private.shizuku_referral_claims(order_id) on delete cascade,
  owner_phone text not null,
  amount numeric not null default 1 check (amount = 1),
  status text not null default 'available' check (status in ('available','reserved','redeemed','void')),
  redemption_order_id bigint unique references public.orders(id) on delete set null,
  created_at timestamptz not null default now(),
  redeemed_at timestamptz
);
create index if not exists shizuku_referral_rewards_owner_status
  on private.shizuku_referral_rewards(owner_phone,status,created_at);

alter table private.shizuku_referral_codes enable row level security;
alter table private.shizuku_referral_claims enable row level security;
alter table private.shizuku_referral_rewards enable row level security;
revoke all on private.shizuku_referral_codes, private.shizuku_referral_claims,
  private.shizuku_referral_rewards from public, anon, authenticated;

create or replace function private.shizuku_sg_phone(p_phone text)
returns text language sql immutable set search_path = '' as $$
  select case when p.digits ~ '^65[689][0-9]{7}$' then right(p.digits,8)
              when p.digits ~ '^[689][0-9]{7}$' then p.digits else null end
  from (select pg_catalog.regexp_replace(coalesce(p_phone,''),'[^0-9]','','g') as digits) p;
$$;

create or replace function private.ensure_shizuku_referral_code(p_phone text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_phone text := private.shizuku_sg_phone(p_phone);
        v_code text;
        v_attempt integer;
begin
  if v_phone is null then return null; end if;
  select c.code into v_code from private.shizuku_referral_codes c where c.owner_phone = v_phone;
  if v_code is not null then return v_code; end if;
  for v_attempt in 1..5 loop
    v_code := 'SHZ' || upper(substr(md5(gen_random_uuid()::text),1,9));
    begin
      insert into private.shizuku_referral_codes(code,owner_phone) values (v_code,v_phone);
      return v_code;
    exception when unique_violation then
      select c.code into v_code from private.shizuku_referral_codes c where c.owner_phone = v_phone;
      if v_code is not null then return v_code; end if;
    end;
  end loop;
  raise exception 'Could not create referral code';
end;
$$;

-- Returns only the caller-supplied phone's shareable code and credit counts.
-- This follows the existing phone-based Shizuku Club lookup model.
create or replace function public.get_shizuku_referral(p_phone text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_phone text := private.shizuku_sg_phone(p_phone);
        v_code text;
begin
  if (select auth.uid()) is null or v_phone is null then return null; end if;
  if not exists (
    select 1 from public.orders o
    where private.shizuku_sg_phone(o.customer_phone) = v_phone
      and o.market_code = 'SG' and o.payment_status = 'paid'
      and o.order_status is distinct from 'cancelled'
      and coalesce(o.order_kind,'retail') = 'retail'
      and o.deleted_at is null
  ) then return null; end if;
  v_code := private.ensure_shizuku_referral_code(v_phone);
  return jsonb_build_object(
    'code', v_code,
    'available', (select count(*) from private.shizuku_referral_rewards r
                  where r.owner_phone = v_phone and r.status = 'available'),
    'successful', (select count(*) from private.shizuku_referral_claims c
                   where c.owner_phone = v_phone and c.status = 'earned')
  );
end;
$$;

create or replace function public.check_shizuku_referral(p_code text,p_phone text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_phone text := private.shizuku_sg_phone(p_phone);
        v_code text := upper(btrim(coalesce(p_code,'')));
        v_owner text;
begin
  if (select auth.uid()) is null or v_phone is null or v_code !~ '^SHZ[A-F0-9]{9}$'
  then return null; end if;
  select c.owner_phone into v_owner from private.shizuku_referral_codes c where c.code = v_code;
  if v_owner is null then return null; end if;
  if v_owner = v_phone then
    if exists (select 1 from private.shizuku_referral_rewards r
               where r.owner_phone = v_phone and r.status = 'available')
    then return jsonb_build_object('kind','reward','code',v_code,'amount',1); end if;
    return null;
  end if;
  if exists (
    select 1 from public.orders o
    where o.market_code = 'SG' and coalesce(o.order_kind,'retail') = 'retail'
      and private.shizuku_sg_phone(o.customer_phone) = v_phone
      and o.order_status is distinct from 'cancelled' and o.deleted_at is null
      and (o.payment_status = 'paid' or o.created_at > now() - interval '1 day')
  ) or exists (
    select 1 from private.shizuku_referral_claims c
    where c.friend_phone = v_phone and c.status in ('pending','earned')
  ) then return null; end if;
  return jsonb_build_object('kind','friend','code',v_code,'amount',1);
end;
$$;

revoke all on function private.shizuku_sg_phone(text),
  private.ensure_shizuku_referral_code(text) from public, anon, authenticated;
revoke all on function public.get_shizuku_referral(text),
  public.check_shizuku_referral(text,text) from public, anon, authenticated;
grant execute on function public.get_shizuku_referral(text),
  public.check_shizuku_referral(text,text) to authenticated;

create or replace function private.validate_shizuku_referral_order()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_phone text := private.shizuku_sg_phone(new.customer_phone);
        v_code text := upper(btrim(coalesce(new.referral_code,'')));
        v_owner text;
begin
  if v_code = '' then
    if new.referral_kind is not null or coalesce(new.referral_discount,0) <> 0 then
      raise exception 'Referral details are incomplete';
    end if;
    return new;
  end if;
  if v_phone is null or new.market_code <> 'SG' or new.currency_code <> 'SGD'
     or coalesce(new.order_kind,'retail') <> 'retail' or coalesce(new.is_b2b,false)
     or new.partner_id is not null or new.referral_discount <> 1 or new.total < 0
  then raise exception 'Referral offer is not available for this order'; end if;
  select c.owner_phone into v_owner from private.shizuku_referral_codes c where c.code = v_code;
  if v_owner is null then raise exception 'Referral code is not valid'; end if;
  if v_owner = v_phone then
    if new.referral_kind <> 'reward' or not exists (
      select 1 from private.shizuku_referral_rewards r
      where r.owner_phone = v_phone and r.status = 'available'
    ) then raise exception 'No referral credit is available'; end if;
  else
    if new.referral_kind <> 'friend' or exists (
      select 1 from public.orders o
      where o.market_code = 'SG' and coalesce(o.order_kind,'retail') = 'retail'
        and private.shizuku_sg_phone(o.customer_phone) = v_phone
        and o.order_status is distinct from 'cancelled' and o.deleted_at is null
        and (o.payment_status = 'paid' or o.created_at > now() - interval '1 day')
    ) then raise exception 'Referral is for a first order only'; end if;
  end if;
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
  if tg_op = 'INSERT' and v_order.market_code = 'SG' and v_order.payment_status = 'paid'
     and coalesce(v_order.order_kind,'retail') = 'retail'
     and v_order.order_status is distinct from 'cancelled'
  then perform private.ensure_shizuku_referral_code(v_order.customer_phone); end if;
  if v_order.referral_code is null then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  v_phone := private.shizuku_sg_phone(v_order.customer_phone);
  if tg_op = 'INSERT' then
    if v_order.referral_kind = 'friend' then
      update private.shizuku_referral_claims c set status = 'cancelled'
      from public.orders o
      where c.order_id = o.id and c.friend_phone = v_phone and c.status = 'pending'
        and o.payment_status <> 'paid' and o.created_at < now() - interval '1 day';
      select c.owner_phone into v_owner from private.shizuku_referral_codes c
      where c.code = v_order.referral_code;
      insert into private.shizuku_referral_claims(order_id,code,friend_phone,owner_phone)
      values (v_order.id,v_order.referral_code,v_phone,v_owner);
    else
      update private.shizuku_referral_rewards r
      set status = 'reserved', redemption_order_id = v_order.id
      where r.id = (
        select id from private.shizuku_referral_rewards
        where owner_phone = v_phone and status = 'available'
        order by created_at,id for update skip locked limit 1
      ) returning id into v_reward_id;
      if v_reward_id is null then raise exception 'No referral credit is available'; end if;
    end if;
  elsif tg_op = 'DELETE' or v_order.order_status = 'cancelled' or v_order.deleted_at is not null then
    if v_order.referral_kind = 'friend' then
      update private.shizuku_referral_claims set status = 'cancelled'
      where order_id = v_order.id;
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
      where order_id = v_order.id and status = 'pending'
      returning owner_phone into v_owner;
      if v_owner is not null then
        insert into private.shizuku_referral_rewards(claim_order_id,owner_phone)
        values (v_order.id,v_owner) on conflict (claim_order_id) do nothing;
      end if;
    else
      update private.shizuku_referral_rewards
      set status = 'redeemed',redeemed_at = now()
      where redemption_order_id = v_order.id and status = 'reserved';
    end if;
  end if;
  if tg_op = 'UPDATE' and v_order.market_code = 'SG' and v_order.payment_status = 'paid'
     and old.payment_status is distinct from 'paid'
     and coalesce(v_order.order_kind,'retail') = 'retail'
     and v_order.order_status is distinct from 'cancelled'
  then perform private.ensure_shizuku_referral_code(v_order.customer_phone); end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

revoke all on function private.validate_shizuku_referral_order(),
  private.sync_shizuku_referral_order() from public, anon, authenticated;
drop trigger if exists validate_shizuku_referral_order on public.orders;
create trigger validate_shizuku_referral_order before insert on public.orders
for each row execute function private.validate_shizuku_referral_order();
drop trigger if exists sync_shizuku_referral_order on public.orders;
create trigger sync_shizuku_referral_order
after insert or update of payment_status,order_status,deleted_at or delete on public.orders
for each row execute function private.sync_shizuku_referral_order();
