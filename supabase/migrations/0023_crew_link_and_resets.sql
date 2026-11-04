-- Getting a crew on, and back in (2026-11-04).
--
-- 1. One crew link: a manager texts one link to the crew, and every hand who
--    taps it makes their own login and joins as a hand. It stays good until
--    it expires or a manager turns it off (multi_use; uses counts joins).
--    Personal invites stay single-use.
-- 2. Joining never lowers anyone: a manager who taps the crew link stays a
--    manager. Someone a manager took off the crew can't rejoin with the crew
--    link; it takes a personal invite.
-- 3. Password reset emails go out from the app, so a cap per email address
--    keeps the reset form from being used to flood someone's inbox.

alter table saas_invitations add column if not exists multi_use boolean not null default false;
alter table saas_invitations add column if not exists uses integer not null default 0;

create or replace function public.saas_accept_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  inv public.saas_invitations;
  cur public.saas_memberships;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into inv from public.saas_invitations where token = p_token;
  if inv.id is null then raise exception 'invalid invite'; end if;
  if inv.status <> 'pending' or inv.expires_at <= now() then raise exception 'invite expired'; end if;

  select * into cur from public.saas_memberships where company_id = inv.company_id and user_id = auth.uid();
  if inv.multi_use and cur.id is not null and cur.status = 'removed' then
    raise exception 'removed from this crew';
  end if;

  insert into public.saas_memberships (company_id, user_id, role, status)
  values (inv.company_id, auth.uid(), inv.role, 'active')
  on conflict (company_id, user_id) do update
    set status = 'active',
        role = case
          when saas_memberships.status = 'active' and saas_memberships.role in ('owner', 'admin') then saas_memberships.role
          else excluded.role end;

  if inv.multi_use then
    update public.saas_invitations set uses = uses + 1 where id = inv.id;
  else
    update public.saas_invitations set status = 'accepted', uses = uses + 1 where id = inv.id;
  end if;
  return inv.company_id;
end
$function$;

create table if not exists saas_reset_requests (
  id bigint generated always as identity primary key,
  email_hash text not null,
  created_at timestamptz not null default now()
);
create index if not exists saas_reset_requests_recent on saas_reset_requests (email_hash, created_at desc);
-- Server only: no policies, so sessions can't read or write it.
alter table saas_reset_requests enable row level security;

-- 4. Who's on the crew only changes through the server or these functions,
--    never straight from a session. (Found 2026-11-04: a manager could delete
--    the owner's membership, or add anyone as an owner.) An invite can only
--    ever be for a hand or a manager, so editing one can't make an owner.
revoke insert, update, delete, truncate on saas_memberships from anon, authenticated;
drop policy if exists saas_memberships_admin_insert on saas_memberships;
drop policy if exists saas_memberships_admin_update on saas_memberships;
drop policy if exists saas_memberships_admin_delete on saas_memberships;
alter table saas_invitations drop constraint if exists saas_invitations_role_check;
alter table saas_invitations add constraint saas_invitations_role_check check (role in ('admin', 'member'));
revoke delete, truncate on saas_invitations from anon, authenticated;
revoke all on saas_reset_requests from anon, authenticated;
