"use server";

import { refresh } from "next/cache";
import { requireAdmin } from "@/lib/auth";

export type EnrollStart =
  | { ok: true; factorId: string; qr: string; secret: string }
  | { ok: false; error: string };

/** Step 1: create a TOTP factor and return the QR code to scan. */
export async function startTotpEnroll(): Promise<EnrollStart> {
  const { supabase } = await requireAdmin();

  // Clean up any half-finished attempt (unverified factors block a new one).
  const { data: factors } = await supabase.auth.mfa.listFactors();
  for (const f of factors?.all ?? []) {
    if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "BARBERGLOCK",
    issuer: "BARBERGLOCK",
  });
  if (error || !data) {
    console.error("mfa enroll:", error);
    return { ok: false, error: "No se pudo iniciar la activación. Inténtalo de nuevo." };
  }
  return { ok: true, factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
}

/** Step 2: confirm with the first code from the app. Upgrades this session to AAL2. */
export async function confirmTotpEnroll(
  factorId: string,
  code: string,
): Promise<{ ok: boolean; error?: string }> {
  const { supabase } = await requireAdmin();
  const clean = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(clean)) return { ok: false, error: "Escribe los 6 números de tu app." };

  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: clean });
  if (error) return { ok: false, error: "Código incorrecto. Revisa la hora del celular y prueba con el código nuevo." };

  refresh();
  return { ok: true };
}

/** Turn 2FA off (requires the current session to have passed it). */
export async function disableTotp(factorId: string): Promise<{ ok: boolean; error?: string }> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) {
    console.error("mfa unenroll:", error);
    return { ok: false, error: "No se pudo desactivar. Cierra sesión, vuelve a entrar con el código e inténtalo otra vez." };
  }
  refresh();
  return { ok: true };
}
