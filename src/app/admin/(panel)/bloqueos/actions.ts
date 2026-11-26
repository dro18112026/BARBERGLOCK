"use server";

import { refresh } from "next/cache";
import type { ActionResult } from "@/components/admin/action-form";
import { getDefaultBarberId } from "@/lib/admin/data";
import { requireAdmin } from "@/lib/auth";
import { isUuid } from "@/lib/booking/data";
import { addDays, zonedToDate } from "@/lib/datetime";
import { normalizeChileanPhone } from "@/lib/format";

const fail = (error: string): ActionResult => ({ error, ok: false });
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;

export async function addTimeOff(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const from = get("from");
  const to = get("to") || from;
  const allDay = formData.get("allDay") === "on";
  const reason = get("reason") || null;

  if (!DATE.test(from) || !DATE.test(to)) return fail("Revisa las fechas.");
  if (to < from) return fail("La fecha final debe ser igual o posterior a la inicial.");
  if (reason && reason.length > 200) return fail("El motivo es muy largo.");

  let startsAt: Date;
  let endsAt: Date;
  if (allDay) {
    startsAt = zonedToDate(from, "00:00");
    endsAt = zonedToDate(addDays(to, 1), "00:00");
  } else {
    const start = get("start");
    const end = get("end");
    if (!TIME.test(start) || !TIME.test(end)) return fail("Indica la hora de inicio y término.");
    startsAt = zonedToDate(from, start);
    endsAt = zonedToDate(to, end);
    if (endsAt <= startsAt) return fail("El término debe ser después del inicio.");
  }

  const barberId = await getDefaultBarberId(supabase);
  if (!barberId) return fail("No hay barbero activo configurado.");

  const { error } = await supabase.from("time_off").insert({
    barber_id: barberId,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    reason,
  });
  if (error) {
    console.error("addTimeOff:", error);
    return fail("No se pudo guardar el bloqueo.");
  }
  refresh();
  return { error: null, ok: true };
}

export async function deleteTimeOff(id: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  if (!isUuid(id)) return fail("Bloqueo no encontrado.");
  const { error } = await supabase.from("time_off").delete().eq("id", id);
  if (error) {
    console.error("deleteTimeOff:", error);
    return fail("No se pudo borrar el bloqueo.");
  }
  refresh();
  return { error: null, ok: true };
}

// --- Blocked phones -----------------------------------------------------------------

/** Blocks a number from booking online; optionally cancels its future appointments. */
export async function blockPhone(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const phone = normalizeChileanPhone(String(formData.get("phone") ?? ""));
  const reason = String(formData.get("reason") ?? "").trim() || undefined;
  const cancelFuture = formData.get("cancelFuture") === "on";
  if (!phone) return fail("Revisa el teléfono. Debe tener 9 dígitos, por ejemplo 9 1234 5678.");
  if (reason && reason.length > 200) return fail("El motivo es muy largo.");

  const { data: cancelled, error } = await supabase.rpc("block_phone", {
    p_phone: phone,
    p_reason: reason,
    p_cancel_future: cancelFuture,
  });
  if (error) {
    console.error("block_phone:", error);
    return fail("No se pudo bloquear el teléfono.");
  }
  refresh();
  return {
    error: null,
    ok: true,
    message: cancelled
      ? `Teléfono bloqueado. Se ${cancelled === 1 ? "canceló 1 hora futura" : `cancelaron ${cancelled} horas futuras`}.`
      : "Teléfono bloqueado.",
  };
}

export async function unblockPhone(phone: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("unblock_phone", { p_phone: String(phone) });
  if (error) {
    console.error("unblock_phone:", error);
    return fail("No se pudo desbloquear el teléfono.");
  }
  refresh();
  return { error: null, ok: true };
}
