-- Shizuku Lab customer loyalty lookup
-- Run this whole file once in Supabase SQL Editor.

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
  if length(phone_digits) = 10 and left(phone_digits, 2) = '65' then
    phone_digits := right(phone_digits, 8);
  end if;

  if phone_digits !~ '^[689][0-9]{7}$' then return null; end if;

  select o.customer_name into customer_name_value
  from public.orders o
  where regexp_replace(coalesce(o.customer_phone, ''), '[^0-9]', '', 'g') in (phone_digits, '65' || phone_digits)
  order by o.created_at desc
  limit 1;
  if not found then return null; end if;

  select * into settings from public.loyalty_settings where id = 1;
  if not found then return jsonb_build_object('enabled', false); end if;

  select * into balance
  from public.customer_loyalty
  where customer_key in (phone_digits, '65' || phone_digits)
  order by case when customer_key = phone_digits then 0 else 1 end
  limit 1;

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
      select jsonb_agg(jsonb_build_object(
        'order_number', recent.order_number,
        'reward_type', recent.reward_type,
        'amount', recent.amount,
        'created_at', recent.created_at
      ) order by recent.created_at desc)
      from (
        select order_number, reward_type, amount, created_at
        from public.loyalty_transactions
        where customer_key in (phone_digits, '65' || phone_digits)
        order by created_at desc
        limit 20
      ) recent
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.check_shizuku_loyalty(text) from public;
grant execute on function public.check_shizuku_loyalty(text) to anon, authenticated;
