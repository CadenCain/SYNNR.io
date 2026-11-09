-- A locked load-out record points at the cert photo each piece went out on.
-- Deleting the test later (or the piece, or the truck) cascaded the upload
-- row away, and the operator's link lost "See the cert". Now the upload row
-- and its photo stay; it just isn't tied to a test anymore. An upload still
-- waiting on a manager when its test is deleted has nothing left to apply to.

alter table public.saas_cert_uploads alter column item_id drop not null;
alter table public.saas_cert_uploads drop constraint if exists saas_cert_uploads_item_id_fkey;
alter table public.saas_cert_uploads
  add constraint saas_cert_uploads_item_id_fkey
  foreign key (item_id) references public.saas_compliance_items(id) on delete set null;

create or replace function public.saas_cert_uploads_orphaned()
returns trigger language plpgsql security definer set search_path to 'public'
as $function$
begin
  if new.item_id is null and old.item_id is not null and new.status = 'waiting' then
    new.status := 'superseded';
  end if;
  return new;
end $function$;

drop trigger if exists saas_cert_uploads_orphaned on public.saas_cert_uploads;
create trigger saas_cert_uploads_orphaned
  before update of item_id on public.saas_cert_uploads
  for each row execute function public.saas_cert_uploads_orphaned();
