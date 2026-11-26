"use server";

import { refresh } from "next/cache";
import type { ActionResult } from "@/components/admin/action-form";
import { requireSuperadmin } from "@/lib/auth";

// Same ranges as the CHECK constraints in public.booking_settings.
const FIELDS = {
  min_lead_min: { min: 0, max: 7 * 24 * 60, label: "Anticipación mínima" },
  max_days_ahead: { min: 1, max: 365, label: "Días hacia adelante" },
  max_active_per_phone: { min: 1, max: 20, label: "Citas por teléfono" },
  max_active_per_client: { min: 1, max: 20, label: "Citas por dispositivo" },
  max_bookings_per_client_hour: { min: 1, max: 20, label: "Reservas por hora" },
  cancel_min_lead_min: { min: 0, max: 7 * 24 * 60, label: "Plazo para cancelar" },
  slot_step_min: { min: 5, max: 240, label: "Intervalo de horas" },
} as const;

type Field = keyof typeof FIELDS;

export async function saveBookingRules(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireSuperadmin();

  const values = {} as Record<Field, number>;
  for (const [key, { min, max, label }] of Object.entries(FIELDS) as [Field, (typeof FIELDS)[Field]][]) {
    const v = Number(formData.get(key));
    if (!Number.isInteger(v) || v < min || v > max) {
      return { error: `${label}: debe ser un número entre ${min} y ${max}.`, ok: false };
    }
    values[key] = v;
  }

  const { error } = await supabase.from("booking_settings").update(values).eq("id", true);
  if (error) {
    console.error("saveBookingRules:", error);
    return { error: "No se pudieron guardar las reglas.", ok: false };
  }
  refresh();
  return { error: null, ok: true };
}
