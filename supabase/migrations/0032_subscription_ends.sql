-- When a canceled subscription stops (Stripe keeps it running to the end of
-- the paid month). Billing shows "Active, ends <date>" instead of a plain
-- "Active" after the owner cancels. Written only by the Stripe webhook and
-- the checkout sync, never by a session (the billing guard covers it).
alter table public.saas_companies add column if not exists cancel_at timestamptz;

create or replace function public.saas_companies_billing_guard()
returns trigger language plpgsql security definer set search_path to 'public'
as $function$
begin
  if auth.uid() is null then return new; end if;
  if new.subscription_status is distinct from old.subscription_status
     or new.comped is distinct from old.comped
     or new.is_demo is distinct from old.is_demo
     or new.yard_quantity is distinct from old.yard_quantity
     or new.stripe_customer_id is distinct from old.stripe_customer_id
     or new.stripe_subscription_id is distinct from old.stripe_subscription_id
     or new.plan is distinct from old.plan
     or new.trial_ends_at is distinct from old.trial_ends_at
     or new.referred_by is distinct from old.referred_by
     or new.subscribed_at is distinct from old.subscribed_at
     or new.cancel_at is distinct from old.cancel_at then
    raise exception 'Billing changes go through Settings, Billing.' using errcode = '42501';
  end if;
  return new;
end $function$;
