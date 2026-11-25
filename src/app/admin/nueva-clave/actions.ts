"use server";

import { redirect } from "next/navigation";
import type { ActionResult } from "@/components/admin/action-form";
import { createClient } from "@/lib/supabase/server";
import { MIN_PASSWORD } from "./rules";

/** Sets the signed-in user's password (after a recovery link or from Mi cuenta). */
export async function updatePassword(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < MIN_PASSWORD) {
    return { error: `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`, ok: false };
  }
  if (password !== confirm) {
    return { error: "Las dos contraseñas no coinciden.", ok: false };
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect("/admin/login");

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    switch (error.code) {
      case "insufficient_aal":
        redirect("/admin/mfa?next=clave");
      case "same_password":
        return { error: "La contraseña nueva debe ser distinta a la anterior.", ok: false };
      case "weak_password":
        return {
          error: "Esa contraseña es muy fácil de adivinar. Usa una más larga o con números y símbolos.",
          ok: false,
        };
      case "reauthentication_needed":
        return {
          error: "Por seguridad, sal del panel, vuelve a entrar e intenta de nuevo.",
          ok: false,
        };
      default:
        console.error("password update failed:", error.code, error.message);
        return { error: "No pudimos guardar la contraseña. Intenta de nuevo.", ok: false };
    }
  }

  // Anyone else signed in with the old password (another phone) is logged out.
  await supabase.auth.signOut({ scope: "others" });

  return {
    error: null,
    ok: true,
    message: "Listo, tu contraseña nueva quedó guardada. Las otras sesiones abiertas se cerraron.",
  };
}
