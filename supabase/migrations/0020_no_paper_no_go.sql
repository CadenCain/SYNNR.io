-- No paper, no go (2026-10-21). A test only counts as good with its cert
-- attached: a photo or scan of the paper the server read and matched
-- (last_upload_id). A date typed in from the binder or a spreadsheet, with no
-- paper behind it, reads 'no_paper' and is treated like a test with no date:
-- the iron can't go out, and neither can a truck whose own paper (DOT and
-- the like) is missing. Every yard, always. The operator gets to see the
-- paper behind every piece on the proof link.

create or replace view public.saas_compliance_items_with_status
with (security_invoker = true) as
SELECT id, company_id, parent_type, parent_id, kind, title, issued_date,
  expiration_date, reminder_days, responsible_person, notes, created_at, updated_at,
  CASE
    WHEN expiration_date IS NULL THEN 'none'
    WHEN expiration_date < (now() AT TIME ZONE 'America/Chicago')::date THEN 'expired'
    WHEN last_upload_id IS NULL THEN 'no_paper'
    WHEN expiration_date <= ((now() AT TIME ZONE 'America/Chicago')::date
         + ((reminder_days || ' days')::interval)) THEN 'expiring'
    ELSE 'valid'
  END AS status,
  renewed_without_proof,
  pending_until,
  waiting_upload_id,
  last_upload_id,
  typed_expiration
FROM saas_compliance_items ci;
