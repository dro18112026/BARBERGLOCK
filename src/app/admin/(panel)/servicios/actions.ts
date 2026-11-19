"use server";

import { refresh } from "next/cache";
import type { ActionResult } from "@/components/admin/action-form";
import { requireAdmin } from "@/lib/auth";
import { isUuid } from "@/lib/booking/data";

const fail = (error: string): ActionResult => ({ error, ok: false });

function parseService(formData: FormData) {
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const name = get("name");
  const description = get("description") || null;
  const duration = Number(get("duration_min"));
  const price = Number(get("price_clp").replace(/\D/g, ""));
  const sort = Number(get("sort_order") || 0);
  const active = formData.get("active") === "on";

  if (!name || name.length > 80) return { error: "Escribe un nombre (máx. 80 caracteres)." };
  if (!Number.isInteger(duration) || duration < 5 || duration > 480) {
    return { error: "La duración debe estar entre 5 y 480 minutos." };
  }
  if (!Number.isInteger(price) || price < 0) return { error: "Precio no válido." };
  if (description && description.length > 300) return { error: "Descripción muy larga." };

  return {
    values: { name, description, duration_min: duration, price_clp: price, sort_order: sort, active },
  };
}

export async function saveService(
  id: string | null,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const parsed = parseService(formData);
  if (!parsed.values) return fail(parsed.error);

  const { error } = id
    ? isUuid(id)
      ? await supabase.from("services").update(parsed.values).eq("id", id)
      : { error: { message: "bad id" } }
    : await supabase.from("services").insert(parsed.values);

  if (error) {
    console.error("saveService:", error);
    return fail("No se pudo guardar el servicio.");
  }
  refresh();
  return { error: null, ok: true };
}
