"use server";

import { refresh } from "next/cache";
import type { ActionResult } from "@/components/admin/action-form";
import type { AppointmentStatus } from "@/lib/admin/data";
import { requireAdmin } from "@/lib/auth";

const ALLOWED: AppointmentStatus[] = ["confirmed", "cancelled", "completed", "no_show"];

export async function setAppointmentStatus(
  id: string,
  status: AppointmentStatus,
): Promise<ActionResult> {
  if (!ALLOWED.includes(status)) return { error: "Estado no válido.", ok: false };
  const { supabase } = await requireAdmin();

  const { error } = await supabase
    .from("appointments")
    .update({
      status,
      cancelled_at: status === "cancelled" ? new Date().toISOString() : null,
    })
    .eq("id", id);

  if (error) {
    // Re-activating a cancelled appointment may collide with a newer booking.
    if (error.code === "23P01") {
      return { error: "No se puede reactivar: esa hora ya está ocupada por otra cita.", ok: false };
    }
    console.error("setAppointmentStatus:", error);
    return { error: "No se pudo actualizar la cita.", ok: false };
  }

  refresh();
  return { error: null, ok: true };
}
