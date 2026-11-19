import { siteConfig } from "@/config/site";

/**
 * America/Coyhaique is recent (2025). Older phones/browsers may not know it and
 * would throw, so fall back to zones with the same rule (UTC-3, no DST).
 */
function resolveTimeZone(): string {
  for (const tz of [siteConfig.timeZone, "America/Punta_Arenas", "Etc/GMT+3"]) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: tz });
      return tz;
    } catch {
      // not supported by this runtime, try the next one
    }
  }
  return "UTC";
}

export const TIME_ZONE = resolveTimeZone();
const LOCALE = siteConfig.locale;

const keyFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const timeFmt = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const longDayFmt = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
});
const weekdayFmt = new Intl.DateTimeFormat(LOCALE, { timeZone: TIME_ZONE, weekday: "short" });
const monthFmt = new Intl.DateTimeFormat(LOCALE, { timeZone: TIME_ZONE, month: "short" });

/** A local calendar day, "YYYY-MM-DD", in the barbershop's time zone. */
export type DayKey = string;

export function dayKey(date: Date | string): DayKey {
  return keyFmt.format(new Date(date));
}

/**
 * Noon UTC of a day: falls on the same calendar day in every zone between
 * UTC-11 and UTC+11, so it's a safe instant to format a DayKey with.
 */
function noonOf(key: DayKey): Date {
  return new Date(`${key}T12:00:00Z`);
}

export function addDays(key: DayKey, days: number): DayKey {
  const d = noonOf(key);
  d.setUTCDate(d.getUTCDate() + days);
  return dayKey(d);
}

/** "10:00" */
export function formatTime(date: Date | string): string {
  return timeFmt.format(new Date(date));
}

/** "Lunes, 23 de noviembre" (only the first letter capitalised, as in Spanish). */
export function formatLongDay(day: DayKey | Date | string): string {
  const d = typeof day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(day) ? noonOf(day) : new Date(day);
  const text = longDayFmt.format(d);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** { weekday: "lun", day: "23", month: "nov" } */
export function dayParts(key: DayKey) {
  const d = noonOf(key);
  return {
    weekday: weekdayFmt.format(d).replace(".", ""),
    day: String(Number(key.slice(8, 10))),
    month: monthFmt.format(d).replace(".", ""),
  };
}
