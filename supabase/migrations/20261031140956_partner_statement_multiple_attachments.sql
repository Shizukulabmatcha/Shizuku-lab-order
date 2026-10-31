alter table public.partners
  add column if not exists statement_attachments jsonb not null default '[]'::jsonb;

update public.partners
set statement_attachments = jsonb_build_array(jsonb_build_object(
  'url', statement_attachment_url,
  'name', coalesce(nullif(statement_attachment_name, ''), 'Statement.pdf'),
  'type', coalesce(nullif(statement_attachment_type, ''), 'application/pdf')
))
where statement_attachment_url is not null
  and btrim(statement_attachment_url) <> ''
  and statement_attachments = '[]'::jsonb;

create or replace function public.send_partner_statement_email(p_partner_id bigint, p_period_month date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  p public.partners%rowtype;
  n public.notification_settings%rowtype;
  month_start date := date_trunc('month', coalesce(p_period_month, current_date))::date;
  month_end date := (date_trunc('month', coalesce(p_period_month, current_date)) + interval '1 month')::date;
  month_label text;
  all_orders integer := 0;
  completed_orders integer := 0;
  eligible_sales numeric := 0;
  commission_earned numeric := 0;
  payout_status text := 'Pending';
  subject_text text;
  message_text text;
  attachments jsonb;
  attachment jsonb;
  request_id bigint;
begin
  if not public.is_shizuku_admin() then raise exception 'Not authorised'; end if;
  select * into p from public.partners where id = p_partner_id;
  if not found then raise exception 'Partner was not found'; end if;
  if coalesce(btrim(p.statement_email), '') = '' or
     p.statement_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Enter a valid Partner statement email';
  end if;
  attachments := p.statement_attachments;
  if jsonb_typeof(attachments) <> 'array' then raise exception 'Invalid statement attachments'; end if;
  if jsonb_array_length(attachments) = 0 and coalesce(btrim(p.statement_attachment_url), '') <> '' then
    attachments := jsonb_build_array(jsonb_build_object('url', p.statement_attachment_url, 'name', coalesce(p.statement_attachment_name,'Statement.pdf'), 'type', coalesce(p.statement_attachment_type,'application/pdf')));
  end if;
  if jsonb_array_length(attachments) < 1 or jsonb_array_length(attachments) > 10 then
    raise exception 'Attach 1 to 10 statement files before sending';
  end if;
  for attachment in select value from jsonb_array_elements(attachments)
  loop
    if coalesce(btrim(attachment->>'url'), '') = '' or coalesce(btrim(attachment->>'name'), '') = '' then
      raise exception 'Statement attachment URL and name are required';
    end if;
  end loop;
  select * into n from public.notification_settings where id = 1;
  if coalesce(btrim(n.webhook_url), '') = '' then raise exception 'The email Web App URL is missing'; end if;
  select count(*)::integer into all_orders from public.orders o
  where o.partner_id = p.id and o.created_at >= month_start and o.created_at < month_end;
  select count(*)::integer, coalesce(sum(f.eligible_sales),0), coalesce(sum(f.commission_amount),0)
  into completed_orders, eligible_sales, commission_earned
  from public.partner_order_financials f join public.orders o on o.id = f.order_id
  where f.partner_id = p.id and f.earned_at is not null and f.voided_at is null
    and o.created_at >= month_start and o.created_at < month_end;
  if exists(select 1 from public.partner_payouts pp where pp.partner_id = p.id and pp.period_month = month_start and pp.status = 'paid') then
    payout_status := 'Paid';
  elsif current_date >= month_end then payout_status := 'Due';
  end if;
  month_label := to_char(month_start, 'FMMonth YYYY');
  subject_text := coalesce(nullif(p.statement_email_subject_template, ''), '{month} statement · Shizuku Lab × {partner_name}');
  message_text := coalesce(nullif(p.statement_email_message_template, ''), 'Your Partner Referral statement is attached.');
  subject_text := replace(replace(replace(replace(replace(replace(replace(
    subject_text, '{partner_name}', p.name), '{month}', month_label),
    '{all_orders}', all_orders::text), '{completed_orders}', completed_orders::text),
    '{eligible_sales}', 'S$ ' || to_char(eligible_sales, 'FM999999990.00')),
    '{commission_earned}', 'S$ ' || to_char(commission_earned, 'FM999999990.00')),
    '{payout_status}', payout_status);
  message_text := replace(replace(replace(replace(replace(replace(replace(
    message_text, '{partner_name}', p.name), '{month}', month_label),
    '{all_orders}', all_orders::text), '{completed_orders}', completed_orders::text),
    '{eligible_sales}', 'S$ ' || to_char(eligible_sales, 'FM999999990.00')),
    '{commission_earned}', 'S$ ' || to_char(commission_earned, 'FM999999990.00')),
    '{payout_status}', payout_status);
  subject_text := regexp_replace(subject_text, 'https?://[^[:space:]<>]*?/admin[^[:space:]<>]*', '', 'gi');
  message_text := regexp_replace(message_text, 'https?://[^[:space:]<>]*?/admin[^[:space:]<>]*', '', 'gi');
  select net.http_post(
    timeout_milliseconds := 60000,
    url := n.webhook_url,
    headers := jsonb_build_object('Content-Type','application/json'),
    body := jsonb_build_object(
      'event','partner_statement', 'send_owner',false,
      'customer_email',p.statement_email, 'partner_name',p.name,
      'period_month',month_start, 'month_label',month_label,
      'statement_subject',subject_text, 'statement_message',message_text,
      'all_orders',all_orders, 'completed_orders',completed_orders,
      'eligible_sales',eligible_sales, 'commission_earned',commission_earned,
      'payout_status',payout_status, 'attachments',attachments,
      'attachment_url',case when jsonb_array_length(attachments)=1 then attachments->0->>'url' else null end,
      'attachment_name',case when jsonb_array_length(attachments)=1 then attachments->0->>'name' else null end,
      'attachment_type',case when jsonb_array_length(attachments)=1 then attachments->0->>'type' else null end
    )
  ) into request_id;
  return jsonb_build_object('ok',true,'queued',true,'request_id',request_id,'attachment_count',jsonb_array_length(attachments));
end;
$function$;
