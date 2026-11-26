import type { Metadata } from "next";
import Link from "next/link";
import { card } from "@/components/ui";
import { requireSuperadmin } from "@/lib/auth";
import { formatLongDay, formatTime } from "@/lib/datetime";
import { formatCLP } from "@/lib/format";

export const metadata: Metadata = { title: "Historial" };

const TABLES: Record<string, string> = {
  appointments: "Citas",
  services: "Servicios",
  working_hours: "Horario",
  time_off: "Bloqueos",
  blocked_phones: "Teléfonos bloqueados",
  booking_settings: "Reglas",
  staff: "Usuarios",
  barbers: "Barberos",
};

const ACTIONS: Record<string, string> = {
  INSERT: "creó",
  UPDATE: "cambió",
  DELETE: "eliminó",
  PURGE: "borró datos antiguos",
};

const ACTORS: Record<string, string> = {
  barber: "Barbero",
  superadmin: "Administrador",
  web: "Cliente (web)",
  anon: "Cliente (link)",
  sistema: "Sistema",
  usuario: "Usuario sin acceso",
};

const FIELDS: Record<string, string> = {
  status: "Estado",
  starts_at: "Inicio",
  ends_at: "Término",
  customer_name: "Cliente",
  customer_phone: "Teléfono",
  phone: "Teléfono",
  notes: "Nota",
  name: "Nombre",
  price_clp: "Precio",
  duration_min: "Duración",
  active: "Visible",
  description: "Descripción",
  sort_order: "Orden",
  weekday: "Día",
  start_time: "Desde",
  end_time: "Hasta",
  reason: "Motivo",
  role: "Perfil",
  min_lead_min: "Anticipación mínima",
  max_days_ahead: "Días hacia adelante",
  max_active_per_phone: "Citas por teléfono",
  max_active_per_client: "Citas por dispositivo",
  max_bookings_per_client_hour: "Reservas por hora",
  cancel_min_lead_min: "Plazo para cancelar",
  slot_step_min: "Intervalo",
  cancelled_at: "Cancelada el",
};

const HIDDEN = new Set(["id", "created_at", "barber_id", "service_id", "cancel_token", "user_id", "created_by"]);
const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const STATUS: Record<string, string> = {
  pending: "pendiente", confirmed: "confirmada", cancelled: "cancelada", completed: "atendida", no_show: "no asistió",
};

function show(key: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (key === "price_clp" && typeof v === "number") return formatCLP(v);
  if (key === "weekday" && typeof v === "number") return WEEKDAYS[v] ?? String(v);
  if (key === "status") return STATUS[String(v)] ?? String(v);
  if (key === "role") return ACTORS[String(v)] ?? String(v);
  if (typeof v === "boolean") return v ? "sí" : "no";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) return `${formatLongDay(v)} ${formatTime(v)}`;
  if (typeof v === "string" && /^\d{2}:\d{2}:\d{2}$/.test(v)) return v.slice(0, 5);
  return String(v);
}

type Json = Record<string, unknown> | null;

function Changes({ action, oldData, newData }: { action: string; oldData: Json; newData: Json }) {
  if (action === "PURGE" && newData) {
    return <p>{String(newData.appointments ?? 0)} citas anonimizadas, {String(newData.audit_entries ?? 0)} registros antiguos borrados.</p>;
  }
  const data = (action === "DELETE" ? oldData : newData) ?? {};
  const keys = Object.keys(data).filter((k) => !HIDDEN.has(k));
  if (keys.length === 0) return null;
  return (
    <ul className="text-sm">
      {keys.map((k) => (
        <li key={k}>
          <span className="text-smoke">{FIELDS[k] ?? k}:</span>{" "}
          {action === "UPDATE" && oldData ? (
            <>
              <span className="line-through decoration-smoke/60">{show(k, oldData[k])}</span> → <strong>{show(k, data[k])}</strong>
            </>
          ) : (
            show(k, data[k])
          )}
        </li>
      ))}
    </ul>
  );
}

export default async function HistorialPage({ searchParams }: PageProps<"/admin/sistema/historial">) {
  const { tabla } = await searchParams;
  const { supabase } = await requireSuperadmin();
  const filter = typeof tabla === "string" && tabla in TABLES ? tabla : null;

  let query = supabase
    .from("audit_log")
    .select("id, at, actor_id, actor_role, action, table_name, old_data, new_data")
    .order("at", { ascending: false })
    .limit(150);
  if (filter) query = query.eq("table_name", filter);

  const [{ data: entries, error }, { data: staff }] = await Promise.all([query, supabase.rpc("staff_list")]);
  if (error) throw new Error(`audit_log: ${error.message}`);
  const emailOf = new Map((staff ?? []).map((s) => [s.user_id, s.email]));

  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1 text-sm font-bold ${active ? "border-ink bg-ink text-bone" : "border-smoke/40 hover:border-ink"}`;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Link href="/admin/sistema/historial" className={chip(!filter)}>Todo</Link>
        {Object.entries(TABLES).map(([key, label]) => (
          <Link key={key} href={`/admin/sistema/historial?tabla=${key}`} className={chip(filter === key)}>
            {label}
          </Link>
        ))}
      </div>
      <p className="-mt-3 text-sm text-smoke">Últimos 150 cambios. Se guardan 12 meses.</p>

      {entries.length === 0 && <p className="text-smoke">Todavía no hay cambios registrados.</p>}
      <ol className="flex flex-col gap-2">
        {entries.map((e) => (
          <li key={e.id} className={`${card} flex flex-col gap-1 py-3`}>
            <p className="text-sm text-smoke">
              {formatLongDay(e.at)}, {formatTime(e.at)}
            </p>
            <p>
              <strong>{(e.actor_id && emailOf.get(e.actor_id)) || ACTORS[e.actor_role] || e.actor_role}</strong>{" "}
              {ACTIONS[e.action] ?? e.action} · <span className="text-smoke">{TABLES[e.table_name] ?? e.table_name}</span>
            </p>
            <Changes action={e.action} oldData={e.old_data as Json} newData={e.new_data as Json} />
          </li>
        ))}
      </ol>
    </>
  );
}
