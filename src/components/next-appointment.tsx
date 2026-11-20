"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatLongDay, formatTime } from "@/lib/datetime";

/**
 * "Tu próxima hora": bookings made on this device are remembered in
 * localStorage (only the private link token, the time and the service), so a
 * customer who lost the link can still find, view or cancel it.
 */
const KEY = "barberglock:bookings";

export type SavedBooking = { token: string; startsAt: string; service: string };

function read(): SavedBooking[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as SavedBooking[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function write(list: SavedBooking[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // private mode / storage blocked: the feature just doesn't show
  }
}

/** Called on the booking confirmation page. */
export function RememberBooking({ booking }: { booking: SavedBooking }) {
  useEffect(() => {
    const others = read().filter((b) => b.token !== booking.token);
    write([...others, booking]);
  }, [booking]);
  return null;
}

/** Called when a booking is cancelled, so it stops showing on the home page. */
export function ForgetBooking({ token }: { token: string }) {
  useEffect(() => {
    write(read().filter((b) => b.token !== token));
  }, [token]);
  return null;
}

/** Home page card with the next upcoming booking made on this device. */
export function NextAppointment() {
  const [next, setNext] = useState<SavedBooking | null>(null);

  useEffect(() => {
    const now = Date.now();
    const upcoming = read()
      .filter((b) => new Date(b.startsAt).getTime() > now - 60 * 60_000)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    write(upcoming); // drop past ones
    // Reading localStorage must happen after mount (it doesn't exist on the server).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNext(upcoming[0] ?? null);
  }, []);

  if (!next) return null;
  return (
    <Link
      href={`/cita/${next.token}`}
      className="flex w-full items-center justify-between gap-3 rounded-lg border-2 border-ink bg-paper p-4 shadow-sm"
    >
      <div>
        <p className="text-sm font-bold uppercase tracking-wide text-smoke">Tu próxima hora</p>
        <p className="font-display text-2xl leading-tight tracking-wide">{next.service}</p>
        <p>
          {formatLongDay(next.startsAt)} · {formatTime(next.startsAt)} hrs
        </p>
      </div>
      <span className="shrink-0 font-bold text-steel">Ver →</span>
    </Link>
  );
}
