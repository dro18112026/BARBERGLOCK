import type { Metadata } from "next";
import { card } from "@/components/ui";
import { requireSuperadmin } from "@/lib/auth";
import { formatLongDay, formatTime } from "@/lib/datetime";
import { checkServerKey } from "@/lib/server-key";

export const metadata: Metadata = { title: "Sistema" };

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className={`${card} flex flex-col`}>
      <span className="text-sm font-bold uppercase tracking-wide text-smoke">{label}</span>
      <span className="font-display text-4xl leading-tight">{value}</span>
      {hint && <span className="text-sm text-smoke">{hint}</span>}
    </div>
  );
}

/** Request-time timestamps (kept out of the component body: React purity rule). */
function timeWindow() {
  return { now: new Date().toISOString(), monthAgo: new Date(Date.now() - 30 * 86400_000).toISOString() };
}

const when = (iso: string | null | undefined) =>
  iso ? `${formatLongDay(iso)}, ${formatTime(iso)}` : "—";

export default async function EstadoPage() {
  const { supabase } = await requireSuperadmin();
  const { now, monthAgo } = timeWindow();

  const count = (q: PromiseLike<{ count: number | null }>) => q.then((r) => r.count ?? 0);
  const [upcoming, created30, cancelled30, staff, lastBooking, lastPurge, serverKey] = await Promise.all([
    count(supabase.from("appointments").select("id", { count: "exact", head: true })
      .gte("starts_at", now).in("status", ["confirmed", "pending"])),
    count(supabase.from("appointments").select("id", { count: "exact", head: true }).gte("created_at", monthAgo)),
    count(supabase.from("appointments").select("id", { count: "exact", head: true })
      .gte("created_at", monthAgo).eq("status", "cancelled")),
    count(supabase.from("staff").select("user_id", { count: "exact", head: true })),
    supabase.from("appointments").select("created_at").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("audit_log").select("at, new_data").eq("action", "PURGE").order("at", { ascending: false }).limit(1).maybeSingle(),
    checkServerKey(),
  ]);

  const purge = lastPurge.data?.new_data as { appointments?: number } | null | undefined;

  return (
    <>
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Citas próximas" value={upcoming} />
        <Stat label="Reservas 30 días" value={created30} hint={`${cancelled30} canceladas`} />
        <Stat label="Usuarios del panel" value={staff} />
      </section>

      <section className={`${card} flex flex-col gap-2`}>
        <h2 className="font-display text-3xl tracking-wide">Salud</h2>
        <p>✅ Base de datos: responde</p>
        <p>
          {serverKey === "ok" ? "✅" : "❌"} Clave de servidor (reservas):{" "}
          {serverKey === "ok" ? "correcta" : serverKey === "missing" ? "falta configurarla" : "inválida"}
        </p>
        <p>Última reserva recibida: {when(lastBooking.data?.created_at)}</p>
        <p>
          Último borrado automático de datos: {when(lastPurge.data?.at)}
          {purge && ` (${purge.appointments ?? 0} citas anonimizadas)`}
        </p>
        <p className="text-sm text-smoke">
          El borrado corre todos los días a las 04:15 y anonimiza las citas de hace más de 12 meses.
          El ping de GitHub revisa <code>/api/health</code> cada mañana.
        </p>
      </section>
    </>
  );
}
