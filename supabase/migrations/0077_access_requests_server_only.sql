-- Requests for access are saved by the server (app/api/access), which checks
-- them, caps how many an hour, and emails the founder. An old rule also let
-- anyone on the internet write rows straight into the table with the site's
-- public key, past all of that. Nothing uses it.
drop policy if exists "anon submit audit_request" on public.audit_requests;

-- Same for the older "leads" table: no page or route writes to it anymore,
-- and the rule let anyone add rows to it with the public key.
drop policy if exists "anon submit lead" on public.leads;
