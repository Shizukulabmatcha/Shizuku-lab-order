-- Run once to add the separate Live Chat email notification checkbox.
alter table public.notification_settings
add column if not exists alert_live_chat boolean not null default true;

-- Re-run supabase-order-messages.sql after this file so the email trigger uses
-- the new checkbox and includes customer details in the notification.
