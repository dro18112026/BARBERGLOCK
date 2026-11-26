-- =============================================================================
-- The app server (service role) must read public.staff: push notifications
-- are sent only to devices of people who still have panel access.
-- Without this grant the lookup failed with "permission denied" and no
-- notification was ever sent.
-- =============================================================================

grant select on public.staff to service_role;
