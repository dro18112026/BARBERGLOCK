-- =============================================================================
-- Reports need two facts per appointment that weren't stored:
--   price_clp  the price when it was booked (later price changes don't
--              rewrite history)
--   source     'web' (customer booked online) or 'panel' (barber typed it in)
-- Filled automatically by a trigger, so neither booking path can forget them.
-- =============================================================================

alter table public.appointments
  add column price_clp int check (price_clp >= 0),
  add column source text check (source in ('web', 'panel'));

-- Backfill: current service price, and the source from the audit log when known.
-- Housekeeping, not a user change: keep it out of the audit log.
select set_config('app.skip_audit', 'on', true);

update public.appointments a
set price_clp = s.price_clp
from public.services s
where s.id = a.service_id and a.price_clp is null;

update public.appointments a
set source = case
  when exists (
    select 1 from public.audit_log l
    where l.table_name = 'appointments' and l.action = 'INSERT'
      and l.row_id = a.id::text and l.actor_role = 'web'
  ) then 'web'
  else 'panel'
end
where a.source is null;

select set_config('app.skip_audit', 'off', true);

create or replace function public.appointments_fill_price_source()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- New booking, or the service was changed: take that service's current price.
  if new.price_clp is null
     or (tg_op = 'UPDATE' and new.service_id is distinct from old.service_id
         and new.price_clp is not distinct from old.price_clp) then
    select s.price_clp into new.price_clp from public.services s where s.id = new.service_id;
  end if;

  if tg_op = 'INSERT' and new.source is null then
    new.source := case when public.current_actor_role() = 'web' then 'web' else 'panel' end;
  end if;

  return new;
end;
$$;

revoke execute on function public.appointments_fill_price_source() from public, anon, authenticated;

create trigger appointments_fill_price_source
  before insert or update of service_id, price_clp on public.appointments
  for each row execute function public.appointments_fill_price_source();
