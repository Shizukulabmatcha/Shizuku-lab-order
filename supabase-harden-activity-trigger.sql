-- Safe to run once after supabase-team-workspace-activity.sql.
-- The trigger continues to work, but API users cannot call its helper directly.
revoke execute on function public.log_shizuku_admin_activity() from public, anon, authenticated;
