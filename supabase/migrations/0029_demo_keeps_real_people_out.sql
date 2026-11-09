-- A demo yard is made up and deletes itself (and its throwaway logins) after
-- 24 hours. A real person must never end up on one: if they did, the
-- cleanup would take their login with it. So a demo company's invites read
-- as not valid, and the database refuses a real login on a demo company.

create or replace function public.saas_invitation_preview(p_token text)
returns table(company_name text, role text, valid boolean)
language sql stable security definer set search_path to 'public'
as $function$
  select c.name, i.role,
    (i.status = 'pending' and i.expires_at > now() and not coalesce(c.is_demo, false)) as valid
  from public.saas_invitations i join public.saas_companies c on c.id = i.company_id
  where i.token = p_token
$function$;

create or replace function public.saas_memberships_demo_guard()
returns trigger language plpgsql security definer set search_path to 'public'
as $function$
declare
  demo boolean;
  u record;
begin
  select coalesce(is_demo, false) into demo from public.saas_companies where id = new.company_id;
  if not demo then return new; end if;
  select email, raw_user_meta_data into u from auth.users where id = new.user_id;
  if coalesce(lower(u.email), '') like '%@demo.synnr.io'
     or coalesce(u.raw_user_meta_data ->> 'is_demo', '') = 'true' then
    return new;
  end if;
  raise exception 'A demo yard can''t add a real login. Ask for your real company''s crew link.';
end
$function$;

drop trigger if exists saas_memberships_demo_guard on public.saas_memberships;
create trigger saas_memberships_demo_guard
  before insert or update of company_id, user_id on public.saas_memberships
  for each row execute function public.saas_memberships_demo_guard();
