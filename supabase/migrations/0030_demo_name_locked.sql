-- A demo yard's name is made up and shows on public proof links. Anyone can
-- open a demo, so its name stays the demo's: a signed-in session can't
-- rename it to look like a real company.
create or replace function public.saas_companies_demo_name_guard()
returns trigger language plpgsql security definer set search_path to 'public'
as $function$
begin
  if auth.uid() is null then return new; end if;
  if old.is_demo and new.name is distinct from old.name then
    raise exception 'The demo yard''s name can''t be changed.' using errcode = '42501';
  end if;
  return new;
end $function$;

drop trigger if exists saas_companies_demo_name_guard on public.saas_companies;
create trigger saas_companies_demo_name_guard
  before update of name on public.saas_companies
  for each row execute function public.saas_companies_demo_name_guard();
