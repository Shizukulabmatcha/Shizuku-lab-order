-- Editable marketing campaigns for consented customers.
alter table public.store_settings
  add column if not exists marketing_email_subject text not null default 'September Opening Dates + A Little Treat 🍵',
  add column if not exists marketing_email_body text not null default E'Hi there ♡\n\nOur September opening dates are here\n\nYou can find our available collection dates and timings in the calendar attached. For the latest availability or any schedule updates, please refer to our ordering page.\n\nAnd a little update for this month — we’re retiring our previous promo code SHIZUKULABAUG and changing it to:\nFIRSTDROP\n\nUse FIRSTDROP to enjoy $1 OFF your order ✨\nEven if you’ve used SHIZUKULABAUG before, you can still use FIRSTDROP one more time.\n\nOne-time use per customer.\n\nThank you for supporting our little lab ♡\nSee you this September!\nShizuku Lab\nCrafted drop by drop.',
  add column if not exists marketing_attachment_url text,
  add column if not exists marketing_attachment_name text,
  add column if not exists marketing_attachment_type text,
  add column if not exists marketing_whatsapp_message text not null default E'Hi {customer_name} ♡\n\nOur September opening dates are here 🍵\n\nPlease check our ordering page for the latest collection dates and timings. Use FIRSTDROP to enjoy $1 OFF your order ✨\n\nOne-time use per customer.\n\nThank you for supporting our little lab ♡\nShizuku Lab · Crafted drop by drop.';

create or replace function public.send_marketing_campaign_email(p_customer_email text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  contact record;
  campaign record;
  notify record;
  request_id bigint;
  normalized_email text := lower(trim(coalesce(p_customer_email, '')));
begin
  if not public.is_shizuku_admin() then raise exception 'Not authorised'; end if;
  if normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'Invalid email address'; end if;

  select o.customer_name, o.customer_email into contact
  from public.orders o
  where lower(trim(coalesce(o.customer_email, ''))) = normalized_email
    and o.marketing_email_opt_in = true
  order by coalesce(o.marketing_consent_at, o.created_at) desc
  limit 1;
  if not found then raise exception 'Customer has not opted in to email marketing'; end if;

  select s.marketing_email_subject, s.marketing_email_body,
         s.marketing_attachment_url, s.marketing_attachment_name, s.marketing_attachment_type
  into campaign from public.store_settings s order by s.created_at limit 1;
  select n.webhook_url into notify from public.notification_settings n where n.id = 1;
  if nullif(trim(coalesce(notify.webhook_url, '')), '') is null then raise exception 'Email webhook is not configured'; end if;

  select net.http_post(
    url := notify.webhook_url,
    headers := jsonb_build_object('Content-Type','application/json'),
    body := jsonb_build_object(
      'event','marketing_campaign', 'send_owner',false, 'customer_email',contact.customer_email,
      'customer_name',contact.customer_name, 'marketing_email_subject',campaign.marketing_email_subject,
      'marketing_email_body',campaign.marketing_email_body, 'attachment_url',campaign.marketing_attachment_url,
      'attachment_name',campaign.marketing_attachment_name, 'attachment_type',campaign.marketing_attachment_type
    )
  ) into request_id;
  return jsonb_build_object('ok',true,'queued',true,'request_id',request_id);
end;
$$;

revoke all on function public.send_marketing_campaign_email(text) from public, anon;
grant execute on function public.send_marketing_campaign_email(text) to authenticated, service_role;
