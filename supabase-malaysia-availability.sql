-- Shizuku Lab · independent Malaysia pickup availability.
-- Safe to run once through the Supabase migration runner.

begin;

alter table public.store_settings
  add column if not exists malaysia_weekly_pickup_schedule jsonb,
  add column if not exists malaysia_order_advance_days integer,
  add column if not exists malaysia_minimum_order_notice_hours integer,
  add column if not exists malaysia_pickup_slot_interval_minutes integer;

update public.store_settings
set malaysia_weekly_pickup_schedule = coalesce(malaysia_weekly_pickup_schedule, weekly_pickup_schedule, '[]'::jsonb),
    malaysia_order_advance_days = coalesce(malaysia_order_advance_days, order_advance_days, 14),
    malaysia_minimum_order_notice_hours = coalesce(malaysia_minimum_order_notice_hours, minimum_order_notice_hours, 12),
    malaysia_pickup_slot_interval_minutes = coalesce(malaysia_pickup_slot_interval_minutes, pickup_slot_interval_minutes, 30);

alter table public.store_settings
  alter column malaysia_weekly_pickup_schedule set default '[]'::jsonb,
  alter column malaysia_weekly_pickup_schedule set not null,
  alter column malaysia_order_advance_days set default 14,
  alter column malaysia_order_advance_days set not null,
  alter column malaysia_minimum_order_notice_hours set default 12,
  alter column malaysia_minimum_order_notice_hours set not null,
  alter column malaysia_pickup_slot_interval_minutes set default 30,
  alter column malaysia_pickup_slot_interval_minutes set not null;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'malaysia_order_advance_days_range') then
    alter table public.store_settings add constraint malaysia_order_advance_days_range
      check (malaysia_order_advance_days between 1 and 365);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'malaysia_minimum_notice_range') then
    alter table public.store_settings add constraint malaysia_minimum_notice_range
      check (malaysia_minimum_order_notice_hours between 0 and 720);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'malaysia_pickup_interval_range') then
    alter table public.store_settings add constraint malaysia_pickup_interval_range
      check (malaysia_pickup_slot_interval_minutes between 5 and 120);
  end if;
end $$;

alter table public.store_opening_overrides
  add column if not exists market_code text;

update public.store_opening_overrides
set market_code = 'SG'
where market_code is null or upper(trim(market_code)) not in ('SG','MY');

alter table public.store_opening_overrides
  alter column market_code set default 'SG',
  alter column market_code set not null;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'store_opening_overrides_market_code_check') then
    alter table public.store_opening_overrides add constraint store_opening_overrides_market_code_check
      check (market_code in ('SG','MY'));
  end if;
end $$;

alter table public.store_opening_overrides
  drop constraint if exists store_opening_overrides_collection_date_key;

create unique index if not exists store_opening_overrides_market_date_key
  on public.store_opening_overrides (market_code, collection_date);

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
  new_market text := upper(coalesce(nullif(trim(new.market_code),''),'SG'));
begin
  if tg_op = 'UPDATE'
     and new.collection_date is not distinct from old.collection_date
     and new.collection_time is not distinct from old.collection_time
     and upper(coalesce(new.market_code,'SG')) is not distinct from upper(coalesce(old.market_code,'SG'))
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
  where o.market_code = new_market
    and o.collection_date = new.collection_date
    and o.is_open = true
  limit 1;

  if not coalesce(override_found,false) then
    select d into schedule_day
    from public.store_settings s,
         lateral jsonb_array_elements(
           case when new_market = 'MY'
                then coalesce(s.malaysia_weekly_pickup_schedule,'[]'::jsonb)
                else coalesce(s.weekly_pickup_schedule,'[]'::jsonb)
           end
         ) d
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
  where upper(coalesce(o.market_code,'SG')) = new_market
    and o.collection_date = new.collection_date
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
before insert or update of collection_date, collection_time, order_status, market_code
on public.orders
for each row execute function public.enforce_shizuku_pickup_capacity();

commit;
