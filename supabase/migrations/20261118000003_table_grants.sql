-- =============================================================================
-- Explicit table privileges.
-- Newer Supabase projects don't auto-grant tables to the API roles, so grant
-- exactly what each role needs. RLS policies still decide which ROWS they see.
-- =============================================================================

grant usage on schema public to anon, authenticated;

-- Public catalogue (anon = customers booking without an account).
grant select on public.booking_settings, public.barbers, public.services, public.working_hours
  to anon;

-- Signed-in users: RLS only lets admins through (see is_admin()).
grant select, insert, update, delete on
  public.booking_settings, public.barbers, public.services,
  public.working_hours, public.time_off, public.appointments
  to authenticated;

grant select on public.admins to authenticated;
