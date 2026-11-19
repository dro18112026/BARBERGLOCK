import type { Metadata } from "next";
import Link from "next/link";
import { btnPrimary } from "@/components/ui";
import {
  getAppointmentsForDays,
  getTimeOff,
  getWorkingHours,
  hhmm,
  type AdminAppointment,
} from "@/lib/admin/data";
import { requireAdmin } from "@/lib/auth";
import {
  addDays,
  dayKey,
  dayParts,
  formatLongDay,
  formatTime,
  startOfWeek,
  weekdayOf,
  zonedToDate,
  type DayKey,
} from "@/lib/datetime";
import { AppointmentCard } from "./appointment-card";

export const metadata: Metadata = { title: "Agenda" };

const isDayKey = (v: unknown): v is DayKey => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

export default async function AgendaPage({ searchParams }: PageProps<"/admin">) {
  const { fecha, vista } = await searchParams;
  const { supabase } = await requireAdmin();

  const today = dayKey(new Date());
  const day = isDayKey(fecha) ? fecha : today;
  const week = vista === "semana";

  const from = week ? startOfWeek(day) : day;
  const to = addDays(from, week ? 7 : 1);
  const step = week ? 7 : 1;

  const [appointments, hours, timeOff] = await Promise.all([
    getAppointmentsForDays(supabase, from, to),
    getWorkingHours(supabase),
    getTimeOff(supabase, from, to),
  ]);

  const byDay = new Map<DayKey, AdminAppointment[]>();
  for (const a of appointments) {
    const k = dayKey(a.starts_at);
    byDay.set(k, [...(byDay.get(k) ?? []), a]);
  }
  const hoursText = (k: DayKey) => {
    const blocks = hours.filter((h) => h.weekday === weekdayOf(k));
    return blocks.length ? blocks.map((h) => `${hhmm(h.start_time)}–${hhmm(h.end_time)}`).join(" · ") : "Cerrado";
  };
  /** Time off overlapping local day k, labelled for that day. */
  const offFor = (k: DayKey) => {
    const dayStart = zonedToDate(k, "00:00").getTime();
    const dayEnd = zonedToDate(addDays(k, 1), "00:00").getTime();
    return timeOff
      .filter((t) => new Date(t.starts_at).getTime() < dayEnd && new Date(t.ends_at).getTime() > dayStart)
      .map((t) => {
        const s = Math.max(new Date(t.starts_at).getTime(), dayStart);
        const e = Math.min(new Date(t.ends_at).getTime(), dayEnd);
        const label = s === dayStart && e === dayEnd ? "todo el día" : `${formatTime(new Date(s))}–${formatTime(new Date(e - (e === dayEnd ? 1 : 0)))}`;
        return { id: t.id, label, reason: t.reason };
      });
  };

  const href = (d: DayKey, v = week ? "semana" : "dia") => `/admin?fecha=${d}&vista=${v}`;
  const navBtn = "rounded-md border-2 border-ink px-3 py-1.5 font-bold hover:bg-bone";
  // Booked = everything except cancelled / no-show (attended ones still count for the day).
  const bookedLabel = (list: AdminAppointment[]) => {
    const n = list.filter((a) => a.status !== "cancelled" && a.status !== "no_show").length;
    return n === 1 ? "1 cita" : `${n} citas`;
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-5xl leading-none tracking-wide">Agenda</h1>
        <div className="flex rounded-md border-2 border-ink" role="group" aria-label="Vista">
          <Link href={href(day, "dia")} aria-current={!week ? "page" : undefined} className={`px-4 py-1.5 font-bold ${!week ? "bg-ink text-bone" : ""}`}>
            Día
          </Link>
          <Link href={href(day, "semana")} aria-current={week ? "page" : undefined} className={`px-4 py-1.5 font-bold ${week ? "bg-ink text-bone" : ""}`}>
            Semana
          </Link>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Link href={href(addDays(day, -step))} className={navBtn} aria-label="Anterior">
          ‹
        </Link>
        <div className="text-center">
          <p className="text-lg font-bold">
            {week
              ? `Semana del ${dayParts(from).day} ${dayParts(from).month} al ${dayParts(addDays(to, -1)).day} ${dayParts(addDays(to, -1)).month}`
              : formatLongDay(day)}
          </p>
          {day !== today && (
            <Link href={href(today)} className="text-sm font-bold text-steel underline">
              Ir a hoy
            </Link>
          )}
        </div>
        <Link href={href(addDays(day, step))} className={navBtn} aria-label="Siguiente">
          ›
        </Link>
      </div>

      <Link href={`/admin/citas/nueva?fecha=${day}`} className={btnPrimary}>
        + Nueva cita
      </Link>

      {week ? (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 7 }, (_, i) => addDays(from, i)).map((k) => {
            const list = byDay.get(k) ?? [];
            const off = offFor(k);
            return (
              <section key={k} className={`rounded-lg border bg-paper p-4 ${k === today ? "border-2 border-ink" : "border-smoke/30"}`}>
                <div className="flex items-baseline justify-between gap-2">
                  <Link href={href(k, "dia")} className="text-lg font-bold underline-offset-2 hover:underline">
                    {formatLongDay(k)}
                  </Link>
                  <span className="text-sm text-smoke">
                    {bookedLabel(list)}
                  </span>
                </div>
                <p className="text-sm text-smoke">{hoursText(k)}</p>
                {off.map((t) => (
                  <p key={t.id} className="text-sm font-bold text-barber">
                    Bloqueado {t.label}{t.reason && ` · ${t.reason}`}
                  </p>
                ))}
                {list.length > 0 && (
                  <ul className="mt-2 flex flex-col gap-1">
                    {list.map((a) => (
                      <li key={a.id}>
                        <Link
                          href={`/admin/citas/${a.id}`}
                          className={`flex gap-3 rounded px-1 hover:bg-bone ${
                            a.status === "cancelled" ? "text-smoke line-through" : ""
                          }`}
                        >
                          <span className="font-bold tabular-nums">{formatTime(a.starts_at)}</span>
                          <span className="truncate">
                            {a.customer_name} · {a.service_name}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-smoke">
            Horario: {hoursText(day)} · {bookedLabel(byDay.get(day) ?? [])}
          </p>
          {offFor(day).map((t) => (
            <p key={t.id} className="rounded-lg border-2 border-barber bg-barber/10 p-3 font-bold text-barber">
              Bloqueado {t.label}
              {t.reason && ` · ${t.reason}`}
            </p>
          ))}
          {(byDay.get(day) ?? []).length === 0 ? (
            <p className="rounded-lg border border-dashed border-smoke/50 p-6 text-center text-lg text-smoke">
              No hay citas este día.
            </p>
          ) : (
            (byDay.get(day) ?? []).map((a) => <AppointmentCard key={a.id} appt={a} />)
          )}
        </div>
      )}
    </>
  );
}
