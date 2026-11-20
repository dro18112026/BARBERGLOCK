import type { Metadata } from "next";
import Link from "next/link";
import { card } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { addDays, dayKey, dayParts, formatTime, startOfWeek, weekdayOf, zonedToDate, type DayKey } from "@/lib/datetime";
import { formatCLP } from "@/lib/format";

export const metadata: Metadata = { title: "Reportes" };

type Period = "semana" | "mes" | "anio";
const PERIOD_LABEL: Record<Period, string> = { semana: "Semana", mes: "Mes", anio: "Año" };
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const WEEKDAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]; // Monday first

/** [from, to) local days for the period containing `anchor`, plus prev/next anchors and a title. */
function periodRange(period: Period, anchor: DayKey) {
  const [y, m] = anchor.split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  if (period === "semana") {
    const from = startOfWeek(anchor);
    const to = addDays(from, 7);
    const last = dayParts(addDays(to, -1));
    return { from, to, prev: addDays(from, -7), next: to, title: `Semana del ${dayParts(from).day} ${dayParts(from).month} al ${last.day} ${last.month}` };
  }
  if (period === "anio") {
    return { from: `${y}-01-01`, to: `${y + 1}-01-01`, prev: `${y - 1}-01-01`, next: `${y + 1}-01-01`, title: `Año ${y}` };
  }
  const from = `${y}-${pad(m)}-01`;
  const to = m === 12 ? `${y + 1}-01-01` : `${y}-${pad(m + 1)}-01`;
  const prev = m === 1 ? `${y - 1}-12-01` : `${y}-${pad(m - 1)}-01`;
  return { from, to, prev, next: to, title: `${MONTHS[m - 1].charAt(0).toUpperCase()}${MONTHS[m - 1].slice(1)} ${y}` };
}

const pct = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0);

function Tile({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className={`${card} flex flex-col p-4`}>
      <span className="text-sm font-bold uppercase tracking-wide text-smoke">{label}</span>
      <span className="font-display text-4xl leading-tight">{value}</span>
      {hint && <span className="text-sm text-smoke">{hint}</span>}
    </div>
  );
}

/**
 * Single-series horizontal bars: one hue (steel), value printed at the end,
 * native tooltip on hover, and an sr-only sentence so it reads as data too.
 */
function Bars({ title, rows, format = String }: { title: string; rows: { label: string; value: number; hint?: string }[]; format?: (n: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <section className={`${card} flex flex-col gap-3`}>
      <h2 className="font-display text-2xl tracking-wide">{title}</h2>
      {rows.every((r) => r.value === 0) ? (
        <p className="text-smoke">Sin datos en este período.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            <li key={r.label} className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-2" title={`${r.label}: ${format(r.value)}${r.hint ? ` (${r.hint})` : ""}`}>
              <span className="truncate text-sm">{r.label}</span>
              <span className="h-3 rounded-r bg-bone" aria-hidden="true">
                <span className="block h-3 rounded-r bg-steel" style={{ width: `${(r.value / max) * 100}%` }} />
              </span>
              {/* Display font for numbers: Atkinson's slashed zero reads like a strikethrough. */}
              <span className="text-right font-display text-lg leading-none tracking-wide tabular-nums">{format(r.value)}</span>
              <span className="sr-only">
                {r.label}: {format(r.value)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function ReportesPage({ searchParams }: PageProps<"/admin/reportes">) {
  const { periodo, fecha } = await searchParams;
  const { supabase } = await requireAdmin();

  const period: Period = periodo === "semana" || periodo === "anio" ? periodo : "mes";
  const anchor = typeof fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : dayKey(new Date());
  const range = periodRange(period, anchor);

  const { data, error } = await supabase
    .from("appointments")
    .select("starts_at, status, price_clp, source, services(name)")
    .gte("starts_at", zonedToDate(range.from, "00:00").toISOString())
    .lt("starts_at", zonedToDate(range.to, "00:00").toISOString());
  if (error) throw new Error(`reportes: ${error.message}`);

  const all = data;
  const live = all.filter((a) => a.status !== "cancelled" && a.status !== "no_show");
  const completed = all.filter((a) => a.status === "completed");
  const noShow = all.filter((a) => a.status === "no_show").length;
  const cancelled = all.filter((a) => a.status === "cancelled").length;
  const sum = (list: typeof all) => list.reduce((s, a) => s + (a.price_clp ?? 0), 0);

  // Breakdowns over appointments that did / will happen.
  const byService = new Map<string, { count: number; income: number }>();
  for (const a of live) {
    const name = a.services?.name ?? "—";
    const cur = byService.get(name) ?? { count: 0, income: 0 };
    byService.set(name, { count: cur.count + 1, income: cur.income + (a.price_clp ?? 0) });
  }
  const services = [...byService.entries()].sort((x, y) => y[1].count - x[1].count);

  const byWeekday = Array(7).fill(0) as number[];
  const byHour = new Map<string, number>();
  for (const a of live) {
    byWeekday[(weekdayOf(dayKey(a.starts_at)) + 6) % 7]++;
    const h = formatTime(a.starts_at).slice(0, 2) + ":00";
    byHour.set(h, (byHour.get(h) ?? 0) + 1);
  }
  const web = all.filter((a) => a.source === "web").length;
  const panel = all.filter((a) => a.source === "panel").length;

  const href = (p: Period, f: string) => `/admin/reportes?periodo=${p}&fecha=${f}`;
  const navBtn = "rounded-md border-2 border-ink px-3 py-1.5 font-bold hover:bg-bone";

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-5xl leading-none tracking-wide">Reportes</h1>
        <div className="flex rounded-md border-2 border-ink" role="group" aria-label="Período">
          {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => (
            <Link key={p} href={href(p, anchor)} aria-current={p === period ? "page" : undefined}
              className={`px-3 py-1.5 font-bold ${p === period ? "bg-ink text-bone" : ""}`}>
              {PERIOD_LABEL[p]}
            </Link>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Link href={href(period, range.prev)} className={navBtn} aria-label="Período anterior">‹</Link>
        <p className="text-center text-lg font-bold">{range.title}</p>
        <Link href={href(period, range.next)} className={navBtn} aria-label="Período siguiente">›</Link>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Tile label="Atendidas" value={completed.length} hint={formatCLP(sum(completed))} />
        <Tile label="Agendadas" value={live.length} hint={`${formatCLP(sum(live))} en total`} />
        <Tile label="No asistió" value={noShow} hint={`${pct(noShow, all.length)}% del total`} />
        <Tile label="Canceladas" value={cancelled} hint={`${pct(cancelled, all.length)}% del total`} />
        <Tile label="Por la web" value={web} hint={`${pct(web, web + panel)}% de las reservas`} />
        <Tile label="Por el panel" value={panel} hint="agendadas a mano" />
      </section>
      <p className="-mt-3 text-sm text-smoke">
        Montos según el precio al momento de reservar. &quot;Agendadas&quot; incluye atendidas y
        próximas; no cuenta canceladas ni inasistencias.
      </p>

      <Bars title="Servicios más pedidos" rows={services.map(([label, v]) => ({ label, value: v.count, hint: formatCLP(v.income) }))} />
      <Bars title="Ingresos por servicio" rows={services.map(([label, v]) => ({ label, value: v.income }))} format={formatCLP} />
      <Bars title="Días con más movimiento" rows={WEEKDAYS.map((label, i) => ({ label, value: byWeekday[i] }))} />
      <Bars
        title="Horas más pedidas"
        rows={[...byHour.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([label, value]) => ({ label, value }))}
      />
    </>
  );
}
