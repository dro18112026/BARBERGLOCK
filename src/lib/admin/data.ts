import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { addDays, zonedToDate, type DayKey } from "@/lib/datetime";

type Db = SupabaseClient<Database>;

export type AppointmentStatus = Database["public"]["Enums"]["appointment_status"];

export type AdminAppointment = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  customer_name: string;
  customer_phone: string;
  notes: string | null;
  service_id: string;
  service_name: string;
  /** Current price of the service (for the day summary estimate). */
  service_price: number;
};

/** Appointments whose start falls in [from, to) local days. Includes cancelled. */
export async function getAppointmentsForDays(
  supabase: Db,
  from: DayKey,
  toExclusive: DayKey,
): Promise<AdminAppointment[]> {
  const { data, error } = await supabase
    .from("appointments")
    .select("id, starts_at, ends_at, status, customer_name, customer_phone, notes, service_id, services(name, price_clp)")
    .gte("starts_at", zonedToDate(from, "00:00").toISOString())
    .lt("starts_at", zonedToDate(toExclusive, "00:00").toISOString())
    .order("starts_at");
  if (error) throw new Error(`getAppointmentsForDays: ${error.message}`);
  return data.map(({ services, ...a }) => ({
    ...a,
    service_name: services?.name ?? "—",
    service_price: services?.price_clp ?? 0,
  }));
}

export async function getAppointmentById(supabase: Db, id: string) {
  const { data, error } = await supabase
    .from("appointments")
    .select("id, starts_at, ends_at, status, customer_name, customer_phone, notes, service_id")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getAppointmentById: ${error.message}`);
  return data;
}

/** All services, including inactive ones (admin view). */
export async function getAllServices(supabase: Db) {
  const { data, error } = await supabase
    .from("services")
    .select("id, name, description, duration_min, price_clp, active, sort_order")
    .order("sort_order")
    .order("name");
  if (error) throw new Error(`getAllServices: ${error.message}`);
  return data;
}

export async function getDefaultBarberId(supabase: Db): Promise<string | null> {
  const { data } = await supabase
    .from("barbers")
    .select("id")
    .eq("active", true)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

export async function getWorkingHours(supabase: Db) {
  const { data, error } = await supabase
    .from("working_hours")
    .select("id, weekday, start_time, end_time")
    .order("weekday")
    .order("start_time");
  if (error) throw new Error(`getWorkingHours: ${error.message}`);
  return data;
}

/** Time off overlapping [from, to) local days. */
export async function getTimeOff(supabase: Db, from: DayKey, toExclusive: DayKey) {
  const { data, error } = await supabase
    .from("time_off")
    .select("id, starts_at, ends_at, reason")
    .lt("starts_at", zonedToDate(toExclusive, "00:00").toISOString())
    .gt("ends_at", zonedToDate(from, "00:00").toISOString())
    .order("starts_at");
  if (error) throw new Error(`getTimeOff: ${error.message}`);
  return data;
}

/** Upcoming and current time off (ends in the future). */
export async function getUpcomingTimeOff(supabase: Db, today: DayKey) {
  return getTimeOff(supabase, today, addDays(today, 3650));
}

/** "10:00:00" → "10:00" */
export const hhmm = (t: string) => t.slice(0, 5);
