-- 0008: The pencil-whip flag.
--
-- First real field feedback (Collide, 2026-08-21): "I was able to just
-- change the date and make it compliant again without having to upload or
-- show proof." He's right. From now on a date changed with NO new proof
-- photo marks the item renewed_without_proof — it wears an amber flag until
-- a proof lands. Initial creation and binder imports are NOT flagged (a
-- fresh binder load has no photos yet and that's expected); only CHANGING
-- an existing date proof-less is the suspicious act.

alter table public.saas_compliance_items
  add column if not exists renewed_without_proof boolean not null default false;

-- Recreate the status view to carry the new column (views don't inherit).
create or replace view public.saas_compliance_items_with_status
with (security_invoker = true) as
SELECT id, company_id, parent_type, parent_id, kind, title, issued_date,
  expiration_date, reminder_days, responsible_person, notes, created_at, updated_at,
  CASE
    WHEN expiration_date IS NULL THEN 'none'
    WHEN expiration_date < (now() AT TIME ZONE 'America/Chicago')::date THEN 'expired'
    WHEN expiration_date <= ((now() AT TIME ZONE 'America/Chicago')::date
         + ((reminder_days || ' days')::interval)) THEN 'expiring'
    ELSE 'valid'
  END AS status,
  renewed_without_proof
FROM saas_compliance_items ci;
