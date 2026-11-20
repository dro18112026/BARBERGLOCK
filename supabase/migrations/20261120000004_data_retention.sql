-- =============================================================================
-- Data retention (privacy page promise + Chile's Ley 21.719):
-- 12 months after an appointment, the customer's name and phone are removed.
-- Audit entries older than that are deleted too (they can contain them).
-- Appointments themselves stay (anonymised) so statistics keep working.
-- =============================================================================

create or replace function public.purge_personal_data(p_months int default 12)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_cutoff       timestamptz;
  v_appointments int;
  v_audit        int;
begin
  -- Signed-in users must be superadmins. Scheduled jobs / SQL editor run with
  -- no user (anon can't call this function at all, see grants below).
  if (select auth.uid()) is not null and not public.is_superadmin() then
    raise exception 'FORBIDDEN';
  end if;
  if p_months is null or p_months < 1 then
    raise exception 'INVALID_MONTHS';
  end if;

  v_cutoff := now() - make_interval(months => p_months);

  perform set_config('app.skip_audit', 'on', true);

  update public.appointments
  set customer_name = 'Anónimo', customer_phone = '+56900000000', notes = null
  where ends_at < v_cutoff
    and (customer_name <> 'Anónimo' or customer_phone <> '+56900000000' or notes is not null);
  get diagnostics v_appointments = row_count;

  delete from public.audit_log where at < v_cutoff;
  get diagnostics v_audit = row_count;

  perform set_config('app.skip_audit', 'off', true);

  insert into public.audit_log (actor_id, actor_role, action, table_name, new_data)
  values (
    (select auth.uid()), public.current_actor_role(), 'PURGE', 'appointments',
    jsonb_build_object('months', p_months, 'appointments', v_appointments, 'audit_entries', v_audit)
  );

  return jsonb_build_object('appointments', v_appointments, 'audit_entries', v_audit);
end;
$$;

revoke execute on function public.purge_personal_data(int) from public, anon;
grant execute on function public.purge_personal_data(int) to authenticated;

-- Run it every day at 07:15 UTC (04:15 in Chile Chico) when pg_cron exists
-- (it does on Supabase; local test databases skip this).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule(
      'purge-personal-data',
      '15 7 * * *',
      'select public.purge_personal_data(12)'
    );
  end if;
end $$;
