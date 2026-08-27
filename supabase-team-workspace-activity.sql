-- Slow Studio workspace team, roles, preferences and non-blocking activity history.
-- Reuses the existing studio_users, studio_settings and activity_log tables.

alter table public.studio_users
  drop constraint if exists studio_users_role_check;

update public.studio_users
set role = case
  when role = 'Editor' then 'Marketing'
  when role = 'Staff' then 'Crew'
  else role
end
where role in ('Editor', 'Staff');

alter table public.studio_users
  add constraint studio_users_role_check
  check (role in (
    'Owner',
    'Store Manager',
    'Operations',
    'Kitchen & Prep',
    'Marketing',
    'Admin',
    'Crew'
  ));

update public.studio_settings
set data = coalesce(data, '{}'::jsonb) || jsonb_build_object(
  'country', coalesce(nullif(data->>'country', ''), 'Singapore'),
  'currency', coalesce(nullif(data->>'currency', ''), 'SGD'),
  'language', coalesce(nullif(data->>'language', ''), 'English')
),
updated_at = now()
where id = 'main';

-- Existing active workspace members can open the Shizuku Lab Admin.
-- The original owner email remains a safe bootstrap path.
create or replace function public.is_shizuku_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    auth.uid() is not null
    and (
      lower(coalesce(auth.jwt() ->> 'email', '')) = 'tinghuioh29@gmail.com'
      or exists (
        select 1
        from public.studio_users su
        where su.is_active
          and (
            su.auth_user_id = auth.uid()
            or lower(su.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
          )
      )
    );
$$;

revoke all on function public.is_shizuku_admin() from public;
grant execute on function public.is_shizuku_admin() to authenticated;

drop policy if exists "studio members read team" on public.studio_users;
create policy "studio members read team"
on public.studio_users
for select
to authenticated
using (private.is_studio_member());

-- Activity history is append-only from the browser. Nobody can edit or delete it.
revoke all on public.activity_log from anon;
revoke update, delete, truncate on public.activity_log from authenticated;
grant select, insert on public.activity_log to authenticated;

create or replace function public.log_shizuku_admin_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.studio_users%rowtype;
  record_id text;
  module_name text;
begin
  -- Customer/anonymous storefront activity is intentionally not included.
  if auth.uid() is null then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  select * into actor
  from public.studio_users
  where is_active
    and (
      auth_user_id = auth.uid()
      or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  order by created_at
  limit 1;

  record_id := coalesce(
    case when tg_op = 'DELETE' then to_jsonb(old)->>'id' else to_jsonb(new)->>'id' end,
    case when tg_op = 'DELETE' then to_jsonb(old)->>'order_number' else to_jsonb(new)->>'order_number' end,
    'record'
  );
  module_name := initcap(replace(tg_table_name, '_', ' '));

  begin
    insert into public.activity_log (
      action, module, summary, details,
      actor_id, actor_email, actor_name
    ) values (
      lower(tg_op),
      module_name,
      initcap(lower(tg_op)) || ' ' || module_name || ' · ' || record_id,
      jsonb_build_object('table', tg_table_name, 'record_id', record_id),
      auth.uid(),
      coalesce(actor.email, auth.jwt() ->> 'email'),
      coalesce(actor.display_name, auth.jwt() ->> 'email')
    );
  exception when others then
    -- Activity history must never block an order or settings change.
    null;
  end;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

-- This function is only meant to run from database triggers. It should not be
-- callable directly from the public API.
revoke execute on function public.log_shizuku_admin_activity() from public, anon, authenticated;

revoke all on function public.log_shizuku_admin_activity() from public;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'orders',
    'products',
    'inventory_items',
    'product_recipes',
    'promo_codes',
    'store_opening_overrides',
    'store_settings',
    'studio_users',
    'studio_settings'
  ] loop
    execute format('drop trigger if exists log_admin_activity on public.%I', table_name);
    execute format(
      'create trigger log_admin_activity after insert or update or delete on public.%I for each row execute function public.log_shizuku_admin_activity()',
      table_name
    );
  end loop;
end;
$$;
