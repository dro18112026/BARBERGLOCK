-- =============================================================================
-- Server-side booking, step 1 of 2 (additive, safe to apply before the new code).
--
-- Lets the service_role (used by the Next.js Server Action) call
-- book_appointment, and adds a per-IP rate limiter. Step 2
-- (20261120000001_revoke_public_booking.sql) removes public access once the
-- new code is live.
-- =============================================================================

grant execute on function public.book_appointment(uuid, timestamptz, text, text, text)
  to service_role;

-- -----------------------------------------------------------------------------
-- Generic fixed-window rate limiter. Keys are opaque (the app sends an HMAC of
-- the client IP, never the IP itself). Rows older than 1 day are purged.
-- -----------------------------------------------------------------------------
create table public.rate_limits (
  key     text        not null,
  hit_at  timestamptz not null default now()
);

create index rate_limits_key_hit_idx on public.rate_limits (key, hit_at);

-- RLS on, no policies, no grants: invisible to anon/authenticated.
alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from public, anon, authenticated;

create or replace function public.hit_rate_limit(
  p_key            text,
  p_limit          int,
  p_window_seconds int
)
returns boolean -- true = allowed (and counted), false = over the limit
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  if p_window_seconds > 86400 then
    raise exception 'window too long (max 1 day)';
  end if;

  perform pg_advisory_xact_lock(hashtext('rate-limit:' || p_key));

  delete from public.rate_limits where hit_at < now() - interval '1 day';

  select count(*) into v_count
  from public.rate_limits
  where key = p_key
    and hit_at > now() - make_interval(secs => p_window_seconds);

  if v_count >= p_limit then
    return false;
  end if;

  insert into public.rate_limits (key) values (p_key);
  return true;
end;
$$;

revoke execute on function public.hit_rate_limit(text, int, int) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, int, int) to service_role;
