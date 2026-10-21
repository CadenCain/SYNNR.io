-- 0016 Yards are made for the shop the moment it pays.
--
-- Onboarding asks for the number of yards and (optionally) the first yard's
-- name or city. After payment the app makes that many yards: the first one
-- named what they typed, the rest "Yard 2", "Yard 3", and so on. Both the
-- success page and the Stripe webhook can do it, possibly at the same time,
-- so a company can't have two yards with the same name: the second insert
-- of "Yard 2" is simply skipped.

alter table public.saas_companies add column if not exists first_yard_name text
  check (first_yard_name is null or char_length(first_yard_name) <= 80);

create unique index if not exists saas_yards_company_name_key on public.saas_yards (company_id, name);
