alter table public.store_settings
  add column if not exists system_theme text default 'zen',
  add column if not exists ordering_theme text default 'zen',
  add column if not exists admin_theme text default 'zen',
  add column if not exists admin_theme_primary text default '#4B5D3A',
  add column if not exists admin_theme_background text default '#F3EEE3',
  add column if not exists admin_theme_card text default '#FFFFFF',
  add column if not exists admin_theme_text text default '#2A2A22',
  add column if not exists show_customer_receipt boolean default true,
  add column if not exists receipt_button_text text default 'View receipt';

update public.store_settings
set system_theme = coalesce(system_theme, 'zen'),
    ordering_theme = coalesce(ordering_theme, system_theme, 'zen'),
    admin_theme = coalesce(admin_theme, system_theme, 'zen'),
    show_customer_receipt = coalesce(show_customer_receipt, true),
    receipt_button_text = coalesce(receipt_button_text, 'View receipt');
