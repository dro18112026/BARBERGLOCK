-- =============================================================================
-- Server-side booking, step 2 of 2.
--
-- Before: anyone with the public anon key could call book_appointment directly
-- via /rest/v1/rpc, skipping the website's limits. Now only the service_role
-- (the Next.js Server Action, which applies a per-IP rate limit first) can.
-- Apply only after the code that books with the service role is deployed.
-- =============================================================================

revoke execute on function public.book_appointment(uuid, timestamptz, text, text, text)
  from public, anon, authenticated;
