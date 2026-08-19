-- FREE-YARDS HOLE (found 2026-08-19, applied live the same day): RLS
-- restricts which ROWS an admin can update, not which COLUMNS. Any company
-- admin could set their own subscription_status='active' through PostgREST
-- with the browser's anon key and never pay. All billing truth (status,
-- stripe ids, yard_quantity) is written exclusively by the service role
-- (webhook, checkout, post-payment confirm, quantity sync), which bypasses
-- grants — sessions only ever need the two benign columns.
revoke update on public.saas_companies from anon, authenticated;
grant update (name, npt_day_estimate) on public.saas_companies to authenticated;

-- Same class, people version: an admin could self-promote to owner (and an
-- owner can delete the whole company). No app feature updates memberships
-- through the session client — invites go through SECURITY DEFINER RPCs —
-- so sessions get no UPDATE here, period.
revoke update on public.saas_memberships from anon, authenticated;
