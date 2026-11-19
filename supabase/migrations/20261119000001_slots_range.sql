-- =============================================================================
-- All free slots for a service across the whole booking window (today →
-- today + max_days_ahead), in one call. Lets the UI grey out full days so
-- customers never pick a date with no times.
-- =============================================================================

create or replace function public.get_available_slots_range(p_service_id uuid)
returns table (slot_start timestamptz, slot_end timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select s.slot_start, s.slot_end
  from public.booking_settings bs
  cross join lateral generate_series(
    (now() at time zone bs.time_zone)::date,
    (now() at time zone bs.time_zone)::date + bs.max_days_ahead,
    interval '1 day'
  ) as d
  cross join lateral public.get_available_slots(p_service_id, d::date) as s
  where bs.id
  order by s.slot_start;
$$;

revoke execute on function public.get_available_slots_range(uuid) from public;
grant execute on function public.get_available_slots_range(uuid) to anon, authenticated;
