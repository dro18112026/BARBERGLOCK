import "server-only";
import { redirect } from "next/navigation";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export type StaffRole = Database["public"]["Enums"]["staff_role"];

/**
 * Ensures the current request comes from a signed-in staff member (barber or
 * superadmin). Call it in admin layouts/pages AND at the start of every admin
 * Server Action. Returns a Supabase client bound to that user (RLS applies).
 *
 * If the user enrolled two-step verification but hasn't entered the code in
 * this session, they're sent to /admin/mfa first.
 */
export async function requireAdmin() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect("/admin/login");

  const { data: role } = await supabase.rpc("my_role");
  if (!role) {
    const { data: pending } = await supabase.rpc("mfa_pending");
    redirect(pending ? "/admin/mfa" : "/admin/login?error=not_admin");
  }

  return {
    supabase,
    role,
    userId: data.claims.sub,
    email: data.claims.email as string | undefined,
  };
}

/** Like requireAdmin, but only for the superadmin ("Sistema" section). */
export async function requireSuperadmin() {
  const ctx = await requireAdmin();
  if (ctx.role !== "superadmin") redirect("/admin");
  return ctx;
}
