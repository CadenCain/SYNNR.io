-- 0014 What a new shop tells us before it pays.
--
-- Onboarding asks for the company, a contact (name, email, phone), how many
-- yards, and optionally how they heard about RollReady and any notes. The
-- yard count sets the Stripe quantity at checkout ($500 x yards a month);
-- yard_quantity stays the number Stripe is actually billing.

alter table public.saas_companies add column if not exists contact_name text;
alter table public.saas_companies add column if not exists contact_email text;
alter table public.saas_companies add column if not exists contact_phone text;
alter table public.saas_companies add column if not exists requested_yards integer
  check (requested_yards is null or requested_yards between 1 and 50);
alter table public.saas_companies add column if not exists heard_about text;
alter table public.saas_companies add column if not exists signup_notes text;
alter table public.saas_companies add column if not exists subscribed_at timestamptz;
