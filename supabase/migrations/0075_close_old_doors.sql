-- Closing doors nothing uses anymore. Found by the database's own security
-- report during a full check of the site.
--
-- 1. Making a company. Signing up is closed (SELF_SERVE_OPEN = false in
--    lib/saas/plan.ts), and the page refuses, but the database function
--    behind it could still be called directly by anyone signed in, a
--    throwaway demo login included. Now only the server can call it.
--    WHEN SIGNUP REOPENS: grant execute on function
--    public.saas_create_company(text) to authenticated;
revoke execute on function public.saas_create_company(text) from public, anon, authenticated;
grant execute on function public.saas_create_company(text) to service_role;

-- 2. Two functions from a product before this one (workspaces). No code
--    calls them; any signed-in user could.
revoke execute on function public.create_workspace(text, text) from public, anon, authenticated;
revoke execute on function public.seed_workspace_sample(uuid) from public, anon, authenticated;

-- 3. Three older trigger functions with no fixed search path.
alter function public.saas_block_update() set search_path = public;
alter function public.saas_cert_uploads_guard() set search_path = public;
alter function public.saas_loadout_scans_locked() set search_path = public;
