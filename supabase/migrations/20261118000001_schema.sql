-- =============================================================================
-- BARBERGLOCK — core schema
-- Tables, anti double-booking constraint, admin role and Row Level Security.
-- =============================================================================

-- btree_gist lets a GiST exclusion constraint mix "=" on uuid with "&&" on ranges.
create extension if not exists btree_gist with schema extensions;

-- -----------------------------------------------------------------------------
-- Booking settings (one row per project = per barbershop)
-- -----------------------------------------------------------------------------
create table public.booking_settings (
  id                    boolean primary key default true check (id), -- singleton
  time_zone             text    not null default 'America/Coyhaique',
  slot_step_min         int     not null default 30  check (slot_step_min between 5 and 240),
  min_lead_min          int     not null default 60  check (min_lead_min >= 0),
  max_days_ahead        int     not null default 14  check (max_days_ahead between 1 and 365),
  max_active_per_phone  int     not null default 2   check (max_active_per_phone >= 1),
  cancel_min_lead_min   int     not null default 60  check (cancel_min_lead_min >= 0)
);

comment on table public.booking_settings is
  'Booking rules for this barbershop. Singleton row (id = true).';

insert into public.booking_settings (id) values (true);

-- America/Coyhaique only exists in tzdata 2025b+. On an older Postgres build
-- fall back to America/Punta_Arenas: same rule (UTC-3 all year, no DST).
update public.booking_settings
set time_zone = 'America/Punta_Arenas'
where not exists (select 1 from pg_timezone_names where name = 'America/Coyhaique');

-- -----------------------------------------------------------------------------
-- Barbers
-- -----------------------------------------------------------------------------
create table public.barbers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 80),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Services
-- -----------------------------------------------------------------------------
create table public.services (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (char_length(name) between 1 and 80),
  description   text check (char_length(description) <= 300),
  duration_min  int  not null check (duration_min between 5 and 480),
  price_clp     int  not null check (price_clp >= 0),
  active        boolean not null default true,
  sort_order    int  not null default 0,
  created_at    timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Regular weekly working hours. Several rows per weekday are allowed, which is
-- how breaks are modelled (e.g. 10:00–14:00 and 14:30–19:00).
-- -----------------------------------------------------------------------------
create table public.working_hours (
  id          uuid primary key default gen_random_uuid(),
  barber_id   uuid not null references public.barbers (id) on delete cascade,
  weekday     smallint not null check (weekday between 0 and 6), -- 0 = Sunday
  start_time  time not null,
  end_time    time not null,
  check (start_time < end_time)
);

create index working_hours_barber_weekday_idx
  on public.working_hours (barber_id, weekday);

-- -----------------------------------------------------------------------------
-- Time off: holidays, vacations, one-off unavailable hours.
-- A full day off is simply 00:00 → 00:00 next day.
-- -----------------------------------------------------------------------------
create table public.time_off (
  id          uuid primary key default gen_random_uuid(),
  barber_id   uuid not null references public.barbers (id) on delete cascade,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  reason      text check (char_length(reason) <= 200),
  created_at  timestamptz not null default now(),
  check (starts_at < ends_at)
);

create index time_off_barber_range_idx
  on public.time_off using gist (barber_id, tstzrange(starts_at, ends_at));

-- -----------------------------------------------------------------------------
-- Appointments
-- -----------------------------------------------------------------------------
create type public.appointment_status as enum (
  'pending', 'confirmed', 'cancelled', 'completed', 'no_show'
);

create table public.appointments (
  id              uuid primary key default gen_random_uuid(),
  barber_id       uuid not null references public.barbers (id) on delete restrict,
  service_id      uuid not null references public.services (id) on delete restrict,
  customer_name   text not null check (char_length(customer_name) between 2 and 80),
  -- Normalised by book_appointment() to +56XXXXXXXXX.
  customer_phone  text not null check (customer_phone ~ '^\+[0-9]{8,15}$'),
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  status          public.appointment_status not null default 'confirmed',
  -- Secret token in the customer's link (/cita/<token>) to view or cancel.
  cancel_token    uuid not null unique default gen_random_uuid(),
  notes           text check (char_length(notes) <= 500),
  created_at      timestamptz not null default now(),
  cancelled_at    timestamptz,
  check (starts_at < ends_at),

  -- ANTI DOUBLE-BOOKING: no two live appointments of the same barber may
  -- overlap in time, whatever their durations. Enforced by Postgres itself,
  -- so it also holds under concurrent bookings.
  constraint appointments_no_overlap exclude using gist (
    barber_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status not in ('cancelled', 'no_show'))
);

create index appointments_barber_starts_idx on public.appointments (barber_id, starts_at);
create index appointments_phone_idx on public.appointments (customer_phone, starts_at);

-- -----------------------------------------------------------------------------
-- Admins: which auth users may use the admin panel.
-- Being "authenticated" is NOT enough; the user must be listed here.
-- -----------------------------------------------------------------------------
create table public.admins (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admins where user_id = (select auth.uid())
  );
$$;

-- Anon needs it too: the public read policies call it (it returns false for anon).
revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- Public (anon) can only read the catalogue. Everything about appointments goes
-- through the security-definer functions in the next migration.
-- -----------------------------------------------------------------------------
alter table public.booking_settings enable row level security;
alter table public.barbers          enable row level security;
alter table public.services         enable row level security;
alter table public.working_hours    enable row level security;
alter table public.time_off         enable row level security;
alter table public.appointments     enable row level security;
alter table public.admins           enable row level security;

-- Catalogue: readable by everyone (active rows only for non-admins).
create policy "Public reads booking settings" on public.booking_settings
  for select to anon, authenticated using (true);

create policy "Public reads active barbers" on public.barbers
  for select to anon, authenticated using (active or (select public.is_admin()));

create policy "Public reads active services" on public.services
  for select to anon, authenticated using (active or (select public.is_admin()));

create policy "Public reads working hours" on public.working_hours
  for select to anon, authenticated using (true);

-- Admin: full access.
create policy "Admins manage booking settings" on public.booking_settings
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "Admins manage barbers" on public.barbers
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "Admins manage services" on public.services
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "Admins manage working hours" on public.working_hours
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "Admins manage time off" on public.time_off
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "Admins manage appointments" on public.appointments
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "Admins read admins" on public.admins
  for select to authenticated using ((select public.is_admin()));
