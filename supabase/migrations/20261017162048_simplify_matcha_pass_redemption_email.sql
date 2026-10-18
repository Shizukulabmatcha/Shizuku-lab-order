-- Keep the redeemed drink name only in its 1st–4th drink row.
-- Purchase and ordinary order notifications are intentionally unchanged.
do $migration$
declare
  definition text;
  before_message text := $before$redemption_summary||E'\n\n'||'Redeemed: '||coalesce(redemption_drinks,'Drink')||E'\n\n'||'Balance: '||remaining||' of '||p.total_drinks||' drinks remaining'||E'\n\n'||'Thank$before$;
  after_message text := $after$redemption_summary||E'\n\n'||'Thank$after$;
begin
  select pg_get_functiondef('private.queue_matcha_pass_notification(bigint,text,text)'::regprocedure) into definition;
  if definition is null or strpos(definition, before_message) = 0 then
    raise exception 'Matcha Pass queue template changed; migration needs review';
  end if;
  execute replace(definition, before_message, after_message);
end;
$migration$;

-- Redemption emails show collection, top-up, balance, expiry and drink slots.
-- The pass code and order number remain in the database/admin but not this email.
do $migration$
declare
  definition text;
  before_rows text := $before$if q.event='matcha_pass_redemption' then rows:=jsonb_build_array(jsonb_build_array('Order',o.order_number),jsonb_build_array('Collection'$before$;
  after_rows text := $after$if q.event='matcha_pass_redemption' then rows:=jsonb_build_array(jsonb_build_array('Collection'$after$;
  before_tail text := $before$to_char(coalesce(o.matcha_pass_top_up,0),'FM999999990.00')))||rows; end if;$before$;
  after_tail text := $after$to_char(coalesce(o.matcha_pass_top_up,0),'FM999999990.00')))||(rows - 0); end if;$after$;
  before_items text := $before$'items',case when q.event='matcha_pass_purchase' then '[]'::jsonb else items end$before$;
  after_items text := $after$'items',case when q.event in ('matcha_pass_purchase','matcha_pass_redemption') then '[]'::jsonb else items end$after$;
begin
  select pg_get_functiondef('private.process_notification_outbox()'::regprocedure) into definition;
  if definition is null
    or strpos(definition, before_rows) = 0
    or strpos(definition, before_tail) = 0
    or strpos(definition, before_items) = 0 then
    raise exception 'Notification dispatcher changed; migration needs review';
  end if;
  definition := replace(definition, before_rows, after_rows);
  definition := replace(definition, before_tail, after_tail);
  definition := replace(definition, before_items, after_items);
  execute definition;
end;
$migration$;
