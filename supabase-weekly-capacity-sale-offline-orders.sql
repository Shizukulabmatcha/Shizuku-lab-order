-- Shizuku Lab · weekly pickup schedule, window capacity, storewide sale,
-- and Admin-created offline orders.
-- Run this whole file once in Supabase SQL Editor before uploading v22.

begin;

alter table public.store_settings
  add column if not exists weekly_pickup_schedule jsonb,
  add column if not exists storewide_sale_enabled boolean not null default false,
  add column if not exists storewide_sale_percent numeric not null default 0,
  add column if not exists hidden_system_themes jsonb not null default '[]'::jsonb;

update public.store_settings
set weekly_pickup_schedule = jsonb_build_array(
  jsonb_build_object('day',0,'label','Sunday','is_open',true,'windows',jsonb_build_array(jsonb_build_object('range',coalesce(nullif(sunday_collection_time,''),'10:00 AM - 1:00 PM'),'capacity',null))),
  jsonb_build_object('day',1,'label','Monday','is_open',false,'windows','[]'::jsonb),
  jsonb_build_object('day',2,'label','Tuesday','is_open',false,'windows','[]'::jsonb),
  jsonb_build_object('day',3,'label','Wednesday','is_open',false,'windows','[]'::jsonb),
  jsonb_build_object('day',4,'label','Thursday','is_open',false,'windows','[]'::jsonb),
  jsonb_build_object('day',5,'label','Friday','is_open',false,'windows','[]'::jsonb),
  jsonb_build_object('day',6,'label','Saturday','is_open',true,'windows',jsonb_build_array(jsonb_build_object('range',coalesce(nullif(saturday_collection_time,''),'10:00 AM - 12:00 PM'),'capacity',null)))
)
where weekly_pickup_schedule is null;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'storewide_sale_percent_range') then
    alter table public.store_settings add constraint storewide_sale_percent_range
      check (storewide_sale_percent >= 0 and storewide_sale_percent <= 100);
  end if;
end $$;

alter table public.store_opening_overrides
  add column if not exists pickup_windows jsonb;

update public.store_opening_overrides
set pickup_windows = case
  when is_open then jsonb_build_array(jsonb_build_object('range',coalesce(nullif(collection_time,''),'10:00 AM - 12:00 PM'),'capacity',null))
  else '[]'::jsonb
end
where pickup_windows is null;

alter table public.orders
  add column if not exists is_offline boolean not null default false,
  add column if not exists offline_reason text,
  add column if not exists counts_as_sale boolean not null default true;

create or replace function public.shizuku_time_minutes(p_value text)
returns integer
language plpgsql
immutable
strict
set search_path = public
as $$
declare
  m text[];
  h integer;
  mins integer;
  meridiem text;
begin
  m := regexp_match(upper(trim(p_value)), '^(1[0-2]|[1-9])(?::([0-5][0-9]))?\s*(AM|PM)$');
  if m is null then return null; end if;
  h := m[1]::integer;
  mins := coalesce(nullif(m[2],''),'0')::integer;
  meridiem := m[3];
  if meridiem = 'AM' and h = 12 then h := 0; end if;
  if meridiem = 'PM' and h <> 12 then h := h + 12; end if;
  return h * 60 + mins;
end;
$$;

create or replace function public.enforce_shizuku_pickup_capacity()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  windows jsonb := '[]'::jsonb;
  selected_window jsonb;
  schedule_day jsonb;
  override_found boolean := false;
  pickup_minutes integer;
  parts text[];
  start_minutes integer;
  end_minutes integer;
  capacity_limit integer;
  reserved_count integer;
begin
  -- Normal fulfilment status changes (Confirmed → Preparing → Ready → Collected)
  -- must never be blocked after an order was already accepted. Re-check only when
  -- its pickup date/time changes, or when a cancelled order is reactivated.
  if tg_op = 'UPDATE'
     and new.collection_date is not distinct from old.collection_date
     and new.collection_time is not distinct from old.collection_time
     and lower(coalesce(old.order_status,'')) <> 'cancelled' then
    return new;
  end if;

  if lower(coalesce(new.order_status,'')) = 'cancelled'
     or new.collection_date is null
     or nullif(trim(coalesce(new.collection_time,'')),'') is null then
    return new;
  end if;

  select true, coalesce(o.pickup_windows,'[]'::jsonb)
    into override_found, windows
  from public.store_opening_overrides o
  where o.collection_date = new.collection_date and o.is_open = true
  limit 1;

  if not coalesce(override_found,false) then
    select d into schedule_day
    from public.store_settings s,
         lateral jsonb_array_elements(coalesce(s.weekly_pickup_schedule,'[]'::jsonb)) d
    where (d->>'day')::integer = extract(dow from new.collection_date)::integer
    limit 1;
    windows := case when coalesce((schedule_day->>'is_open')::boolean,false)
                    then coalesce(schedule_day->'windows','[]'::jsonb)
                    else '[]'::jsonb end;
  end if;

  pickup_minutes := public.shizuku_time_minutes(new.collection_time);
  if pickup_minutes is null then return new; end if;

  for selected_window in select value from jsonb_array_elements(windows)
  loop
    parts := regexp_split_to_array(coalesce(selected_window->>'range',''), '\s*[–-]\s*');
    if array_length(parts,1) < 2 then continue; end if;
    start_minutes := public.shizuku_time_minutes(parts[1]);
    end_minutes := public.shizuku_time_minutes(parts[2]);
    if start_minutes is not null and end_minutes is not null
       and pickup_minutes between start_minutes and end_minutes then
      capacity_limit := nullif(selected_window->>'capacity','')::integer;
      exit;
    end if;
  end loop;

  if capacity_limit is null then return new; end if;
  if capacity_limit <= 0 then
    raise exception 'This pickup window is fully booked.' using errcode = 'P0001';
  end if;

  select count(*) into reserved_count
  from public.orders o
  where o.collection_date = new.collection_date
    and lower(coalesce(o.order_status,'')) <> 'cancelled'
    and (tg_op = 'INSERT' or o.id is distinct from new.id)
    and public.shizuku_time_minutes(o.collection_time) between start_minutes and end_minutes;

  if reserved_count >= capacity_limit then
    raise exception 'This pickup window is fully booked (%/% orders).', reserved_count, capacity_limit
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_shizuku_pickup_capacity on public.orders;
create trigger enforce_shizuku_pickup_capacity
before insert or update of collection_date, collection_time, order_status
on public.orders
for each row execute function public.enforce_shizuku_pickup_capacity();

commit;

-- Verification only; no Production rows are changed by these queries.
select column_name from information_schema.columns
where table_schema='public' and table_name='store_settings'
  and column_name in ('weekly_pickup_schedule','storewide_sale_enabled','storewide_sale_percent','hidden_system_themes')
order by column_name;

select trigger_name from information_schema.triggers
where event_object_schema='public' and event_object_table='orders'
  and trigger_name='enforce_shizuku_pickup_capacity';
