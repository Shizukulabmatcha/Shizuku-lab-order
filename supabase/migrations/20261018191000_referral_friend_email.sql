-- Confirm the friend's first-order saving without revealing the referrer's identity.
do $migration$
declare definition text;
        old_url text := $before$'action_url',case when q.event='referral_reward'$before$;
        new_url text := $after$'action_url',case when q.event='referral_friend' then 'https://shizukulab.byonetouchstudio.workers.dev/?market='||o.market_code||'&screen=track' when q.event='referral_reward'$after$;
begin
  select pg_get_functiondef('private.process_notification_outbox()'::regprocedure) into definition;
  if definition is null or strpos(definition,old_url)=0 then
    raise exception 'Notification dispatcher changed; referral friend email needs review';
  end if;
  execute replace(definition,old_url,new_url);
end;
$migration$;

create or replace function private.queue_shizuku_referral_friend_email()
returns trigger language plpgsql security definer set search_path = '' as $$
declare friend_order public.orders%rowtype;
        n public.notification_settings%rowtype;
        currency_label text;
        status_label text := 'queued';
        status_error text;
begin
  if new.status <> 'earned' or old.status = 'earned' then return new; end if;
  select * into friend_order from public.orders where id=new.order_id;
  if not found or nullif(trim(coalesce(friend_order.customer_email,'')),'') is null then return new; end if;
  select * into n from public.notification_settings where id=1;
  if not coalesce(n.customer_email_enabled,true) then
    status_label:='skipped'; status_error:='Customer email disabled in settings';
  elsif coalesce(friend_order.email_notifications_opted_out,false) then
    status_label:='skipped'; status_error:='Customer opted out of email notifications';
  elsif friend_order.customer_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    status_label:='failed'; status_error:='Recipient email is invalid';
  end if;
  currency_label:=case when friend_order.market_code='MY' then 'RM ' else 'S$ ' end;
  insert into public.notification_outbox
    (order_id,event,audience,dedupe_key,template_key,template_snapshot,recipient,status,error_message,due_at)
  values
    (friend_order.id,'referral_friend','customer','referral_friend:'||friend_order.id,
     'referral_friend',jsonb_build_object(
       'subject','Your Shizuku Lab referral saving is confirmed 🍵',
       'heading','Your referral saving is confirmed',
       'message','Hi {customer_name},'||E'\n\n'||'Your payment has been confirmed. Your first-order referral saving of '||currency_label||to_char(friend_order.referral_discount,'FM999999990.00')||' was applied to this order.'||E'\n\n'||'Thank you for trying Shizuku Lab. 🤍',
       'cta_label','View your order'),
     trim(friend_order.customer_email),status_label,status_error,now())
  on conflict(dedupe_key) do nothing;
  return new;
end;
$$;

revoke all on function private.queue_shizuku_referral_friend_email() from public,anon,authenticated;
drop trigger if exists shizuku_referral_friend_email on private.shizuku_referral_claims;
create trigger shizuku_referral_friend_email
after update of status on private.shizuku_referral_claims
for each row when (new.status = 'earned' and old.status is distinct from 'earned')
execute function private.queue_shizuku_referral_friend_email();
