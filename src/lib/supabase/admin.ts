import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Service-role client. BYPASSES RLS — server-only, use sparingly
 * (e.g. the health-check ping). Never import from client code.
 */
export function createAdminClient() {
  const { url } = getSupabasePublicEnv();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("Missing environment variable SUPABASE_SERVICE_ROLE_KEY.");
  }
  return createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
