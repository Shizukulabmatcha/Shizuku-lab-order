-- Customer-facing referral activity and a confirmation email to the referrer.
-- No historical rewards are emailed; the trigger covers only newly earned credits.
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
      where c.owner_phone = v_phone and c.market_code = v_market and c.status = 'earned'),
    'activity',(select coalesce(jsonb_agg(jsonb_build_object(
      'created_at',h.created_at,
      'status',case when h.status='pending' then 'pending'
        when h.status='cancelled' then 'cancelled'
        when r.status='redeemed' then 'used'
        when r.status='reserved' then 'reserved'
        else 'earned' end,
      'amount',coalesce(r.amount,private.shizuku_referral_amount(v_market,'owner'))
    ) order by h.created_at desc),'[]'::jsonb)
      from (select c.order_id,c.created_at,c.status from private.shizuku_referral_claims c
        where c.owner_phone=v_phone and c.market_code=v_market
        order by c.created_at desc limit 10) h
      left join private.shizuku_referral_rewards r on r.claim_order_id=h.order_id)
  );
end;
$$;

-- The existing dispatcher renders standard orders from the friend's order row.
-- For this event replace those details with only the referrer's own credit data.
do $migration$
declare definition text;
        anchor text := '      payload:=jsonb_build_object(';
        addition text := $patch$      if q.event='referral_reward' then
        v:=v||jsonb_build_object('customer_name',coalesce(q.template_snapshot->>'owner_name','there'));
        rows:=jsonb_build_array(
          jsonb_build_array('Referral credit',q.template_snapshot->>'credit_amount'),
          jsonb_build_array('Available credit',q.template_snapshot->>'available_total'));
        items:='[]'::jsonb;
      end if;
      payload:=jsonb_build_object($patch$;
        old_url text := $before$'action_url',case when o.market_code='MY'$before$;
        new_url text := $after$'action_url',case when q.event='referral_reward' then 'https://shizukulab.byonetouchstudio.workers.dev/?market='||o.market_code||'&screen=loyalty' when o.market_code='MY'$after$;
begin
  select pg_get_functiondef('private.process_notification_outbox()'::regprocedure) into definition;
  if definition is null or strpos(definition,anchor)=0 or strpos(definition,old_url)=0 then
    raise exception 'Notification dispatcher changed; referral email needs review';
  end if;
  definition:=replace(definition,anchor,addition);
  definition:=replace(definition,old_url,new_url);
  execute definition;
end;
$migration$;

create or replace function private.queue_shizuku_referral_reward_email()
returns trigger language plpgsql security definer set search_path = '' as $$
declare owner_order public.orders%rowtype;
        n public.notification_settings%rowtype;
        available_total numeric;
        currency_label text;
        status_label text := 'queued';
        status_error text;
begin
  if new.status <> 'available' then return new; end if;
  select * into owner_order from public.orders o
    where o.market_code=new.market_code
      and private.shizuku_referral_phone(o.customer_phone,new.market_code)=new.owner_phone
      and o.payment_status='paid' and o.deleted_at is null
      and o.order_status is distinct from 'cancelled'
      and nullif(trim(coalesce(o.customer_email,'')),'') is not null
    order by o.created_at desc limit 1;
  if not found then return new; end if;
  select * into n from public.notification_settings where id=1;
  if not coalesce(n.customer_email_enabled,true) then
    status_label:='skipped'; status_error:='Customer email disabled in settings';
  elsif coalesce(owner_order.email_notifications_opted_out,false) then
    status_label:='skipped'; status_error:='Customer opted out of email notifications';
  elsif owner_order.customer_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    status_label:='failed'; status_error:='Recipient email is invalid';
  end if;
  currency_label:=case when new.market_code='MY' then 'RM ' else 'S$ ' end;
  select coalesce(sum(r.amount),0) into available_total
    from private.shizuku_referral_rewards r
    where r.owner_phone=new.owner_phone and r.market_code=new.market_code and r.status='available';
  insert into public.notification_outbox
    (order_id,event,audience,dedupe_key,template_key,template_snapshot,recipient,status,error_message,due_at)
  values
    (new.claim_order_id,'referral_reward','customer','referral_reward:'||new.id,
     'referral_reward',jsonb_build_object(
       'subject','You earned a Shizuku Lab referral credit 🍵',
       'heading','Your referral credit is ready',
       'message','Hi {customer_name},'||E'\n\n'||'Your friend’s first order payment has been confirmed. You have earned '||currency_label||to_char(new.amount,'FM999999990.00')||' toward a future drink order.'||E'\n\n'||'Open Rewards with your order phone number to check your balance. Use your own referral code at checkout to apply one available credit per order.',
       'cta_label','View my rewards',
       'owner_name',coalesce(nullif(trim(owner_order.customer_name),''),'there'),
       'credit_amount',currency_label||to_char(new.amount,'FM999999990.00'),
       'available_total',currency_label||to_char(available_total,'FM999999990.00')),
     trim(owner_order.customer_email),status_label,status_error,now())
  on conflict(dedupe_key) do nothing;
  return new;
end;
$$;

revoke all on function private.queue_shizuku_referral_reward_email() from public,anon,authenticated;
drop trigger if exists shizuku_referral_reward_email on private.shizuku_referral_rewards;
create trigger shizuku_referral_reward_email
after insert on private.shizuku_referral_rewards
for each row execute function private.queue_shizuku_referral_reward_email();
