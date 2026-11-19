import type { Metadata } from "next";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { card, input } from "@/components/ui";
import { getWorkingHours, hhmm } from "@/lib/admin/data";
import { requireAdmin } from "@/lib/auth";
import { addWorkingBlock, deleteWorkingBlock } from "./actions";

export const metadata: Metadata = { title: "Horario" };

// Display order Monday → Sunday; values follow working_hours.weekday (0 = Sunday).
const DAYS = [
  { n: 1, name: "Lunes" },
  { n: 2, name: "Martes" },
  { n: 3, name: "Miércoles" },
  { n: 4, name: "Jueves" },
  { n: 5, name: "Viernes" },
  { n: 6, name: "Sábado" },
  { n: 0, name: "Domingo" },
];

export default async function HorarioPage() {
  const { supabase } = await requireAdmin();
  const hours = await getWorkingHours(supabase);

  return (
    <>
      <h1 className="font-display text-5xl leading-none tracking-wide">Horario semanal</h1>
      <p className="-mt-3 text-smoke">
        Cada día puede tener varios tramos. La colación es el espacio entre dos tramos (ej:
        10:00–14:00 y 14:30–19:00). Para un día puntual (feriado, trámite) usa{" "}
        <a href="/admin/bloqueos" className="font-bold text-steel underline">Bloqueos</a>.
      </p>

      {DAYS.map(({ n, name }) => {
        const blocks = hours.filter((h) => h.weekday === n);
        return (
          <section key={n} className={`${card} flex flex-col gap-3`}>
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-3xl tracking-wide">{name}</h2>
              {blocks.length === 0 && <span className="font-bold text-smoke">Cerrado</span>}
            </div>

            {blocks.map((b) => (
              <ActionForm
                key={b.id}
                action={deleteWorkingBlock.bind(null, b.id)}
                successText=""
                confirmText={`¿Quitar el tramo ${hhmm(b.start_time)}–${hhmm(b.end_time)} del ${name.toLowerCase()}?`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-bone px-3 py-2"
              >
                <span className="font-display text-2xl tracking-wide">
                  {hhmm(b.start_time)} – {hhmm(b.end_time)}
                </span>
                <SubmitButton pendingText="…" className="font-bold text-barber underline">
                  Quitar
                </SubmitButton>
              </ActionForm>
            ))}

            <ActionForm
              action={addWorkingBlock.bind(null, n)}
              successText=""
              resetOnSuccess
              className="flex flex-wrap items-end gap-2"
            >
              <label className="flex flex-col gap-1">
                <span className="text-sm font-bold">Desde</span>
                <input type="time" name="start" required step={900} className={`${input} w-32 py-2`} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-bold">Hasta</span>
                <input type="time" name="end" required step={900} className={`${input} w-32 py-2`} />
              </label>
              <SubmitButton className="rounded-lg border-2 border-ink px-4 py-2.5 font-bold hover:bg-bone disabled:opacity-60">
                + Agregar tramo
              </SubmitButton>
            </ActionForm>
          </section>
        );
      })}
    </>
  );
}
