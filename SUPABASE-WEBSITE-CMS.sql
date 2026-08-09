-- Shizuku Lab Website CMS 2.0
-- Run this ONCE in Supabase -> SQL Editor.

create table if not exists public.website_live (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid null
);

create table if not exists public.website_drafts (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid null
);

alter table public.website_live enable row level security;
alter table public.website_drafts enable row level security;

-- Re-running this file is safe.
drop policy if exists "website live is public" on public.website_live;
drop policy if exists "admin can write website live" on public.website_live;
drop policy if exists "admin can read website draft" on public.website_drafts;
drop policy if exists "admin can insert website draft" on public.website_drafts;
drop policy if exists "admin can update website draft" on public.website_drafts;
drop policy if exists "admin can delete website draft" on public.website_drafts;

create policy "website live is public"
on public.website_live for select
to anon, authenticated
using (true);

create policy "admin can write website live"
on public.website_live for all
to authenticated
using (lower(coalesce(auth.jwt()->>'email','')) = 'tinghuioh29@gmail.com')
with check (lower(coalesce(auth.jwt()->>'email','')) = 'tinghuioh29@gmail.com');

create policy "admin can read website draft"
on public.website_drafts for select
to authenticated
using (lower(coalesce(auth.jwt()->>'email','')) = 'tinghuioh29@gmail.com');

create policy "admin can insert website draft"
on public.website_drafts for insert
to authenticated
with check (lower(coalesce(auth.jwt()->>'email','')) = 'tinghuioh29@gmail.com');

create policy "admin can update website draft"
on public.website_drafts for update
to authenticated
using (lower(coalesce(auth.jwt()->>'email','')) = 'tinghuioh29@gmail.com')
with check (lower(coalesce(auth.jwt()->>'email','')) = 'tinghuioh29@gmail.com');

create policy "admin can delete website draft"
on public.website_drafts for delete
to authenticated
using (lower(coalesce(auth.jwt()->>'email','')) = 'tinghuioh29@gmail.com');
