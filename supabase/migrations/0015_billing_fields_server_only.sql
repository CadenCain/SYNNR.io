-- 0015 Billing fields change only through billing (a second lock).
--
-- Column grants already limit a signed-in session to updating a company's
-- name and NPT day rate, so a browser can't set its own subscription_status,
-- comped, or yard_quantity today. This trigger says the same thing in a way
-- that survives a future GRANT: those fields change only from the server
-- (Stripe checkout, the webhook, the billing actions), which runs without a
-- user.

create or replace function public.saas_companies_billing_guard()
returns trigger language plpgsql security definer set search_path = public as $$
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
     or new.subscribed_at is distinct from old.subscribed_at then
    raise exception 'Billing changes go through Settings, Billing.' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists saas_companies_billing_guard on public.saas_companies;
create trigger saas_companies_billing_guard before update on public.saas_companies
  for each row execute function public.saas_companies_billing_guard();
