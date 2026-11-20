import "server-only";
import { createClient } from "@/lib/supabase/server";

const DAY_NAMES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Monday first

export type HoursLine = { days: string; hours: string };

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Weekly hours as human lines, grouping consecutive days with the same blocks:
 * [{ days: "Lunes a sábado", hours: "10:00–14:00 y 14:30–19:00" }]
 * Comes from the working_hours table, so it follows edits in the panel.
 */
export async function getOpeningHours(): Promise<HoursLine[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("working_hours")
    .select("weekday, start_time, end_time")
    .order("start_time");
  if (error || !data) return [];

  const signature = (day: number) =>
    data
      .filter((h) => h.weekday === day)
      .map((h) => `${h.start_time.slice(0, 5)}–${h.end_time.slice(0, 5)}`)
      .join(" y ");

  const lines: HoursLine[] = [];
  let groupStart = -1;
  for (let i = 0; i <= WEEK_ORDER.length; i++) {
    const sig = i < WEEK_ORDER.length ? signature(WEEK_ORDER[i]) : null;
    const prev = groupStart >= 0 ? signature(WEEK_ORDER[groupStart]) : null;
    if (groupStart >= 0 && sig !== prev) {
      if (prev) {
        const first = DAY_NAMES[WEEK_ORDER[groupStart]];
        const last = DAY_NAMES[WEEK_ORDER[i - 1]];
        lines.push({
          days: cap(groupStart === i - 1 ? first : i - 1 - groupStart === 1 ? `${first} y ${last}` : `${first} a ${last}`),
          hours: prev,
        });
      }
      groupStart = -1;
    }
    if (groupStart < 0 && sig) groupStart = i;
  }
  return lines;
}
