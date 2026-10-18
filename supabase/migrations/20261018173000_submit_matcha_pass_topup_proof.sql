-- A pass redemption has no customer_id when created by the pass RPC, so the
-- ordinary customer-owned payment proof function cannot accept its top-up.
-- Verify the pass phone, order, caller identity, and caller-owned storage path.
create or replace function public.submit_matcha_pass_payment_proof(
  p_order_id bigint,
  p_phone text,
  p_transaction_reference text,
  p_screenshot_path text
) returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_order public.orders%rowtype;
  v_pass public.ritual_passes%rowtype;
  v_phone text;
  v_pass_phone text;
begin
  if auth.uid() is null then
    raise exception 'A customer session is required.' using errcode = '42501';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.order_kind is distinct from 'matcha_pass_redemption'
    or v_order.payment_status not in ('awaiting_payment', 'rejected')
    or coalesce(v_order.matcha_pass_top_up, 0) <= 0
    or (v_order.customer_id is not null and v_order.customer_id <> auth.uid()) then
    raise exception 'This Matcha Pass payment cannot be updated.' using errcode = '42501';
  end if;

  select * into v_pass from public.ritual_passes where id = v_order.matcha_pass_id;
  v_phone := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  v_pass_phone := regexp_replace(coalesce(v_pass.customer_phone, ''), '[^0-9]', '', 'g');
  if left(v_phone, 2) = '65' then v_phone := substr(v_phone, 3); end if;
  if left(v_pass_phone, 2) = '65' then v_pass_phone := substr(v_pass_phone, 3); end if;
  if v_pass.id is null or length(v_phone) <> 8 or v_phone <> v_pass_phone
    or right(regexp_replace(coalesce(v_order.customer_phone, ''), '[^0-9]', '', 'g'), 8) <> v_phone then
    raise exception 'This Matcha Pass payment cannot be updated.' using errcode = '42501';
  end if;

  if p_screenshot_path is null or
    left(p_screenshot_path, length(auth.uid()::text || '/' || p_order_id || '/'))
      <> auth.uid()::text || '/' || p_order_id || '/' then
    raise exception 'The payment screenshot path is invalid.' using errcode = '42501';
  end if;

  update public.orders
  set customer_id = coalesce(customer_id, auth.uid()),
      payment_status = 'submitted',
      order_status = 'awaiting_confirmation',
      payment_transaction_reference = nullif(trim(coalesce(p_transaction_reference, '')), ''),
      payment_screenshot_url = p_screenshot_path
  where id = p_order_id;
end;
$function$;

revoke all on function public.submit_matcha_pass_payment_proof(bigint,text,text,text) from public, anon;
grant execute on function public.submit_matcha_pass_payment_proof(bigint,text,text,text) to authenticated;
