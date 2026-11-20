"use server";

import { redirect } from "next/navigation";
import type { ActionResult } from "@/components/admin/action-form";
import { createClient } from "@/lib/supabase/server";

/** Second step of the login: verify the 6-digit code from the authenticator app. */
export async function verifyMfa(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const code = String(formData.get("code") ?? "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(code)) return { error: "Escribe los 6 números de tu app.", ok: false };

  const supabase = await createClient();
  const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
  const factor = factors?.totp?.[0];
  if (listError || !factor) return { error: "No encontramos tu verificación en dos pasos.", ok: false };

  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
  if (error) return { error: "Código incorrecto o vencido. Prueba con el código nuevo.", ok: false };

  redirect("/admin");
}
