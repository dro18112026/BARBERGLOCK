import type { Metadata } from "next";
import Link from "next/link";
import { CallUs } from "@/components/call-us";
import { card, stepTitle } from "@/components/ui";
import { getServices, getSlots, isUuid } from "@/lib/booking/data";
import { dayKey } from "@/lib/datetime";
import { formatCLP } from "@/lib/format";
import { BookingFlow } from "./booking-flow";

export const metadata: Metadata = { title: "Reservar hora" };

export default async function ReservarPage({ searchParams }: PageProps<"/reservar">) {
  const { servicio } = await searchParams;
  const services = await getServices();
  const selected =
    isUuid(servicio) ? (services.find((s) => s.id === servicio) ?? null) : null;
  const slots = selected ? await getSlots(selected.id) : [];

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-6">
      <h1 className="font-display text-5xl leading-none tracking-wide">Reserva tu hora</h1>

      {/* Step 1 — service */}
      <section aria-labelledby="paso-servicio" className="flex flex-col gap-3">
        <h2 id="paso-servicio" className={stepTitle}>
          1. Elige el servicio
        </h2>

        {selected ? (
          <div className={`${card} flex items-center justify-between gap-4 border-2 border-ink`}>
            <div>
              <p className="font-display text-3xl tracking-wide">{selected.name}</p>
              <p className="text-smoke">
                {selected.duration_min} min ·{" "}
                <span className="font-display text-xl tracking-wide text-ink">
                  {formatCLP(selected.price_clp)}
                </span>
              </p>
            </div>
            <Link
              href="/reservar"
              className="shrink-0 font-bold text-steel underline underline-offset-2"
            >
              Cambiar
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {services.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/reservar?servicio=${s.id}`}
                  scroll={false}
                  className={`${card} flex items-center justify-between gap-4 transition-colors hover:border-ink`}
                >
                  <div>
                    <p className="font-display text-3xl tracking-wide">{s.name}</p>
                    {s.description && <p className="text-smoke">{s.description}</p>}
                    <p className="text-smoke">{s.duration_min} min</p>
                  </div>
                  <span className="font-display text-3xl tracking-wide">
                    {formatCLP(s.price_clp)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Steps 2–4 — day, time, details */}
      {selected && (
        <BookingFlow key={selected.id} service={selected} slots={slots} today={dayKey(new Date())} />
      )}

      <CallUs />
    </main>
  );
}
