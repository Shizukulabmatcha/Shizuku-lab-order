-- Slow Studio multi-HBB foundation.
-- Run as the project owner. Do not expose service-role keys to any browser.

create schema if not exists private;

create table if not exists public.slow_studio_workspaces (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  country_code text not null default 'SG',
  currency_code text not null default 'SGD',
  status text not null default 'setup' check (status in ('setup','live','hidden','suspended')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.slow_studio_platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.slow_studio_memberships (
  workspace_id uuid not null references public.slow_studio_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','operations','marketing','viewer')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (workspace_id,user_id)
);

create table if not exists public.slow_studio_workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.slow_studio_workspaces(id) on delete cascade,
  email text not null,
  role text not null default 'owner' check (role in ('owner','admin','operations','marketing','viewer')),
  status text not null default 'pending' check (status in ('pending','accepted','revoked')),
  invited_by uuid not null references auth.users(id),
  accepted_by uuid references auth.users(id),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id,email)
);

create table if not exists public.slow_studio_issues (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.slow_studio_workspaces(id) on delete cascade,
  reported_by uuid not null references auth.users(id),
  page_name text not null,
  title text not null,
  detail text,
  severity text not null default 'medium' check (severity in ('low','medium','high')),
  status text not null default 'open' check (status in ('open','reviewing','resolved')),
  owner_note text,
  resolved_by uuid references auth.users(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.slow_studio_activity (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.slow_studio_workspaces(id) on delete cascade,
  actor_id uuid not null references auth.users(id),
  action text not null,
  page_name text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists slow_studio_memberships_user_idx on public.slow_studio_memberships(user_id,workspace_id) where is_active;
create index if not exists slow_studio_issues_workspace_status_idx on public.slow_studio_issues(workspace_id,status,created_at desc);
create index if not exists slow_studio_activity_workspace_created_idx on public.slow_studio_activity(workspace_id,created_at desc);
create index if not exists slow_studio_invites_email_status_idx on public.slow_studio_workspace_invites(lower(email),status);

create or replace function private.slow_studio_is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((auth.jwt()->>'is_anonymous')::boolean,false) is false
  and exists (
    select 1 from public.slow_studio_platform_admins a
    where a.user_id = (select auth.uid())
  );
$$;

create or replace function private.slow_studio_has_role(p_workspace_id uuid, p_roles text[] default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((auth.jwt()->>'is_anonymous')::boolean,false) is false
  and (private.slow_studio_is_platform_admin() or exists (
    select 1
    from public.slow_studio_memberships m
    where m.workspace_id = p_workspace_id
      and m.user_id = (select auth.uid())
      and m.is_active
      and (p_roles is null or m.role = any(p_roles))
  ));
$$;

revoke all on function private.slow_studio_is_platform_admin() from public;
revoke all on function private.slow_studio_has_role(uuid,text[]) from public;
grant usage on schema private to authenticated;
grant execute on function private.slow_studio_is_platform_admin() to authenticated;
grant execute on function private.slow_studio_has_role(uuid,text[]) to authenticated;

alter table public.slow_studio_workspaces enable row level security;
alter table public.slow_studio_platform_admins enable row level security;
alter table public.slow_studio_memberships enable row level security;
alter table public.slow_studio_workspace_invites enable row level security;
alter table public.slow_studio_issues enable row level security;
alter table public.slow_studio_activity enable row level security;

drop policy if exists "workspace members read workspaces" on public.slow_studio_workspaces;
create policy "workspace members read workspaces" on public.slow_studio_workspaces for select to authenticated
using (private.slow_studio_has_role(id,null));
drop policy if exists "platform admins create workspaces" on public.slow_studio_workspaces;
create policy "platform admins create workspaces" on public.slow_studio_workspaces for insert to authenticated
with check (created_by = (select auth.uid()) and private.slow_studio_is_platform_admin());
drop policy if exists "workspace admins update workspaces" on public.slow_studio_workspaces;
create policy "workspace admins update workspaces" on public.slow_studio_workspaces for update to authenticated
using (private.slow_studio_has_role(id,array['owner','admin']))
with check (private.slow_studio_has_role(id,array['owner','admin']));

drop policy if exists "platform admins read platform admins" on public.slow_studio_platform_admins;
create policy "platform admins read platform admins" on public.slow_studio_platform_admins for select to authenticated
using (private.slow_studio_is_platform_admin());

drop policy if exists "workspace members read memberships" on public.slow_studio_memberships;
create policy "workspace members read memberships" on public.slow_studio_memberships for select to authenticated
using (private.slow_studio_has_role(workspace_id,null));
drop policy if exists "workspace admins manage memberships" on public.slow_studio_memberships;
create policy "workspace admins manage memberships" on public.slow_studio_memberships for all to authenticated
using (private.slow_studio_has_role(workspace_id,array['owner','admin']))
with check (private.slow_studio_has_role(workspace_id,array['owner','admin']));

drop policy if exists "invited users and workspace admins read invites" on public.slow_studio_workspace_invites;
create policy "invited users and workspace admins read invites" on public.slow_studio_workspace_invites for select to authenticated
using (
  coalesce((auth.jwt()->>'is_anonymous')::boolean,false) is false
  and (
    private.slow_studio_has_role(workspace_id,array['owner','admin'])
    or lower(email) = lower(coalesce((select auth.jwt()->>'email'),''))
  )
);
drop policy if exists "workspace admins manage invites" on public.slow_studio_workspace_invites;
create policy "workspace admins manage invites" on public.slow_studio_workspace_invites for all to authenticated
using (private.slow_studio_has_role(workspace_id,array['owner','admin']))
with check (private.slow_studio_has_role(workspace_id,array['owner','admin']));

drop policy if exists "workspace members read issues" on public.slow_studio_issues;
create policy "workspace members read issues" on public.slow_studio_issues for select to authenticated
using (private.slow_studio_has_role(workspace_id,null));
drop policy if exists "workspace members create issues" on public.slow_studio_issues;
create policy "workspace members create issues" on public.slow_studio_issues for insert to authenticated
with check (reported_by = (select auth.uid()) and private.slow_studio_has_role(workspace_id,null));
drop policy if exists "workspace admins resolve issues" on public.slow_studio_issues;
create policy "workspace admins resolve issues" on public.slow_studio_issues for update to authenticated
using (private.slow_studio_has_role(workspace_id,array['owner','admin']))
with check (private.slow_studio_has_role(workspace_id,array['owner','admin']));

drop policy if exists "workspace members read activity" on public.slow_studio_activity;
create policy "workspace members read activity" on public.slow_studio_activity for select to authenticated
using (private.slow_studio_has_role(workspace_id,null));
drop policy if exists "workspace members create activity" on public.slow_studio_activity;
create policy "workspace members create activity" on public.slow_studio_activity for insert to authenticated
with check (actor_id = (select auth.uid()) and private.slow_studio_has_role(workspace_id,null));

grant select,insert,update on public.slow_studio_workspaces to authenticated;
grant select,insert,update,delete on public.slow_studio_memberships to authenticated;
grant select,insert,update,delete on public.slow_studio_workspace_invites to authenticated;
grant select,insert,update on public.slow_studio_issues to authenticated;
grant select,insert on public.slow_studio_activity to authenticated;
grant select on public.slow_studio_platform_admins to authenticated;

create or replace function public.create_slow_studio_hbb_account(
  p_name text,
  p_country_code text,
  p_owner_email text,
  p_role text default 'owner'
)
returns table (workspace_id uuid, workspace_slug text, invite_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace public.slow_studio_workspaces;
  v_invite public.slow_studio_workspace_invites;
  v_country text := upper(trim(coalesce(p_country_code,'')));
  v_email text := lower(trim(coalesce(p_owner_email,'')));
  v_role text := lower(trim(coalesce(p_role,'owner')));
  v_slug text;
begin
  if not private.slow_studio_is_platform_admin() then
    raise exception 'Slow Studio owner access is required';
  end if;
  if length(trim(coalesce(p_name,''))) < 2 then raise exception 'Business name is required'; end if;
  if v_country not in ('SG','MY') then raise exception 'Country must be SG or MY'; end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then raise exception 'A valid owner email is required'; end if;
  if v_role not in ('owner','admin','operations','marketing','viewer') then raise exception 'Invalid role'; end if;

  v_slug := trim(both '-' from regexp_replace(lower(trim(p_name)),'[^a-z0-9]+','-','g'))
    || '-' || lower(v_country) || '-' || substr(replace(gen_random_uuid()::text,'-',''),1,6);
  insert into public.slow_studio_workspaces(slug,name,country_code,currency_code,status,created_by)
  values (v_slug,trim(p_name),v_country,case when v_country='MY' then 'MYR' else 'SGD' end,'setup',(select auth.uid()))
  returning * into v_workspace;
  insert into public.slow_studio_workspace_invites(workspace_id,email,role,status,invited_by)
  values (v_workspace.id,v_email,v_role,'pending',(select auth.uid()))
  returning * into v_invite;
  insert into public.slow_studio_activity(workspace_id,actor_id,action,page_name,detail)
  values (v_workspace.id,(select auth.uid()),'HBB account created','My stores',jsonb_build_object('owner_email',v_email,'role',v_role,'status','pending'));
  return query select v_workspace.id,v_workspace.slug,v_invite.id;
end;
$$;

create or replace function public.accept_slow_studio_hbb_invitation()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_count integer := 0;
  v_invite record;
begin
  if (select auth.uid()) is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) is true then
    raise exception 'Sign in with an email first';
  end if;
  select lower(email) into v_email from auth.users where id=(select auth.uid());
  if coalesce(v_email,'')='' then return 0; end if;
  for v_invite in
    select * from public.slow_studio_workspace_invites
    where lower(email)=v_email and status='pending'
    for update
  loop
    insert into public.slow_studio_memberships(workspace_id,user_id,role,is_active)
    values (v_invite.workspace_id,(select auth.uid()),v_invite.role,true)
    on conflict (workspace_id,user_id) do update set role=excluded.role,is_active=true;
    update public.slow_studio_workspace_invites
    set status='accepted',accepted_by=(select auth.uid()),accepted_at=now()
    where id=v_invite.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.create_slow_studio_hbb_account(text,text,text,text) from public;
revoke all on function public.accept_slow_studio_hbb_invitation() from public;
revoke execute on function public.create_slow_studio_hbb_account(text,text,text,text) from anon;
revoke execute on function public.accept_slow_studio_hbb_invitation() from anon;
grant execute on function public.create_slow_studio_hbb_account(text,text,text,text) to authenticated;
grant execute on function public.accept_slow_studio_hbb_invitation() to authenticated;

-- Ting is the initial Slow Studio platform owner.
insert into public.slow_studio_platform_admins(user_id)
select id from auth.users where lower(email)=lower('tinghuioh29@gmail.com')
on conflict (user_id) do nothing;

-- After Ting has signed up, run once in the SQL editor with the correct email:
-- insert into public.slow_studio_platform_admins(user_id)
-- select id from auth.users where lower(email)=lower('YOUR_OWNER_EMAIL')
-- on conflict (user_id) do nothing;
