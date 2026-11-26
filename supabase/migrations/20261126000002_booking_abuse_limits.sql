-- =============================================================================
-- Stop one person from filling the agenda with made-up phone numbers.
--
-- 1. Per connection (the app sends an HMAC of the client's IP, never the IP):
--    · at most N future appointments at the same time  (default 3)
--    · at most M bookings per hour                      (default 2)
--    Both editable in Panel → Sistema → Reglas.
-- 2. Blocked phones: the barber blocks a number from the panel; that number
--    can no longer book online (it can still be booked by phone/panel).
-- =============================================================================

alter table public.booking_settings
  add column max_active_per_client int not null default 3 check (max_active_per_client >= 1),
  add column max_bookings_per_client_hour int not null default 2 check (max_bookings_per_client_hour >= 1);

-- -----------------------------------------------------------------------------
-- Which connection made each website booking. Kept only while useful: rows
-- are deleted a day after the appointment ends (see book_appointment).
-- -----------------------------------------------------------------------------
create table public.booking_clients (
  appointment_id uuid primary key references public.appointments (id) on delete cascade,
  client_key     text not null,
  created_at     timestamptz not null default now()
);

create index booking_clients_key_idx on public.booking_clients (client_key, created_at);

alter table public.booking_clients enable row level security;
revoke all on public.booking_clients from public, anon, authenticated;
grant all on public.booking_clients to service_role;

-- -----------------------------------------------------------------------------
-- Chilean phone → '+56XXXXXXXXX', or null if it isn't valid. Same rule the
-- booking form has always used.
-- -----------------------------------------------------------------------------
create or replace function public.normalize_cl_phone(p_phone text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when d ~ '^56[2-9][0-9]{8}$' then '+' || d
    when d ~ '^[2-9][0-9]{8}$' then '+56' || d
  end
  from (select regexp_replace(coalesce(p_phone, ''), '\D', '', 'g') as d) x;
$$;

-- -----------------------------------------------------------------------------
-- Blocked phones
-- -----------------------------------------------------------------------------
create table public.blocked_phones (
  phone       text primary key check (phone ~ '^\+56[2-9][0-9]{8}$'),
  reason      text check (char_length(reason) <= 200),
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid() references auth.users (id) on delete set null
);

alter table public.blocked_phones enable row level security;

create policy "Staff read blocked phones" on public.blocked_phones
  for select to authenticated using ((select public.is_admin()));

revoke all on public.blocked_phones from public, anon, authenticated;
grant select on public.blocked_phones to authenticated;
grant all on public.blocked_phones to service_role;

create trigger audit after insert or update or delete on public.blocked_phones
  for each row execute function public.audit_trigger();

-- Block a number (staff). Optionally cancels its future appointments too.
-- Returns how many appointments were cancelled.
create or replace function public.block_phone(
  p_phone         text,
  p_reason        text default null,
  p_cancel_future boolean default false
)
returns int
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_phone     text := public.normalize_cl_phone(p_phone);
  v_cancelled int := 0;
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN';
  end if;
  if v_phone is null then
    raise exception 'INVALID_PHONE';
  end if;

  insert into public.blocked_phones (phone, reason)
  values (v_phone, nullif(btrim(left(p_reason, 200)), ''))
  on conflict (phone) do update set reason = coalesce(excluded.reason, public.blocked_phones.reason);

  if p_cancel_future then
    update public.appointments
    set status = 'cancelled', cancelled_at = now()
    where customer_phone = v_phone
      and status in ('pending', 'confirmed')
      and starts_at > now();
    get diagnostics v_cancelled = row_count;
  end if;

  return v_cancelled;
end;
$$;

create or replace function public.unblock_phone(p_phone text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN';
  end if;
  delete from public.blocked_phones where phone = public.normalize_cl_phone(p_phone);
end;
$$;

revoke execute on function public.block_phone(text, text, boolean), public.unblock_phone(text)
  from public, anon;
grant execute on function public.block_phone(text, text, boolean), public.unblock_phone(text)
  to authenticated;

-- -----------------------------------------------------------------------------
-- book_appointment: same rules as before, plus blocked phones and the
-- per-connection limits. New optional last parameter p_client_key.
-- -----------------------------------------------------------------------------
drop function public.book_appointment(uuid, timestamptz, text, text, text);

create function public.book_appointment(
  p_service_id     uuid,
  p_starts_at      timestamptz,
  p_customer_name  text,
  p_customer_phone text,
  p_honeypot       text default null, -- hidden form field; bots fill it in
  p_client_key     text default null  -- HMAC of the client's IP (null = unknown)
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
  v_phone     text := public.normalize_cl_phone(p_customer_phone);
  v_client    text := nullif(btrim(coalesce(p_client_key, '')), '');
  v_active    int;
  v_appt      public.appointments;
begin
  if coalesce(p_honeypot, '') <> '' then
    raise exception 'INVALID_REQUEST';
  end if;

  if char_length(v_name) not between 2 and 80 then
    raise exception 'INVALID_NAME';
  end if;

  if v_phone is null then
    raise exception 'INVALID_PHONE';
  end if;

  if exists (select 1 from public.blocked_phones b where b.phone = v_phone) then
    raise exception 'PHONE_BLOCKED';
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

  -- Per connection: future appointments and bookings in the last hour.
  if v_client is not null then
    perform pg_advisory_xact_lock(hashtext('booking-client:' || v_client));

    delete from public.booking_clients bc
    using public.appointments a
    where a.id = bc.appointment_id
      and a.ends_at < now() - interval '1 day'
      and bc.created_at < now() - interval '1 day';

    select count(*) into v_active
    from public.booking_clients bc
    join public.appointments a on a.id = bc.appointment_id
    where bc.client_key = v_client
      and a.status in ('pending', 'confirmed')
      and a.ends_at > now();

    if v_active >= v_settings.max_active_per_client then
      raise exception 'CLIENT_LIMIT';
    end if;

    -- Counts cancelled bookings too: booking and cancelling over and over
    -- shouldn't get around it.
    select count(*) into v_active
    from public.booking_clients bc
    where bc.client_key = v_client
      and bc.created_at > now() - interval '1 hour';

    if v_active >= v_settings.max_bookings_per_client_hour then
      raise exception 'CLIENT_HOURLY_LIMIT';
    end if;
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

  if v_client is not null then
    insert into public.booking_clients (appointment_id, client_key) values (v_appt.id, v_client);
  end if;

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

-- Server only, as before (the Server Action applies the per-IP rate limit first).
revoke execute on function public.book_appointment(uuid, timestamptz, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.book_appointment(uuid, timestamptz, text, text, text, text)
  to service_role;
