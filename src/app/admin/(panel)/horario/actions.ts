"use server";

import { refresh } from "next/cache";
import type { ActionResult } from "@/components/admin/action-form";
import { getDefaultBarberId } from "@/lib/admin/data";
import { requireAdmin } from "@/lib/auth";
import { isUuid } from "@/lib/booking/data";

const fail = (error: string): ActionResult => ({ error, ok: false });
const TIME = /^\d{2}:\d{2}$/;

export async function addWorkingBlock(
  weekday: number,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const start = String(formData.get("start") ?? "");
  const end = String(formData.get("end") ?? "");
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return fail("Día no válido.");
  if (!TIME.test(start) || !TIME.test(end)) return fail("Revisa las horas.");
  if (start >= end) return fail("La hora de término debe ser después del inicio.");

  const { data: existing } = await supabase
    .from("working_hours")
    .select("start_time, end_time")
    .eq("weekday", weekday);
  const overlaps = (existing ?? []).some((b) => start < b.end_time.slice(0, 5) && end > b.start_time.slice(0, 5));
  if (overlaps) return fail("Ese tramo se cruza con otro del mismo día.");

  const barberId = await getDefaultBarberId(supabase);
  if (!barberId) return fail("No hay barbero activo configurado.");

  const { error } = await supabase
    .from("working_hours")
    .insert({ barber_id: barberId, weekday, start_time: start, end_time: end });
  if (error) {
    console.error("addWorkingBlock:", error);
    return fail("No se pudo guardar el tramo.");
  }
  refresh();
  return { error: null, ok: true };
}

export async function deleteWorkingBlock(id: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  if (!isUuid(id)) return fail("Tramo no encontrado.");
  const { error } = await supabase.from("working_hours").delete().eq("id", id);
  if (error) {
    console.error("deleteWorkingBlock:", error);
    return fail("No se pudo borrar el tramo.");
  }
  refresh();
  return { error: null, ok: true };
}
