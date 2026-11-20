"use client";

import Link from "next/link";
import { useActionState, useMemo, useRef, useState } from "react";
import { btnPrimary, card, input, stepTitle } from "@/components/ui";
import type { Service, Slot } from "@/lib/booking/data";
import { addDays, dayKey, dayParts, formatLongDay, formatTime, type DayKey } from "@/lib/datetime";
import { formatCLP } from "@/lib/format";
import { siteConfig } from "@/config/site";
import { bookAppointment, type BookingState } from "./actions";

const initialState: BookingState = { error: null, code: null };

type Props = {
  service: Service;
  slots: Slot[];
  /** Today in the barbershop's time zone, computed on the server (avoids hydration drift). */
  today: DayKey;
};

export function BookingFlow({ service, slots, today }: Props) {
  const [state, formAction, pending] = useActionState(bookAppointment, initialState);

  // Group slots by local day.
  const slotsByDay = useMemo(() => {
    const map = new Map<DayKey, Slot[]>();
    for (const slot of slots) {
      const key = dayKey(slot.start);
      map.set(key, [...(map.get(key) ?? []), slot]);
    }
    return map;
  }, [slots]);

  const days = useMemo(
    () =>
      Array.from({ length: siteConfig.booking.maxDaysAhead + 1 }, (_, i) => addDays(today, i)),
    [today],
  );

  const [pickedDay, setPickedDay] = useState<DayKey | null>(null);
  const [pickedSlot, setPickedSlot] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  // Derived, so a refresh that removes a taken slot/day self-corrects.
  const firstDayWithSlots = days.find((d) => slotsByDay.has(d)) ?? null;
  const day = pickedDay && slotsByDay.has(pickedDay) ? pickedDay : firstDayWithSlots;
  const daySlots = (day && slotsByDay.get(day)) || [];
  const slot = daySlots.find((s) => s.start === pickedSlot) ?? null;

  const timesRef = useRef<HTMLElement>(null);
  const formRef = useRef<HTMLElement>(null);
  const scrollTo = (el: HTMLElement | null) =>
    setTimeout(() => el?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);

  if (!firstDayWithSlots) {
    return (
      <div className={`${card} text-center`}>
        <p className="text-lg">
          No quedan horas disponibles para {service.name.toLowerCase()} en los próximos{" "}
          {siteConfig.booking.maxDaysAhead} días.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Step 2 — day */}
      <section aria-labelledby="paso-dia" className="flex flex-col gap-3">
        <h2 id="paso-dia" className={stepTitle}>
          2. Elige el día
        </h2>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
          {days.map((d) => {
            const count = slotsByDay.get(d)?.length ?? 0;
            const { weekday, day: num, month } = dayParts(d);
            const selected = d === day;
            return (
              <button
                key={d}
                type="button"
                disabled={count === 0}
                aria-pressed={selected}
                aria-label={`${formatLongDay(d)}${count === 0 ? ", sin horas" : `, ${count} horas libres`}`}
                onClick={() => {
                  setPickedDay(d);
                  setPickedSlot(null);
                  scrollTo(timesRef.current);
                }}
                className={`flex flex-col items-center rounded-lg border-2 px-1 py-2 transition-colors disabled:cursor-not-allowed disabled:border-transparent disabled:bg-bone disabled:text-smoke/50 ${
                  selected
                    ? "border-ink bg-ink text-bone"
                    : "border-smoke/30 bg-paper hover:border-ink"
                }`}
              >
                <span className="text-sm capitalize">{weekday}</span>
                <span className="font-display text-3xl leading-none">{num}</span>
                <span className="text-sm">{count === 0 ? "—" : month}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Step 3 — time */}
      <section ref={timesRef} aria-labelledby="paso-hora" className="flex scroll-mt-4 flex-col gap-3">
        <h2 id="paso-hora" className={stepTitle}>
          3. Elige la hora
        </h2>
        {day && <p className="-mt-2 text-lg text-smoke">{formatLongDay(day)}</p>}
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {daySlots.map((s) => {
            const selected = s.start === slot?.start;
            return (
              <button
                key={s.start}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  setPickedSlot(s.start);
                  scrollTo(formRef.current);
                }}
                className={`rounded-lg border-2 py-2 font-display text-3xl tracking-wide transition-colors ${
                  selected
                    ? "border-barber bg-barber text-paper"
                    : "border-smoke/30 bg-paper hover:border-ink"
                }`}
              >
                {formatTime(s.start)}
              </button>
            );
          })}
        </div>
      </section>

      {/* Step 4 — details */}
      {slot && (
        <section ref={formRef} aria-labelledby="paso-datos" className="flex scroll-mt-4 flex-col gap-3">
          <h2 id="paso-datos" className={stepTitle}>
            4. Tus datos
          </h2>

          <div className={`${card} border-2 border-ink`}>
            <p className="font-display text-2xl tracking-wide">{service.name}</p>
            <p className="text-lg">{formatLongDay(slot.start)}</p>
            <p className="text-lg">
              {formatTime(slot.start)} a {formatTime(slot.end)} hrs ·{" "}
              <span className="font-display text-xl tracking-wide">
                {formatCLP(service.price_clp)}
              </span>
            </p>
          </div>

          <form action={formAction} className="flex flex-col gap-4">
            <input type="hidden" name="serviceId" value={service.id} />
            <input type="hidden" name="startsAt" value={slot.start} />

            {/* Honeypot: hidden from people, bots fill it in. */}
            <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
              <label>
                No llenar este campo
                <input type="text" name="website" tabIndex={-1} autoComplete="off" />
              </label>
            </div>

            <label className="flex flex-col gap-1">
              <span className="text-lg font-bold">Nombre</span>
              <input
                name="name"
                required
                minLength={2}
                maxLength={80}
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Juan Pérez"
                className={input}
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-lg font-bold">Teléfono</span>
              <div className="flex items-center gap-2">
                <span className="text-lg text-smoke">+56</span>
                <input
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  required
                  autoComplete="tel-national"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="9 1234 5678"
                  className={input}
                />
              </div>
              <span className="text-sm text-smoke">Solo lo usamos para avisarte si hay cambios.</span>
            </label>

            {state.error && (
              <p role="alert" className="rounded-lg border-2 border-barber bg-barber/10 p-3 text-lg font-bold text-barber">
                {state.error}
              </p>
            )}

            <button type="submit" disabled={pending} className={btnPrimary}>
              {pending ? "Reservando…" : "Confirmar reserva"}
            </button>
            <p className="text-center text-sm text-smoke">
              Usamos tu nombre y teléfono solo para gestionar tu hora.{" "}
              <Link href="/privacidad" target="_blank" className="font-bold text-steel underline">
                Más información
              </Link>
            </p>
          </form>
        </section>
      )}
    </>
  );
}
