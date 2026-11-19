"use server";

import { redirect } from "next/navigation";
import type { ActionResult } from "@/components/admin/action-form";
import { getDefaultBarberId, type AppointmentStatus } from "@/lib/admin/data";
import { requireAdmin } from "@/lib/auth";
import { isUuid } from "@/lib/booking/data";
import { dayKey, zonedToDate } from "@/lib/datetime";
import { normalizeChileanPhone } from "@/lib/format";

const STATUSES: AppointmentStatus[] = ["pending", "confirmed", "cancelled", "completed", "no_show"];
const fail = (error: string): ActionResult => ({ error, ok: false });

/**
 * Create (id = null) or update an appointment from the admin panel.
 * Unlike the public booking, the barber may book outside the usual rules
 * (e.g. less than 1 h ahead, or outside working hours). The database still
 * refuses overlapping appointments.
 */
export async function saveAppointment(
  id: string | null,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const get = (k: string) => String(formData.get(k) ?? "").trim();

  const serviceId = get("serviceId");
  const date = get("date");
  const time = get("time");
  const name = get("name").replace(/\s+/g, " ");
  const phone = normalizeChileanPhone(get("phone"));
  const notes = get("notes") || null;
  const status = (get("status") || "confirmed") as AppointmentStatus;

  if (!isUuid(serviceId)) return fail("Elige un servicio.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    return fail("Revisa la fecha y la hora.");
  }
  if (name.length < 2 || name.length > 80) return fail("Escribe el nombre del cliente.");
  if (!phone) return fail("Teléfono no válido. Debe tener 9 dígitos, ej: 9 1234 5678.");
  if (notes && notes.length > 500) return fail("La nota es muy larga (máx. 500 caracteres).");
  if (!STATUSES.includes(status)) return fail("Estado no válido.");

  const { data: service } = await supabase
    .from("services")
    .select("duration_min")
    .eq("id", serviceId)
    .maybeSingle();
  if (!service) return fail("Ese servicio no existe.");

  const startsAt = zonedToDate(date, time);
  const endsAt = new Date(startsAt.getTime() + service.duration_min * 60_000);
  const fields = {
    service_id: serviceId,
    customer_name: name,
    customer_phone: phone,
    notes,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    status,
    cancelled_at: status === "cancelled" ? new Date().toISOString() : null,
  };

  let error;
  if (id) {
    if (!isUuid(id)) return fail("Cita no encontrada.");
    ({ error } = await supabase.from("appointments").update(fields).eq("id", id));
  } else {
    const barberId = await getDefaultBarberId(supabase);
    if (!barberId) return fail("No hay barbero activo configurado.");
    ({ error } = await supabase.from("appointments").insert({ ...fields, barber_id: barberId }));
  }

  if (error) {
    if (error.code === "23P01") return fail("Esa hora choca con otra cita. Elige otro horario.");
    console.error("saveAppointment:", error);
    return fail("No se pudo guardar la cita.");
  }

  redirect(`/admin?fecha=${dayKey(startsAt)}&vista=dia`);
}
