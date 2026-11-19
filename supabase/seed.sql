-- =============================================================================
-- BARBERGLOCK — initial data (per barbershop).
-- Local:      runs automatically on `supabase db reset`.
-- Production: `npm run db:push -- --include-seed` (first time only).
-- Idempotent: safe to run more than once.
-- =============================================================================

insert into public.barbers (id, name) values
  ('00000000-0000-4000-8000-000000000001', 'BARBERGLOCK')
on conflict (id) do nothing;

-- Prices for "Corte + barba" and "Barba" are provisional — edit from the admin panel.
insert into public.services (id, name, description, duration_min, price_clp, sort_order) values
  ('00000000-0000-4000-8000-000000000101', 'Corte',         'Corte de pelo clásico o moderno.', 60, 10000, 1),
  ('00000000-0000-4000-8000-000000000102', 'Corte + barba', 'Servicio completo: corte y perfilado de barba.', 60, 15000, 2),
  ('00000000-0000-4000-8000-000000000103', 'Barba',         'Perfilado y arreglo de barba.', 60, 7000, 3)
on conflict (id) do nothing;

-- Monday (1) to Saturday (6): 10:00–14:00, lunch break, 14:30–19:00.
insert into public.working_hours (barber_id, weekday, start_time, end_time)
select '00000000-0000-4000-8000-000000000001', d, t.start_time, t.end_time
from generate_series(1, 6) as d
cross join (values ('10:00'::time, '14:00'::time), ('14:30'::time, '19:00'::time)) as t(start_time, end_time)
where not exists (select 1 from public.working_hours);
