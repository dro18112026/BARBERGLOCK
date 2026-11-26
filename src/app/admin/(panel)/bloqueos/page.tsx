import type { Metadata } from "next";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { card, input } from "@/components/ui";
import { getAppointmentsForDays, getUpcomingTimeOff } from "@/lib/admin/data";
import { requireAdmin } from "@/lib/auth";
import { addDays, dayKey, formatLongDay, formatTime } from "@/lib/datetime";
import { formatPhone } from "@/lib/format";
import { addTimeOff, deleteTimeOff, unblockPhone } from "./actions";
import { BlockPhoneForm } from "./block-phone-form";

export const metadata: Metadata = { title: "Bloqueos" };

function describe(startsAt: string, endsAt: string) {
  const s = new Date(startsAt);
  const e = new Date(endsAt);
  const allDay = formatTime(s) === "00:00" && formatTime(e) === "00:00";
  if (allDay) {
    const last = dayKey(new Date(e.getTime() - 1));
    const first = dayKey(s);
    return first === last
      ? `${formatLongDay(first)} · todo el día`
      : `${formatLongDay(first)} al ${formatLongDay(last).toLowerCase()} · días completos`;
  }
  return dayKey(s) === dayKey(e)
    ? `${formatLongDay(s)} · ${formatTime(s)} a ${formatTime(e)}`
    : `${formatLongDay(s)} ${formatTime(s)} → ${formatLongDay(e).toLowerCase()} ${formatTime(e)}`;
}

export default async function BloqueosPage() {
  const { supabase } = await requireAdmin();
  const today = dayKey(new Date());
  const [blocks, upcoming, { data: phones }] = await Promise.all([
    getUpcomingTimeOff(supabase, today),
    getAppointmentsForDays(supabase, today, addDays(today, 120)),
    supabase.from("blocked_phones").select("phone, reason, created_at").order("created_at", { ascending: false }),
  ]);

  // Active appointments that fall inside a block — the barber should contact them.
  const clashes = (t: { starts_at: string; ends_at: string }) =>
    upcoming.filter(
      (a) =>
        (a.status === "confirmed" || a.status === "pending") &&
        a.starts_at < t.ends_at &&
        a.ends_at > t.starts_at,
    );

  return (
    <>
      <h1 className="font-display text-5xl leading-none tracking-wide">Bloqueos</h1>
      <p className="-mt-3 text-smoke">
        Feriados, vacaciones o ratos libres. En esos momentos nadie puede reservar en línea. Las
        citas que ya existían <strong>no</strong> se cancelan solas: avísale al cliente.
      </p>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-3xl tracking-wide">Nuevo bloqueo</h2>
        <ActionForm
          action={addTimeOff}
          successText="Bloqueo guardado"
          resetOnSuccess
          // Time fields only matter for partial days: hidden while "Día(s) completo(s)" is checked (pure CSS).
          className={`${card} grid min-w-0 gap-3 sm:grid-cols-2 [&:has(input[name=allDay]:checked)_.only-partial]:hidden`}
        >
          <label className="flex min-w-0 flex-col gap-1">
            <span className="font-bold">Desde el día</span>
            <input type="date" name="from" required min={today} defaultValue={today} className={input} />
          </label>
          <label className="flex min-w-0 flex-col gap-1">
            <span className="font-bold">Hasta el día (opcional)</span>
            <input type="date" name="to" min={today} className={input} />
          </label>
          <label className="flex items-center gap-3 sm:col-span-2">
            <input type="checkbox" name="allDay" defaultChecked className="h-6 w-6 accent-steel" />
            <span className="font-bold">Día(s) completo(s)</span>
          </label>
          <div className="only-partial grid min-w-0 gap-3 sm:col-span-2 sm:grid-cols-2">
            <label className="flex min-w-0 flex-col gap-1">
              <span className="font-bold">Hora inicio</span>
              <input type="time" name="start" step={900} className={input} />
            </label>
            <label className="flex min-w-0 flex-col gap-1">
              <span className="font-bold">Hora término</span>
              <input type="time" name="end" step={900} className={input} />
            </label>
          </div>
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="font-bold">Motivo (opcional, solo lo ves tú)</span>
            <input name="reason" maxLength={200} placeholder="Ej: Vacaciones, feriado, trámite" className={input} />
          </label>
          <div className="sm:col-span-2">
            <SubmitButton className="rounded-lg bg-ink px-5 py-2.5 font-bold text-bone hover:bg-ink/85 disabled:opacity-60">
              Guardar bloqueo
            </SubmitButton>
          </div>
        </ActionForm>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-3xl tracking-wide">Próximos bloqueos</h2>
        {blocks.length === 0 && <p className="text-smoke">No hay bloqueos programados.</p>}
        {blocks.map((t) => {
          const affected = clashes(t);
          return (
            <ActionForm
              key={t.id}
              action={deleteTimeOff.bind(null, t.id)}
              successText=""
              confirmText="¿Quitar este bloqueo? Esas horas volverán a estar disponibles."
              className={`${card} flex flex-col gap-1`}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-lg font-bold">{describe(t.starts_at, t.ends_at)}</p>
                <SubmitButton pendingText="…" className="shrink-0 font-bold text-barber underline">
                  Quitar
                </SubmitButton>
              </div>
              {t.reason && <p className="text-smoke">{t.reason}</p>}
              {affected.length > 0 && (
                <p className="font-bold text-barber">
                  ⚠ {affected.length} {affected.length === 1 ? "cita reservada" : "citas reservadas"} en este
                  bloqueo: {affected.map((a) => `${a.customer_name} (${formatTime(a.starts_at)})`).join(", ")}
                </p>
              )}
            </ActionForm>
          );
        })}
      </section>

      <section id="telefonos" className="flex scroll-mt-4 flex-col gap-3">
        <h2 className="font-display text-3xl tracking-wide">Teléfonos bloqueados</h2>
        <p className="-mt-1 text-smoke">
          Para quien hace reservas falsas o nunca llega. Ese número no puede reservar por internet
          (se le pide que llame). También puedes bloquearlo desde la cita, en la agenda.
        </p>
        <BlockPhoneForm />
        {(phones ?? []).length === 0 && <p className="text-smoke">No hay teléfonos bloqueados.</p>}
        {(phones ?? []).map((p) => (
          <ActionForm
            key={p.phone}
            action={unblockPhone.bind(null, p.phone)}
            successText=""
            confirmText="¿Desbloquear este teléfono? Podrá volver a reservar por internet."
            className={`${card} flex flex-col gap-1`}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-lg font-bold">{formatPhone(p.phone.replace(/^\+/, ""))}</p>
              <SubmitButton pendingText="…" className="shrink-0 font-bold text-steel underline">
                Desbloquear
              </SubmitButton>
            </div>
            {p.reason && <p className="text-smoke">{p.reason}</p>}
            <p className="text-sm text-smoke">Bloqueado el {formatLongDay(p.created_at).toLowerCase()}</p>
          </ActionForm>
        ))}
      </section>
    </>
  );
}
