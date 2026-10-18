-- Repair Matcha Pass notification dispatch without changing other email events.
-- The original generate_series alias `n` conflicts with the notification_settings
-- record variable `n` and raises SQLSTATE 42702 when Pass emails are dispatched.
do $migration$
declare
  definition text;
  before_block text := $before$
        select coalesce(jsonb_agg(jsonb_build_array(
          case n when 1 then '1st drink' when 2 then '2nd drink' when 3 then '3rd drink' else n||'th drink' end,
          coalesce((select rr.product_name||case when rr.pass_top_up>0 then ' · +'||to_char(rr.pass_top_up,'FM999990.00') else ' · Included' end from public.ritual_redemptions rr where rr.pass_id=p.id and rr.redemption_number=n),'Available')
        ) order by n),'[]'::jsonb) into credit_rows from generate_series(1,p.total_drinks)n;$before$;
  after_block text := $after$
        select coalesce(jsonb_agg(jsonb_build_array(
          case gs.drink_no when 1 then '1st drink' when 2 then '2nd drink' when 3 then '3rd drink' else gs.drink_no||'th drink' end,
          coalesce((select rr.product_name||case when rr.pass_top_up>0 then ' · +'||to_char(rr.pass_top_up,'FM999990.00') else ' · Included' end from public.ritual_redemptions rr where rr.pass_id=p.id and rr.redemption_number=gs.drink_no),'Available')
        ) order by gs.drink_no),'[]'::jsonb) into credit_rows from generate_series(1,p.total_drinks) as gs(drink_no);$after$;
begin
  select pg_get_functiondef('private.process_notification_outbox()'::regprocedure) into definition;
  if definition is null or strpos(definition, before_block) = 0 then
    raise exception 'Matcha Pass dispatcher changed; migration needs review';
  end if;
  execute replace(definition, before_block, after_block);
end;
$migration$;

-- Include the redeemed drink names in the customer-facing email snapshot.
-- This notification is queued when an order becomes collected, after its
-- redemption records and remaining-credit count have been updated.
do $migration$
declare
  definition text;
  before_declaration text := E'  redemption_summary text;\nbegin';
  after_declaration text := E'  redemption_summary text;\n  redemption_drinks text;\nbegin';
  before_summary text := $before$    redemption_summary:=case when first_redemption=last_redemption then 'Your '||first_label||' drink has been redeemed.' else 'Your '||first_label||' to '||last_label||' drinks have been redeemed.' end;$before$;
  after_summary text := $after$    redemption_summary:=case when first_redemption=last_redemption then 'Your '||first_label||' drink has been redeemed.' else 'Your '||first_label||' to '||last_label||' drinks have been redeemed.' end;
    select string_agg(coalesce(nullif(trim(rr.product_name),''),'Drink'), ', ' order by rr.redemption_number)
      into redemption_drinks
      from public.ritual_redemptions rr
      where rr.pass_id=p.id and rr.order_id=o.id::text;$after$;
  before_message text := $before$redemption_summary||E'\n\n'||'Balance: '$before$;
  after_message text := $after$redemption_summary||E'\n\n'||'Redeemed: '||coalesce(redemption_drinks,'Drink')||E'\n\n'||'Balance: '$after$;
begin
  select pg_get_functiondef('private.queue_matcha_pass_notification(bigint,text,text)'::regprocedure) into definition;
  if definition is null
     or strpos(definition, before_declaration) = 0
     or strpos(definition, before_summary) = 0
     or strpos(definition, before_message) = 0 then
    raise exception 'Matcha Pass email template changed; migration needs review';
  end if;
  definition := replace(definition, before_declaration, after_declaration);
  definition := replace(definition, before_summary, after_summary);
  definition := replace(definition, before_message, after_message);
  execute definition;
end;
$migration$;
