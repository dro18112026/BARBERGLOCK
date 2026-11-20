import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { getSupabasePublicEnv } from "@/lib/env";
import { checkServerKey } from "@/lib/server-key";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * GET /api/health — uptime check that also touches the database.
 * Pinged daily so the Supabase free tier never pauses the project for
 * inactivity (it pauses after ~7 days without requests).
 *
 * `server` reports whether SUPABASE_SERVICE_ROLE_KEY has server permissions
 * (needed for bookings). Nothing about the key itself is exposed.
 */
export async function GET() {
  const started = Date.now();
  try {
    const { url, anonKey } = getSupabasePublicEnv();
    const publicClient = createClient<Database>(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await publicClient.from("services").select("id", { head: true, count: "exact" });
    if (error) throw error;

    const server = await checkServerKey();
    return Response.json(
      { ok: server === "ok", db: "up", server, ms: Date.now() - started },
      { status: server === "ok" ? 200 : 503, headers: NO_STORE },
    );
  } catch (error) {
    console.error("health check failed:", error);
    return Response.json({ ok: false, db: "down" }, { status: 503, headers: NO_STORE });
  }
}
