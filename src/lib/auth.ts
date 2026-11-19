import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Ensures the current request comes from a signed-in admin (listed in
 * public.admins). Call it in the admin layout AND at the start of every admin
 * Server Action. Returns a Supabase client bound to that user (RLS applies).
 */
export async function requireAdmin() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect("/admin/login");

  const { data: isAdmin, error } = await supabase.rpc("is_admin");
  if (error || !isAdmin) redirect("/admin/login?error=not_admin");

  return { supabase, userId: data.claims.sub, email: data.claims.email as string | undefined };
}
