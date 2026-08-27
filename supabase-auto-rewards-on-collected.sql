-- Shizuku Lab · automatically award loyalty when an order is collected.
-- Run this whole file once in Supabase SQL Editor.
-- Existing orders and balances are not changed or backfilled.

alter table public.orders
  add column if not exists loyalty_reward_awarded_at timestamptz,
  add column if not exists loyalty_reward_amount numeric not null default 0;

create table if not exists public.loyalty_transactions (
  id bigint generated always as identity primary key,
  order_id text not null unique,
  order_number text not null,
  customer_key text not null,
  reward_type text not null check (reward_type in ('stamps', 'points')),
  amount numeric not null check (amount > 0),
  balance_after numeric not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists loyalty_transactions_customer_created_idx
  on public.loyalty_transactions (customer_key, created_at desc);

alter table public.loyalty_transactions enable row level security;
revoke all on table public.loyalty_transactions from anon, authenticated;
grant select on table public.loyalty_transactions to authenticated;
drop policy if exists "Admin can view loyalty history" on public.loyalty_transactions;
create policy "Admin can view loyalty history"
on public.loyalty_transactions
for select
to authenticated
using ((select auth.uid()) is not null);

create or replace function public.award_loyalty_when_order_collected()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  settings public.loyalty_settings%rowtype;
  balance public.customer_loyalty%rowtype;
  phone_digits text;
  member_key text;
  earned numeric := 0;
  goal numeric := 1;
  new_balance numeric := 0;
  completed_rewards integer := 0;
begin
  -- Award only on the first transition into Collected.
  if lower(coalesce(new.order_status, '')) <> 'collected'
     or lower(coalesce(old.order_status, '')) = 'collected'
     or new.loyalty_reward_awarded_at is not null then
    return new;
  end if;

  select * into settings
  from public.loyalty_settings
  where id = 1;

  -- Collected orders earn only while the rewards programme is enabled.
  if not found or coalesce(settings.enabled, false) = false then
    return new;
  end if;

  phone_digits := regexp_replace(coalesce(new.customer_phone, ''), '[^0-9]', '', 'g');
  if length(phone_digits) = 10 and left(phone_digits, 2) = '65' then
    phone_digits := right(phone_digits, 8);
  end if;
  member_key := coalesce(
    nullif(phone_digits, ''),
    nullif(btrim(coalesce(new.instagram, '')), ''),
    nullif(btrim(coalesce(new.customer_name, '')), '')
  );
  if member_key is null then return new; end if;

  if coalesce(settings.reward_type, 'stamps') = 'points' then
    earned := greatest(0, floor(coalesce(new.total, 0) * greatest(coalesce(settings.points_per_dollar, 1), 0)));
    goal := greatest(coalesce(settings.points_required, 50), 1);
  else
    earned := case when coalesce(new.total, 0) >= greatest(coalesce(settings.minimum_spend, 0), 0) then 1 else 0 end;
    goal := greatest(coalesce(settings.stamps_required, 10), 1);
  end if;

  -- Remember that this collected order was evaluated, even when it earned zero.
  new.loyalty_reward_awarded_at := now();
  new.loyalty_reward_amount := earned;
  if earned <= 0 then return new; end if;

  insert into public.customer_loyalty (customer_key, stamps, points, rewards_available)
  values (member_key, 0, 0, 0)
  on conflict (customer_key) do nothing;

  select * into balance
  from public.customer_loyalty
  where customer_key = member_key
  for update;

  if coalesce(settings.reward_type, 'stamps') = 'points' then
    new_balance := greatest(coalesce(balance.points, 0), 0) + earned;
    completed_rewards := floor(new_balance / goal);
    update public.customer_loyalty
    set points = mod(new_balance, goal),
        rewards_available = greatest(coalesce(rewards_available, 0), 0) + completed_rewards
    where customer_key = member_key;
    new_balance := mod(new_balance, goal);
  else
    new_balance := greatest(coalesce(balance.stamps, 0), 0) + earned;
    completed_rewards := floor(new_balance / goal);
    update public.customer_loyalty
    set stamps = mod(new_balance, goal),
        rewards_available = greatest(coalesce(rewards_available, 0), 0) + completed_rewards
    where customer_key = member_key;
    new_balance := mod(new_balance, goal);
  end if;

  insert into public.loyalty_transactions
    (order_id, order_number, customer_key, reward_type, amount, balance_after, created_at)
  values
    (new.id::text, coalesce(new.order_number, new.id::text), member_key,
     case when coalesce(settings.reward_type, 'stamps') = 'points' then 'points' else 'stamps' end,
     earned, new_balance, now())
  on conflict (order_id) do nothing;

  return new;
end;
$$;

revoke all on function public.award_loyalty_when_order_collected() from public;

drop trigger if exists award_loyalty_on_collected on public.orders;
create trigger award_loyalty_on_collected
before update of order_status on public.orders
for each row
execute function public.award_loyalty_when_order_collected();

-- Add recent automatic reward activity to the existing customer loyalty lookup.
create or replace function public.check_shizuku_loyalty(p_phone text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  phone_digits text;
  customer_name_value text;
  settings public.loyalty_settings%rowtype;
  balance public.customer_loyalty%rowtype;
begin
  phone_digits := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  if length(phone_digits) = 10 and left(phone_digits, 2) = '65' then phone_digits := right(phone_digits, 8); end if;
  if phone_digits !~ '^[689][0-9]{7}$' then return null; end if;

  select o.customer_name into customer_name_value
  from public.orders o
  where regexp_replace(coalesce(o.customer_phone, ''), '[^0-9]', '', 'g') in (phone_digits, '65' || phone_digits)
  order by o.created_at desc limit 1;
  if not found then return null; end if;

  select * into settings from public.loyalty_settings where id = 1;
  if not found then return jsonb_build_object('enabled', false); end if;

  select * into balance from public.customer_loyalty
  where customer_key in (phone_digits, '65' || phone_digits)
  order by case when customer_key = phone_digits then 0 else 1 end limit 1;

  return jsonb_build_object(
    'enabled', coalesce(settings.enabled, false),
    'customer_name', customer_name_value,
    'reward_type', coalesce(settings.reward_type, 'stamps'),
    'stamps_required', coalesce(settings.stamps_required, 10),
    'points_required', coalesce(settings.points_required, 50),
    'reward_description', coalesce(settings.reward_description, 'A free drink is on us.'),
    'stamps', coalesce(balance.stamps, 0),
    'points', coalesce(balance.points, 0),
    'rewards_available', coalesce(balance.rewards_available, 0),
    'history', coalesce((
      select jsonb_agg(jsonb_build_object('order_number', recent.order_number, 'reward_type', recent.reward_type, 'amount', recent.amount, 'created_at', recent.created_at) order by recent.created_at desc)
      from (select order_number, reward_type, amount, created_at from public.loyalty_transactions where customer_key in (phone_digits, '65' || phone_digits) order by created_at desc limit 20) recent
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.check_shizuku_loyalty(text) from public;
grant execute on function public.check_shizuku_loyalty(text) to anon, authenticated;

-- Verification query: confirms the trigger is installed without changing orders.
select trigger_name, event_manipulation, action_timing
from information_schema.triggers
where event_object_schema = 'public'
  and event_object_table = 'orders'
  and trigger_name = 'award_loyalty_on_collected';

select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name = 'loyalty_transactions';
