import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { getSupabasePublicEnv } from "@/lib/env";

/**
 * GET /api/health — uptime check that also touches the database.
 * Pinged daily so the Supabase free tier never pauses the project for
 * inactivity (it pauses after ~7 days without requests).
 */
export async function GET() {
  const started = Date.now();
  try {
    const { url, anonKey } = getSupabasePublicEnv();
    const supabase = createClient<Database>(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await supabase.from("services").select("id", { head: true, count: "exact" });
    if (error) throw error;
    return Response.json(
      { ok: true, db: "up", ms: Date.now() - started },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("health check failed:", error);
    return Response.json(
      { ok: false, db: "down" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
