-- Slow Studio website visibility controls for the customer welcome and ordering pages.
alter table public.store_settings
  add column if not exists website_visibility text not null default 'live',
  add column if not exists website_hidden_title text not null default 'We’ll be back soon.',
  add column if not exists website_hidden_message text not null default 'We’re preparing our next opening. Please check back again soon.',
  add column if not exists malaysia_website_visibility text not null default 'hidden',
  add column if not exists malaysia_website_hidden_title text not null default 'Malaysia ordering is coming soon.',
  add column if not exists malaysia_website_hidden_message text not null default 'We’re preparing Malaysia prices, availability and collection details.';

alter table public.store_settings
  drop constraint if exists store_settings_website_visibility_check;

alter table public.store_settings
  add constraint store_settings_website_visibility_check
  check (website_visibility in ('live', 'hidden'));

alter table public.store_settings
  drop constraint if exists store_settings_malaysia_website_visibility_check;

alter table public.store_settings
  add constraint store_settings_malaysia_website_visibility_check
  check (malaysia_website_visibility in ('live', 'hidden'));

grant select on public.store_settings to anon, authenticated;
grant update on public.store_settings to authenticated;
