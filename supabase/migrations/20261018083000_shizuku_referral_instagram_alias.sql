-- An owner may choose a customer's Instagram handle as the shareable referral
-- identifier. The immutable system code remains valid, so old links keep working.
alter table private.shizuku_referral_codes
  add column if not exists instagram_alias text,
  add column if not exists share_mode text not null default 'code';

alter table private.shizuku_referral_codes
  drop constraint if exists shizuku_referral_share_mode_check;
alter table private.shizuku_referral_codes
  add constraint shizuku_referral_share_mode_check
  check (share_mode in ('code','instagram'));

create unique index if not exists shizuku_referral_instagram_alias_unique
  on private.shizuku_referral_codes (lower(instagram_alias))
  where instagram_alias is not null;

create or replace function public.get_shizuku_referral(p_phone text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_phone text := private.shizuku_sg_phone(p_phone);
        v_code text;
        v_alias text;
        v_mode text;
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
  select c.instagram_alias,c.share_mode into v_alias,v_mode
  from private.shizuku_referral_codes c where c.code = v_code;
  return jsonb_build_object(
    'code',v_code,
    'instagram_alias',v_alias,
    'share_mode',v_mode,
    'share_code',case when v_mode = 'instagram' and v_alias is not null
      then '@' || v_alias else v_code end,
    'available',(select count(*) from private.shizuku_referral_rewards r
                 where r.owner_phone = v_phone and r.status = 'available'),
    'successful',(select count(*) from private.shizuku_referral_claims c
                  where c.owner_phone = v_phone and c.status = 'earned')
  );
end;
$$;

create or replace function public.check_shizuku_referral(p_code text,p_phone text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_phone text := private.shizuku_sg_phone(p_phone);
        v_input text := lower(regexp_replace(btrim(coalesce(p_code,'')),'^@','','g'));
        v_code text;
        v_owner text;
begin
  if (select auth.uid()) is null or v_phone is null or length(v_input) > 30
     or v_input !~ '^[a-z0-9._]{2,30}$' then return null; end if;
  select c.code,c.owner_phone into v_code,v_owner
  from private.shizuku_referral_codes c
  where lower(c.code) = v_input or c.instagram_alias = v_input
  limit 1;
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

create or replace function public.admin_list_shizuku_referrals()
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.studio_users u
                 where u.auth_user_id = (select auth.uid()) and u.is_active)
  then raise exception 'Admin access required'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'code',c.code,'owner_phone',c.owner_phone,
    'instagram_alias',c.instagram_alias,'share_mode',c.share_mode
  )) from private.shizuku_referral_codes c),'[]'::jsonb);
end;
$$;

create or replace function public.admin_set_shizuku_referral(
  p_phone text,p_instagram_alias text,p_share_mode text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_phone text := private.shizuku_sg_phone(p_phone);
        v_alias text := lower(regexp_replace(btrim(coalesce(p_instagram_alias,'')),'^@','','g'));
        v_code text;
        v_mode text := lower(btrim(coalesce(p_share_mode,'')));
begin
  if not exists (select 1 from public.studio_users u
                 where u.auth_user_id = (select auth.uid()) and u.is_active)
  then raise exception 'Admin access required'; end if;
  if v_phone is null then raise exception 'Enter a valid Singapore phone number'; end if;
  if v_mode not in ('code','instagram') then raise exception 'Choose code or Instagram'; end if;
  if v_alias <> '' and (v_alias !~ '^[a-z0-9._]{2,30}$'
      or v_alias ~ '^shz[a-f0-9]{9}$')
  then raise exception 'Instagram name must be 2–30 letters, numbers, dots or underscores'; end if;
  if v_mode = 'instagram' and v_alias = '' then
    raise exception 'Enter an Instagram name to use this option';
  end if;
  if not exists (
    select 1 from public.orders o
    where private.shizuku_sg_phone(o.customer_phone) = v_phone
      and o.market_code = 'SG' and o.payment_status = 'paid'
      and o.order_status is distinct from 'cancelled'
      and coalesce(o.order_kind,'retail') = 'retail'
      and o.deleted_at is null
  ) then raise exception 'Referral is available after a paid Singapore order'; end if;
  v_code := private.ensure_shizuku_referral_code(v_phone);
  begin
    update private.shizuku_referral_codes c
    set instagram_alias = nullif(v_alias,''),share_mode = v_mode
    where c.code = v_code;
  exception when unique_violation then
    raise exception 'This Instagram name is already used by another referral';
  end;
  return jsonb_build_object('code',v_code,'owner_phone',v_phone,
    'instagram_alias',nullif(v_alias,''),'share_mode',v_mode);
end;
$$;

revoke all on function public.admin_list_shizuku_referrals(),
  public.admin_set_shizuku_referral(text,text,text) from public,anon,authenticated;
grant execute on function public.get_shizuku_referral(text),
  public.check_shizuku_referral(text,text),
  public.admin_list_shizuku_referrals(),
  public.admin_set_shizuku_referral(text,text,text) to authenticated;
