-- =============================================================================
-- Staff roles: barber (runs the shop) and superadmin (maintains the system).
-- Replaces public.admins. Customers still have no account.
--
--   barber      agenda, appointments, services, working hours, time off
--   superadmin  everything above + booking rules, staff, audit log, data purge
--
-- Two-step verification: once a staff member has a verified TOTP factor, their
-- session must be upgraded to AAL2 (code entered) to count as staff at all.
-- =============================================================================

create type public.staff_role as enum ('barber', 'superadmin');

create table public.staff (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  role        public.staff_role not null default 'barber',
  created_at  timestamptz not null default now()
);

insert into public.staff (user_id, role)
select user_id, 'barber' from public.admins
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

-- True unless the user enrolled 2FA and this session hasn't passed it yet.
create or replace function public.mfa_ok()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2'
      or not exists (
        select 1 from auth.mfa_factors f
        where f.user_id = (select auth.uid()) and f.status = 'verified'
      );
$$;

-- Role of the current user, or null (customers / non-staff / 2FA pending).
create or replace function public.my_role()
returns public.staff_role
language sql
stable
security definer
set search_path = ''
as $$
  select s.role from public.staff s
  where s.user_id = (select auth.uid()) and public.mfa_ok();
$$;

-- Kept for existing policies and code: any staff role counts.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.my_role() is not null;
$$;

create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.my_role() = 'superadmin';
$$;

-- Is 2FA enrolled but not yet entered in this session? (UI uses it to redirect.)
create or replace function public.mfa_pending()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.staff where user_id = (select auth.uid()))
     and not public.mfa_ok();
$$;

revoke execute on function public.mfa_ok(), public.my_role(), public.is_superadmin(), public.mfa_pending()
  from public;
grant execute on function public.mfa_ok(), public.my_role(), public.is_superadmin(), public.mfa_pending()
  to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Policies. Rewritten one policy per role+action (fixes the "multiple
-- permissive policies" advisor warning) and booking rules → superadmin only.
-- -----------------------------------------------------------------------------
drop policy "Admins manage booking settings" on public.booking_settings;
drop policy "Admins manage barbers"          on public.barbers;
drop policy "Admins manage services"         on public.services;
drop policy "Admins manage working hours"    on public.working_hours;

create policy "Superadmins update booking settings" on public.booking_settings
  for update to authenticated
  using ((select public.is_superadmin())) with check ((select public.is_superadmin()));

do $$
declare t text;
begin
  foreach t in array array['barbers', 'services', 'working_hours'] loop
    execute format('create policy "Staff insert %1$s" on public.%1$I for insert to authenticated with check ((select public.is_admin()))', t);
    execute format('create policy "Staff update %1$s" on public.%1$I for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))', t);
    execute format('create policy "Staff delete %1$s" on public.%1$I for delete to authenticated using ((select public.is_admin()))', t);
  end loop;
end $$;

-- staff: everyone sees their own row; superadmins see and manage all.
alter table public.staff enable row level security;
grant select, insert, update, delete on public.staff to authenticated;

create policy "Staff read own row or superadmin" on public.staff
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_superadmin()));
create policy "Superadmins insert staff" on public.staff
  for insert to authenticated with check ((select public.is_superadmin()));
create policy "Superadmins update staff" on public.staff
  for update to authenticated
  using ((select public.is_superadmin())) with check ((select public.is_superadmin()));
create policy "Superadmins delete staff" on public.staff
  for delete to authenticated using ((select public.is_superadmin()));

-- Never leave the system without a superadmin.
create or replace function public.staff_keep_superadmin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.staff where role = 'superadmin') then
    raise exception 'LAST_SUPERADMIN';
  end if;
  return null;
end;
$$;

create constraint trigger staff_keep_superadmin
  after update or delete on public.staff
  deferrable initially deferred
  for each row execute function public.staff_keep_superadmin();

-- -----------------------------------------------------------------------------
-- Staff management for the "Sistema" page (superadmin only).
-- Accounts themselves are created in Supabase Auth; here we grant access.
-- -----------------------------------------------------------------------------
create or replace function public.staff_list()
returns table (user_id uuid, email text, role public.staff_role, last_sign_in_at timestamptz, has_2fa boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_superadmin() then
    raise exception 'FORBIDDEN';
  end if;
  return query
  select s.user_id, u.email::text, s.role, u.last_sign_in_at,
         exists (select 1 from auth.mfa_factors f where f.user_id = s.user_id and f.status = 'verified')
  from public.staff s
  join auth.users u on u.id = s.user_id
  order by s.role desc, u.email;
end;
$$;

create or replace function public.staff_grant(p_email text, p_role public.staff_role)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  if not public.is_superadmin() then
    raise exception 'FORBIDDEN';
  end if;
  select id into v_user from auth.users where lower(email) = lower(btrim(p_email));
  if v_user is null then
    raise exception 'USER_NOT_FOUND';
  end if;
  insert into public.staff (user_id, role) values (v_user, p_role)
  on conflict (user_id) do update set role = excluded.role;
end;
$$;

create or replace function public.staff_revoke(p_user_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.is_superadmin() then
    raise exception 'FORBIDDEN';
  end if;
  if p_user_id = (select auth.uid()) then
    raise exception 'CANNOT_REVOKE_SELF';
  end if;
  delete from public.staff where user_id = p_user_id;
end;
$$;

revoke execute on function public.staff_list(), public.staff_grant(text, public.staff_role), public.staff_revoke(uuid)
  from public, anon;
grant execute on function public.staff_list(), public.staff_grant(text, public.staff_role), public.staff_revoke(uuid)
  to authenticated;
revoke execute on function public.staff_keep_superadmin() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Retire public.admins
-- -----------------------------------------------------------------------------
drop policy "Admins read admins" on public.admins;
drop table public.admins;
