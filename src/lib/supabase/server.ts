import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabasePublicEnv } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 * Uses the anon key + the user's session cookie, so RLS applies.
 */
export async function createClient() {
  // cookies() first: it marks the route as dynamic, so the build never tries to
  // prerender pages that need the database (and doesn't need the env vars).
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabasePublicEnv();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // Session refresh is handled by the proxy (added in Phase 4).
        }
      },
    },
  });
}
