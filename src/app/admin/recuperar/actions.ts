"use server";

import type { ActionResult } from "@/components/admin/action-form";
import { allowRequest } from "@/lib/rate-limit";
import { absoluteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

const SENT =
  "Si ese correo tiene acceso al panel, te enviamos un link para crear una contraseña nueva. " +
  "Revisa también la carpeta de spam. El link dura 1 hora y sirve una sola vez: usa siempre el último que te llegue.";

/**
 * Step 1 of password recovery: Supabase emails a link to /admin/recuperar/link.
 * The answer is the same whether or not the email exists, so this form can't
 * be used to find out who has access to the panel.
 */
export async function requestReset(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Escribe un correo válido.", ok: false };
  }

  const allowed = await allowRequest("password-reset", [{ limit: 5, windowSeconds: 3600 }]);
  if (!allowed) {
    return { error: "Demasiados intentos. Espera una hora y vuelve a intentar.", ok: false };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: await absoluteUrl("/admin/recuperar/link"),
  });

  if (error) {
    console.error("password reset email failed:", error.code, error.message);
    if (error.status === 429) {
      return {
        error: "Ya se enviaron varios correos hace poco. Espera unos minutos y vuelve a intentar.",
        ok: false,
      };
    }
  }

  return { error: null, ok: true, message: SENT };
}
