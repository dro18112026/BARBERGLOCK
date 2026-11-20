"use server";

import { refresh } from "next/cache";
import type { ActionResult } from "@/components/admin/action-form";
import { requireSuperadmin } from "@/lib/auth";

/** Runs the same purge the daily job runs (12 months), right now. */
export async function purgeNow(): Promise<ActionResult> {
  const { supabase } = await requireSuperadmin();
  const { data, error } = await supabase.rpc("purge_personal_data", { p_months: 12 });
  if (error) {
    console.error("purge_personal_data:", error);
    return { error: "No se pudo ejecutar el borrado.", ok: false };
  }
  const r = data as { appointments: number; audit_entries: number };
  refresh();
  return {
    error: null,
    ok: true,
    message: `Listo: ${r.appointments} citas anonimizadas y ${r.audit_entries} registros antiguos borrados.`,
  };
}
