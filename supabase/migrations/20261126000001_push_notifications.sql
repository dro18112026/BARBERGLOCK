-- =============================================================================
-- Push notifications to the panel (Web Push):
--   · new booking / cancellation made by a customer on the website
--   · reminder ~30 minutes before each appointment
--
-- Each staff member turns them on per device in Panel → Mi cuenta. The app
-- server sends the pushes (it holds the VAPID keys); the database stores the
-- subscriptions and, every 5 minutes, asks the server to send due reminders.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Devices subscribed to notifications (one row per browser/app install).
-- Written only through push_subscribe / push_unsubscribe below.
-- -----------------------------------------------------------------------------
create table public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  endpoint    text not null unique check (endpoint like 'https://%'),
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

create policy "Staff read own push devices" on public.push_subscriptions
  for select to authenticated
  using (user_id = (select auth.uid()) and (select public.is_admin()));

revoke all on public.push_subscriptions from public, anon, authenticated;
grant select on public.push_subscriptions to authenticated;
grant all on public.push_subscriptions to service_role;

-- Register this device for the signed-in staff member. Upsert by endpoint: if
-- the same phone is later used with another account, it moves to that account.
create or replace function public.push_subscribe(
  p_endpoint   text,
  p_p256dh     text,
  p_auth       text,
  p_user_agent text default null
)
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
  if p_endpoint is null or p_endpoint not like 'https://%' or length(p_endpoint) > 1000
     or coalesce(p_p256dh, '') = '' or coalesce(p_auth, '') = '' then
    raise exception 'INVALID_SUBSCRIPTION';
  end if;

  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values ((select auth.uid()), p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update
    set user_id = excluded.user_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        user_agent = excluded.user_agent;
end;
$$;

create or replace function public.push_unsubscribe(p_endpoint text)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  delete from public.push_subscriptions
  where endpoint = p_endpoint and user_id = (select auth.uid());
$$;

revoke execute on function public.push_subscribe(text, text, text, text), public.push_unsubscribe(text)
  from public, anon;
grant execute on function public.push_subscribe(text, text, text, text), public.push_unsubscribe(text)
  to authenticated;

-- -----------------------------------------------------------------------------
-- Reminders already sent. Remembers the start time it was sent for, so a
-- rescheduled appointment gets a new reminder.
-- -----------------------------------------------------------------------------
create table public.push_reminders (
  appointment_id uuid primary key references public.appointments (id) on delete cascade,
  starts_at      timestamptz not null,
  sent_at        timestamptz not null default now()
);

alter table public.push_reminders enable row level security;
revoke all on public.push_reminders from public, anon, authenticated;
grant all on public.push_reminders to service_role;

-- Appointments starting within p_minutes that haven't been reminded yet.
-- Marks them as reminded in the same statement, so two overlapping runs never
-- send the same reminder twice. Server only (service role).
create or replace function public.claim_push_reminders(p_minutes int default 30)
returns table (
  appointment_id uuid,
  starts_at      timestamptz,
  customer_name  text,
  service_name   text
)
language sql
volatile
security definer
set search_path = ''
as $$
  with due as (
    select a.id, a.starts_at
    from public.appointments a
    where a.status in ('pending', 'confirmed')
      and a.starts_at > now()
      and a.starts_at <= now() + make_interval(mins => least(greatest(p_minutes, 1), 240))
      and not exists (
        select 1 from public.push_reminders r
        where r.appointment_id = a.id and r.starts_at = a.starts_at
      )
  ),
  claimed as (
    insert into public.push_reminders (appointment_id, starts_at)
    select id, starts_at from due
    on conflict (appointment_id) do update
      set starts_at = excluded.starts_at, sent_at = now()
      where public.push_reminders.starts_at <> excluded.starts_at
    returning public.push_reminders.appointment_id
  )
  select a.id, a.starts_at, a.customer_name, s.name
  from claimed c
  join public.appointments a on a.id = c.appointment_id
  join public.services s on s.id = a.service_id
  order by a.starts_at;
$$;

revoke execute on function public.claim_push_reminders(int) from public, anon, authenticated;
grant execute on function public.claim_push_reminders(int) to service_role;

-- -----------------------------------------------------------------------------
-- Every 5 minutes, ask the app server to send due reminders:
-- POST <site>/api/push/reminders with a shared secret.
--
-- The site URL and the secret live in Supabase Vault (set once, see README):
--   select vault.create_secret('https://<your-site>', 'push_site_url');
--   select vault.create_secret('<PUSH_CRON_SECRET>', 'push_cron_secret');
-- Until both exist this does nothing.
-- -----------------------------------------------------------------------------
create or replace function public.trigger_push_reminders()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_url    text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'push_site_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_cron_secret';
  if v_url is null or v_secret is null then
    return;
  end if;

  perform net.http_post(
    url := rtrim(v_url, '/') || '/api/push/reminders',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_secret,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
end;
$$;

revoke execute on function public.trigger_push_reminders() from public, anon, authenticated;

-- pg_net + pg_cron exist on Supabase; local test databases skip this.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net;
  end if;
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('push-reminders', '*/5 * * * *', 'select public.trigger_push_reminders()');
  end if;
end $$;
