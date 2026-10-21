-- The admin can record the actual collection date when redeeming a drink in store.
-- This wrapper retains the existing collected/immediate-credit behavior and the
-- admin-only, manual customer-email policy of the four-argument function.
create function public.admin_redeem_shizuku_matcha_pass_on_date(
  p_pass_id uuid, p_product_id text, p_idempotency_key text,
  p_top_up_paid boolean, p_collection_date date
)
returns jsonb
language plpgsql security definer set search_path = ''
as $function$
declare
  v_pass public.ritual_passes%rowtype;
  v_result jsonb;
  v_order_id bigint;
  v_today date := (now() at time zone 'Asia/Singapore')::date;
begin
  if not public.is_shizuku_admin() then raise exception 'Not authorised'; end if;
  if p_collection_date is null or p_collection_date > v_today then
    raise exception 'Choose the actual collection date (today or earlier)';
  end if;
  select * into v_pass from public.ritual_passes where id=p_pass_id;
  if not found then raise exception 'Matcha Pass not found'; end if;
  if p_collection_date < (v_pass.purchased_at at time zone 'Asia/Singapore')::date then
    raise exception 'Collection date cannot be before this Pass was purchased';
  end if;
  if p_collection_date > (v_pass.expires_at at time zone 'Asia/Singapore')::date then
    raise exception 'Collection date cannot be after this Pass expires';
  end if;

  v_result := public.admin_redeem_shizuku_matcha_pass(
    p_pass_id,p_product_id,p_idempotency_key,p_top_up_paid
  );
  if coalesce((v_result->>'duplicate')::boolean,false) then return v_result; end if;
  v_order_id := (v_result->>'order_id')::bigint;
  update public.orders set collection_date=p_collection_date
    where id=v_order_id and matcha_pass_admin_redeemed;
  update public.ritual_redemption_batches set collection_date=p_collection_date
    where pass_id=p_pass_id and order_id=v_order_id::text;
  update public.ritual_redemptions set collection_date=p_collection_date
    where pass_id=p_pass_id and order_id=v_order_id::text;
  return v_result || jsonb_build_object('collection_date',p_collection_date);
end;
$function$;

revoke all on function public.admin_redeem_shizuku_matcha_pass_on_date(uuid,text,text,boolean,date) from public,anon;
grant execute on function public.admin_redeem_shizuku_matcha_pass_on_date(uuid,text,text,boolean,date) to authenticated;
