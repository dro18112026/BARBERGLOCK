"use server";

import { redirect } from "next/navigation";
import type { ActionResult } from "@/components/admin/action-form";
import { createClient } from "@/lib/supabase/server";

/**
 * Step 2 of password recovery: trade the token from the email for a session,
 * then go set the new password.
 *
 * - token_hash: the email template points here with {{ .TokenHash }}. Works
 *   even if the email is opened on another device.
 * - code: Supabase's default template ({{ .ConfirmationURL }}) redirects here
 *   with a PKCE code. Only works in the browser that asked for the email.
 */
export async function confirmReset(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const tokenHash = String(formData.get("token_hash") ?? "");
  const code = String(formData.get("code") ?? "");
  const supabase = await createClient();

  const { error } = tokenHash
    ? await supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenHash })
    : code
      ? await supabase.auth.exchangeCodeForSession(code)
      : { error: new Error("missing token") };

  if (error) {
    console.error("password recovery link failed:", error.message);
    redirect("/admin/recuperar?error=link");
  }

  redirect("/admin/nueva-clave");
}
