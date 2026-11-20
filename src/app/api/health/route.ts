import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { getSupabasePublicEnv } from "@/lib/env";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * GET /api/health — uptime check that also touches the database.
 * Pinged daily so the Supabase free tier never pauses the project for
 * inactivity (it pauses after ~7 days without requests).
 *
 * `server` reports whether SUPABASE_SERVICE_ROLE_KEY is set to a key with
 * server permissions (needed for bookings), using a function only that key can
 * execute; nothing about the key itself is exposed.
 */
export async function GET() {
  const started = Date.now();
  try {
    const { url, anonKey } = getSupabasePublicEnv();
    const options = { auth: { persistSession: false, autoRefreshToken: false } };

    const publicClient = createClient<Database>(url, anonKey, options);
    const { error } = await publicClient.from("services").select("id", { head: true, count: "exact" });
    if (error) throw error;

    let server: "ok" | "missing" | "error" = "missing";
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (serviceKey) {
      // Same call bookings make first; only the service role may execute it.
      const admin = createClient<Database>(url, serviceKey, options);
      const { error: adminError } = await admin.rpc("hit_rate_limit", {
        p_key: "health",
        p_limit: 1_000_000,
        p_window_seconds: 60,
      });
      server = adminError ? "error" : "ok";
      if (adminError) console.error("health: service key check failed:", adminError);
    }

    return Response.json(
      { ok: server === "ok", db: "up", server, ms: Date.now() - started },
      { status: server === "ok" ? 200 : 503, headers: NO_STORE },
    );
  } catch (error) {
    console.error("health check failed:", error);
    return Response.json({ ok: false, db: "down" }, { status: 503, headers: NO_STORE });
  }
}
