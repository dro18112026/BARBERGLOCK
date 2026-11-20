"use server";

import { refresh } from "next/cache";
import type { ActionResult } from "@/components/admin/action-form";
import { requireSuperadmin, type StaffRole } from "@/lib/auth";
import { isUuid } from "@/lib/booking/data";

const ERRORS: Record<string, string> = {
  USER_NOT_FOUND:
    "No existe una cuenta con ese correo. Créala primero en Supabase → Authentication → Users.",
  CANNOT_REVOKE_SELF: "No puedes quitarte el acceso a ti mismo.",
  LAST_SUPERADMIN: "Debe quedar al menos un administrador del sistema.",
  FORBIDDEN: "No tienes permiso para esto.",
};
const fail = (message: string | undefined): ActionResult => ({
  error: Object.entries(ERRORS).find(([code]) => message?.includes(code))?.[1] ?? "No se pudo guardar.",
  ok: false,
});

const ROLES: StaffRole[] = ["barber", "superadmin"];

export async function grantAccess(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireSuperadmin();
  const email = String(formData.get("email") ?? "").trim();
  const role = String(formData.get("role") ?? "") as StaffRole;
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Escribe un correo válido.", ok: false };
  if (!ROLES.includes(role)) return { error: "Elige un perfil.", ok: false };

  const { error } = await supabase.rpc("staff_grant", { p_email: email, p_role: role });
  if (error) return fail(error.message);
  refresh();
  return { error: null, ok: true };
}

export async function changeRole(email: string, role: StaffRole): Promise<ActionResult> {
  const { supabase } = await requireSuperadmin();
  if (!ROLES.includes(role)) return { error: "Perfil no válido.", ok: false };
  const { error } = await supabase.rpc("staff_grant", { p_email: email, p_role: role });
  if (error) return fail(error.message);
  refresh();
  return { error: null, ok: true };
}

export async function revokeAccess(userId: string): Promise<ActionResult> {
  const { supabase } = await requireSuperadmin();
  if (!isUuid(userId)) return { error: "Usuario no válido.", ok: false };
  const { error } = await supabase.rpc("staff_revoke", { p_user_id: userId });
  if (error) return fail(error.message);
  refresh();
  return { error: null, ok: true };
}
