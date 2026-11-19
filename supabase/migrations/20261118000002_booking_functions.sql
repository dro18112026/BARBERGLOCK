-- =============================================================================
-- BARBERGLOCK — public booking API (RPC functions)
--
-- The public never touches public.appointments directly (RLS blocks it).
-- Instead it calls these SECURITY DEFINER functions, which apply every
-- business rule and expose no other customer's data:
--
--   get_available_slots(service, date) → free start times
--   book_appointment(...)              → creates the appointment
--   get_appointment(token)             → customer's own appointment
--   cancel_appointment(token)          → customer cancels it
--
-- Errors are raised with machine-readable messages (e.g. 'SLOT_UNAVAILABLE')
-- that the frontend maps to Spanish text.
-- =============================================================================

-- V1 has a single barber: the oldest active one.
create or replace function public.default_barber_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select b.id from public.barbers b
  where b.active
  order by b.created_at, b.id
  limit 1;
$$;

-- -----------------------------------------------------------------------------
-- Free start times for a service on a local date (barbershop time zone).
-- A slot is offered when the whole service fits inside a working-hours block,
-- respects the minimum lead time and booking window, and overlaps neither a
-- live appointment nor time off.
-- -----------------------------------------------------------------------------
create or replace function public.get_available_slots(
  p_service_id uuid,
  p_date       date
)
returns table (slot_start timestamptz, slot_end timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_settings  public.booking_settings;
  v_duration  interval;
  v_step      interval;
  v_barber_id uuid;
  v_today     date;
begin
  select * into v_settings from public.booking_settings where id;

  select make_interval(mins => s.duration_min) into v_duration
  from public.services s
  where s.id = p_service_id and s.active;

  v_barber_id := public.default_barber_id();

  if v_duration is null or v_barber_id is null then
    return;
  end if;

  v_step  := make_interval(mins => v_settings.slot_step_min);
  v_today := (now() at time zone v_settings.time_zone)::date;

  if p_date < v_today or p_date > v_today + v_settings.max_days_ahead then
    return;
  end if;

  return query
  with candidates as (
    select gs as c_start, gs + v_duration as c_end
    from public.working_hours wh
    cross join lateral generate_series(
      ((p_date + wh.start_time) at time zone v_settings.time_zone),
      ((p_date + wh.end_time)   at time zone v_settings.time_zone) - v_duration,
      v_step
    ) as gs
    where wh.barber_id = v_barber_id
      and wh.weekday = extract(dow from p_date)
  )
  select distinct c.c_start, c.c_end
  from candidates c
  where c.c_start >= now() + make_interval(mins => v_settings.min_lead_min)
    and not exists (
      select 1 from public.appointments a
      where a.barber_id = v_barber_id
        and a.status not in ('cancelled', 'no_show')
        and tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(c.c_start, c.c_end, '[)')
    )
    and not exists (
      select 1 from public.time_off t
      where t.barber_id = v_barber_id
        and tstzrange(t.starts_at, t.ends_at, '[)') && tstzrange(c.c_start, c.c_end, '[)')
    )
  order by c.c_start;
end;
$$;

-- -----------------------------------------------------------------------------
-- Create an appointment. Re-checks availability, then inserts. If two people
-- race for the same slot, the exclusion constraint rejects the second one.
-- -----------------------------------------------------------------------------
create or replace function public.book_appointment(
  p_service_id     uuid,
  p_starts_at      timestamptz,
  p_customer_name  text,
  p_customer_phone text,
  p_honeypot       text default null -- hidden form field; bots fill it in
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_settings  public.booking_settings;
  v_service   public.services;
  v_barber_id uuid;
  v_name      text := btrim(regexp_replace(coalesce(p_customer_name, ''), '\s+', ' ', 'g'));
  v_digits    text := regexp_replace(coalesce(p_customer_phone, ''), '\D', '', 'g');
  v_phone     text;
  v_active    int;
  v_appt      public.appointments;
begin
  if coalesce(p_honeypot, '') <> '' then
    raise exception 'INVALID_REQUEST';
  end if;

  if char_length(v_name) not between 2 and 80 then
    raise exception 'INVALID_NAME';
  end if;

  -- Chilean numbers: 9 digits (mobile 9XXXXXXXX or landline), optional 56 prefix.
  if v_digits ~ '^56[2-9][0-9]{8}$' then
    v_phone := '+' || v_digits;
  elsif v_digits ~ '^[2-9][0-9]{8}$' then
    v_phone := '+56' || v_digits;
  else
    raise exception 'INVALID_PHONE';
  end if;

  select * into v_settings from public.booking_settings where id;

  select * into v_service from public.services s where s.id = p_service_id and s.active;
  if not found then
    raise exception 'SERVICE_NOT_FOUND';
  end if;

  v_barber_id := public.default_barber_id();
  if v_barber_id is null then
    raise exception 'NO_BARBER';
  end if;

  -- Same rules as the slot list: working hours, lead time, window, conflicts.
  if not exists (
    select 1
    from public.get_available_slots(
      p_service_id, (p_starts_at at time zone v_settings.time_zone)::date
    ) s
    where s.slot_start = p_starts_at
  ) then
    raise exception 'SLOT_UNAVAILABLE';
  end if;

  -- Serialise bookings per phone so the limit below can't be raced.
  perform pg_advisory_xact_lock(hashtext('booking-phone:' || v_phone));

  select count(*) into v_active
  from public.appointments a
  where a.customer_phone = v_phone
    and a.status in ('pending', 'confirmed')
    and a.ends_at > now();

  if v_active >= v_settings.max_active_per_phone then
    raise exception 'PHONE_LIMIT';
  end if;

  begin
    insert into public.appointments (
      barber_id, service_id, customer_name, customer_phone, starts_at, ends_at
    ) values (
      v_barber_id, v_service.id, v_name, v_phone,
      p_starts_at, p_starts_at + make_interval(mins => v_service.duration_min)
    )
    returning * into v_appt;
  exception
    when exclusion_violation then
      raise exception 'SLOT_UNAVAILABLE';
  end;

  return jsonb_build_object(
    'id',            v_appt.id,
    'cancel_token',  v_appt.cancel_token,
    'starts_at',     v_appt.starts_at,
    'ends_at',       v_appt.ends_at,
    'status',        v_appt.status,
    'customer_name', v_appt.customer_name,
    'service_name',  v_service.name,
    'price_clp',     v_service.price_clp
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- The customer's own appointment, looked up by the secret token in their link.
-- Returns null when the token doesn't exist.
-- -----------------------------------------------------------------------------
create or replace function public.get_appointment(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'starts_at',     a.starts_at,
    'ends_at',       a.ends_at,
    'status',        a.status,
    'customer_name', a.customer_name,
    'service_name',  s.name,
    'price_clp',     s.price_clp,
    'can_cancel',    a.status in ('pending', 'confirmed')
                     and a.starts_at - now() >= make_interval(mins => bs.cancel_min_lead_min)
  )
  from public.appointments a
  join public.services s on s.id = a.service_id
  cross join public.booking_settings bs
  where a.cancel_token = p_token and bs.id;
$$;

-- -----------------------------------------------------------------------------
-- Customer cancels their own appointment (up to cancel_min_lead_min before).
-- -----------------------------------------------------------------------------
create or replace function public.cancel_appointment(p_token uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_settings public.booking_settings;
  v_appt     public.appointments;
begin
  select * into v_settings from public.booking_settings where id;

  select * into v_appt
  from public.appointments a
  where a.cancel_token = p_token
  for update;

  if not found then
    raise exception 'NOT_FOUND';
  end if;

  if v_appt.status not in ('pending', 'confirmed') then
    raise exception 'NOT_CANCELLABLE';
  end if;

  if v_appt.starts_at - now() < make_interval(mins => v_settings.cancel_min_lead_min) then
    raise exception 'TOO_LATE';
  end if;

  update public.appointments
  set status = 'cancelled', cancelled_at = now()
  where id = v_appt.id;

  return public.get_appointment(p_token);
end;
$$;

-- -----------------------------------------------------------------------------
-- Permissions: functions are executable by PUBLIC by default, and Supabase also
-- grants anon/authenticated via default privileges. Lock that down explicitly.
-- -----------------------------------------------------------------------------
revoke execute on function public.default_barber_id()                                  from public, anon, authenticated;
revoke execute on function public.get_available_slots(uuid, date)                       from public;
revoke execute on function public.book_appointment(uuid, timestamptz, text, text, text) from public;
revoke execute on function public.get_appointment(uuid)                                 from public;
revoke execute on function public.cancel_appointment(uuid)                              from public;

grant execute on function public.get_available_slots(uuid, date)                       to anon, authenticated;
grant execute on function public.book_appointment(uuid, timestamptz, text, text, text) to anon, authenticated;
grant execute on function public.get_appointment(uuid)                                 to anon, authenticated;
grant execute on function public.cancel_appointment(uuid)                              to anon, authenticated;
