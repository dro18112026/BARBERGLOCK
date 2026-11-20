import { requireSuperadmin } from "@/lib/auth";
import { dayKey, formatTime } from "@/lib/datetime";

const STATUS: Record<string, string> = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  cancelled: "Cancelada",
  completed: "Atendida",
  no_show: "No asistió",
};

/** CSV cell: quoted, inner quotes doubled, formula-looking values neutralised. */
function cell(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@]/.test(s)) s = `'${s}`; // avoid spreadsheet formula injection
  return `"${s.replace(/"/g, '""')}"`;
}

/** GET /admin/sistema/datos/export — all appointments as CSV (superadmin only). */
export async function GET() {
  const { supabase } = await requireSuperadmin();

  const rows: string[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("appointments")
      .select("starts_at, ends_at, status, customer_name, customer_phone, notes, created_at, services(name, price_clp)")
      .order("starts_at")
      .range(from, from + pageSize - 1);
    if (error) return new Response("Error al exportar", { status: 500 });
    for (const a of data) {
      rows.push(
        [
          dayKey(a.starts_at),
          formatTime(a.starts_at),
          formatTime(a.ends_at),
          a.services?.name,
          a.services?.price_clp,
          STATUS[a.status] ?? a.status,
          a.customer_name,
          a.customer_phone,
          a.notes,
          `${dayKey(a.created_at)} ${formatTime(a.created_at)}`,
        ]
          .map(cell)
          .join(";"),
      );
    }
    if (data.length < pageSize) break;
  }

  const header = ["Fecha", "Desde", "Hasta", "Servicio", "Precio", "Estado", "Cliente", "Teléfono", "Nota", "Reservada el"]
    .map(cell)
    .join(";");
  // BOM + ";" separator: opens correctly in Excel configured for Spanish/Chile.
  const csv = "﻿" + [header, ...rows].join("\r\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="citas-${dayKey(new Date())}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
