import "server-only";
import { createClient } from "@/lib/supabase/server";

export type Service = {
  id: string;
  name: string;
  description: string | null;
  duration_min: number;
  price_clp: number;
};

export type Slot = { start: string; end: string };

export type AppointmentView = {
  starts_at: string;
  ends_at: string;
  status: "pending" | "confirmed" | "cancelled" | "completed" | "no_show";
  customer_name: string;
  service_name: string;
  price_clp: number;
  can_cancel: boolean;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/** Active services, in display order. RLS hides inactive ones from the public. */
export async function getServices(): Promise<Service[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("services")
    .select("id, name, description, duration_min, price_clp")
    .eq("active", true)
    .order("sort_order");
  if (error) throw new Error(`getServices: ${error.message}`);
  return data;
}

/** Every free slot for a service across the booking window. */
export async function getSlots(serviceId: string): Promise<Slot[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_available_slots_range", {
    p_service_id: serviceId,
  });
  if (error) throw new Error(`getSlots: ${error.message}`);
  return data.map((s) => ({ start: s.slot_start, end: s.slot_end }));
}

/** The customer's own appointment by the secret token in their link. */
export async function getAppointment(token: string): Promise<AppointmentView | null> {
  if (!isUuid(token)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_appointment", { p_token: token });
  if (error) throw new Error(`getAppointment: ${error.message}`);
  return (data as AppointmentView | null) ?? null;
}

/** Booking window in days (editable by the superadmin in Sistema → Reglas). */
export async function getMaxDaysAhead(): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase.from("booking_settings").select("max_days_ahead").eq("id", true).maybeSingle();
  return data?.max_days_ahead ?? 14;
}
