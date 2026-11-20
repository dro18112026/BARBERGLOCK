import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

export type ServerKeyStatus = "ok" | "missing" | "error";

/**
 * Is SUPABASE_SERVICE_ROLE_KEY set to a key with server permissions?
 * Calls the same function bookings call first (only the service role may).
 */
export async function checkServerKey(): Promise<ServerKeyStatus> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return "missing";
  const { url } = getSupabasePublicEnv();
  const admin = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await admin.rpc("hit_rate_limit", {
    p_key: "health",
    p_limit: 1_000_000,
    p_window_seconds: 60,
  });
  if (error) console.error("server key check failed:", error);
  return error ? "error" : "ok";
}
