-- Event package management. Applied to Shizuku Lab Supabase on 2026-10-08.
-- Additive table: existing orders, products, costing and inventory remain unchanged.
create table if not exists public.event_packages (
  id uuid primary key default gen_random_uuid(),
  market_code text not null default 'SG' check (market_code in ('SG','MY')),
  event_name text not null default '',
  partner_name text not null default '',
  partner_email text not null default '',
  package_name text not null default '',
  package_includes text not null default '',
  event_date date,
  venue text not null default '',
  event_type text not null default 'workshop' check (event_type in ('workshop','live_station','drink_drop')),
  status text not null default 'draft' check (status in ('draft','quoted','confirmed','completed','cancelled')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','partial','paid')),
  payment_instructions text not null default '',
  amount_paid numeric(12,2) not null default 0 check (amount_paid >= 0),
  pax integer not null default 0 check (pax >= 0),
  price_per_pax numeric(12,2) not null default 0 check (price_per_pax >= 0),
  flat_fee numeric(12,2) not null default 0 check (flat_fee >= 0),
  matcha_quantity text not null default '',
  costs jsonb not null default '{}'::jsonb,
  notes text not null default '',
  total_revenue numeric(12,2) not null default 0,
  total_cost numeric(12,2) not null default 0,
  gross_profit numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists event_packages_market_date_idx on public.event_packages (market_code,event_date desc);
alter table public.event_packages enable row level security;
revoke all on public.event_packages from public, anon, authenticated;
grant select, insert, update on public.event_packages to authenticated;
drop policy if exists event_packages_admin_all on public.event_packages;
create policy event_packages_admin_all on public.event_packages for all to authenticated
  using ((select public.is_shizuku_admin()))
  with check ((select public.is_shizuku_admin()));
