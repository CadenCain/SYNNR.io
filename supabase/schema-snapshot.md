# Live schema snapshot — RLS, policies, functions, views

**Captured from the production database 2026-08-19 (trust-audit closeout).**
This exists because the saas_* schema was applied through the Supabase
connector over many sessions and never lived in the repo — every "RLS
protects this" claim in the code was unverifiable from source. Now it isn't.

Regenerate after any DDL change: the queries live in
[docs/db-verification.sql](../docs/db-verification.sql), or run
`supabase db dump --schema public` for a full DDL dump.

## Tenancy helpers (verbatim from pg_get_functiondef)

```sql
CREATE OR REPLACE FUNCTION public.saas_user_company_ids()
 RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT company_id FROM public.saas_memberships
  WHERE user_id = auth.uid() AND status = 'active'
$function$

CREATE OR REPLACE FUNCTION public.saas_is_company_admin(cid uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.saas_memberships
    WHERE company_id = cid AND user_id = auth.uid()
      AND status = 'active' AND role IN ('owner','admin')
  )
$function$

CREATE OR REPLACE FUNCTION public.saas_is_company_owner(cid uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.saas_memberships
    WHERE company_id = cid AND user_id = auth.uid()
      AND status = 'active' AND role = 'owner'
  )
$function$

CREATE OR REPLACE FUNCTION public.saas_create_company(p_name text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE cid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF coalesce(btrim(p_name),'') = '' THEN RAISE EXCEPTION 'company name required'; END IF;
  INSERT INTO public.saas_companies (name, subscription_status)
    VALUES (btrim(p_name), 'none') RETURNING id INTO cid;
  INSERT INTO public.saas_memberships (company_id, user_id, role, status)
    VALUES (cid, auth.uid(), 'owner', 'active');
  RETURN cid;
END$function$

CREATE OR REPLACE FUNCTION public.saas_accept_invitation(p_token text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE inv public.saas_invitations;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO inv FROM public.saas_invitations WHERE token = p_token;
  IF inv.id IS NULL THEN RAISE EXCEPTION 'invalid invite'; END IF;
  IF inv.status <> 'pending' OR inv.expires_at <= now() THEN RAISE EXCEPTION 'invite expired'; END IF;
  INSERT INTO public.saas_memberships (company_id, user_id, role, status)
  VALUES (inv.company_id, auth.uid(), inv.role, 'active')
  ON CONFLICT (company_id, user_id) DO UPDATE SET role = EXCLUDED.role, status = 'active';
  UPDATE public.saas_invitations SET status = 'accepted' WHERE id = inv.id;
  RETURN inv.company_id;
END$function$

CREATE OR REPLACE FUNCTION public.saas_invitation_preview(p_token text)
 RETURNS TABLE(company_name text, role text, valid boolean)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT c.name, i.role,
    (i.status = 'pending' AND i.expires_at > now()) AS valid
  FROM public.saas_invitations i JOIN public.saas_companies c ON c.id = i.company_id
  WHERE i.token = p_token
$function$
```

Also present: `saas_handle_new_user()` (auth trigger → saas_profiles),
`saas_touch_updated_at()` (updated_at trigger).

## The status view (timezone semantics live here)

```sql
-- saas_compliance_items_with_status  (security_invoker — riders on the base
-- table's RLS). America/Chicago is the customer's local day, matching
-- lib/saas/status.ts localToday().
SELECT id, company_id, parent_type, parent_id, kind, title, issued_date,
  expiration_date, reminder_days, responsible_person, notes, created_at, updated_at,
  CASE
    WHEN expiration_date IS NULL THEN 'none'
    WHEN expiration_date < (now() AT TIME ZONE 'America/Chicago')::date THEN 'expired'
    WHEN expiration_date <= ((now() AT TIME ZONE 'America/Chicago')::date
         + ((reminder_days || ' days')::interval)) THEN 'expiring'
    ELSE 'valid'
  END AS status
FROM saas_compliance_items ci;
```

## RLS: enabled on all 27 saas_* tables and all 10 rd_* tables

Verified live: every row-security flag is on, including `saas_cron_runs`
(RLS on, zero policies = deny-all for sessions; only the service role writes).

## Policy map — every saas_* policy, live

| Table | SELECT | Writes |
|---|---|---|
| saas_companies | member of company | UPDATE admin · DELETE owner (no INSERT — RPC only) |
| saas_memberships | self or co-member | INSERT/UPDATE/DELETE admin |
| saas_profiles | self | UPDATE self |
| saas_yards, saas_units | member | ALL admin |
| saas_assets, saas_compliance_items, saas_crew_members, saas_customers, saas_item_customers, saas_unit_crew, saas_attachments, saas_readiness_proofs | member | ALL member |
| saas_alert_recipients, saas_notification_settings, saas_enforcement_settings, saas_asset_types | member (types: or global null) | ALL admin |
| **saas_invitations** | admin | **INSERT admin AND role IN ('admin','member')** · UPDATE admin |
| **saas_dispatch_checks / _check_items / _check_crew** | member | **INSERT only — no UPDATE, no DELETE: immutable at the DB** |
| saas_alerts_sent, saas_readiness_snapshots | member (read-only) | none — cron/service-role only |
| saas_events | member | INSERT member |
| **saas_loadout_templates / _items** | member or global seed (company_id null) | **ALL: admin AND company_id NOT NULL — global seeds are read-only for every tenant** |

## Storage (bucket `proofs`, private)

All four commands (SELECT/INSERT/UPDATE/DELETE) require:

```sql
bucket_id = 'proofs'
AND ((storage.foldername(name))[1])::uuid IN (SELECT saas_user_company_ids())
```

i.e. the path's first segment must be one of the caller's company ids —
the browser cannot read or write under another company's prefix.

## Token generation

`saas_readiness_proofs.token` default: `encode(gen_random_bytes(18), 'hex')`
— 144 bits of CSPRNG, 36 hex chars. Not guessable.

## Known legacy (not RollReady's surface)

The dead marketplace-era infra is still present: `workspaces`-tenanted tables
(rd_*, gearvault_*, tallies, …) and a `gearvault` storage bucket whose
policies allow any authenticated user bucket-wide. De-linked from all live
routes; worth deleting in a cleanup pass someday, but it holds no RollReady
customer data.
