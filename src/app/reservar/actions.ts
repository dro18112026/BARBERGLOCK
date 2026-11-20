"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { isUuid } from "@/lib/booking/data";
import { errorCode, errorMessage } from "@/lib/booking/errors";
import { allowRequest } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

export type BookingState = { error: string | null; code: string | null };

const field = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();

/** Per-IP booking attempts. Generous for a family sharing Wi-Fi, tight for a bot. */
const BOOKING_LIMITS = [
  { limit: 6, windowSeconds: 60 * 60 },
  { limit: 15, windowSeconds: 24 * 60 * 60 },
];

export async function bookAppointment(
  _prev: BookingState,
  formData: FormData,
): Promise<BookingState> {
  const serviceId = field(formData, "serviceId");
  const startsAt = field(formData, "startsAt");

  // Cheap shape checks; the database enforces every real rule.
  if (!isUuid(serviceId) || Number.isNaN(Date.parse(startsAt))) {
    return { error: errorMessage("INVALID_REQUEST"), code: "INVALID_REQUEST" };
  }

  if (!(await allowRequest("book", BOOKING_LIMITS))) {
    return { error: errorMessage("RATE_LIMITED"), code: "RATE_LIMITED" };
  }

  // book_appointment is only executable by the service role (see migration
  // 20261119000002): the public API can't be used to bypass the limit above.
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("book_appointment", {
    p_service_id: serviceId,
    p_starts_at: startsAt,
    p_customer_name: field(formData, "name").slice(0, 200),
    p_customer_phone: field(formData, "phone").slice(0, 40),
    p_honeypot: field(formData, "website"),
  });

  if (error) {
    const code = errorCode(error.message);
    if (!code) console.error("book_appointment failed:", error);
    // Someone else took the slot: reload the page data so the times list is current.
    if (code === "SLOT_UNAVAILABLE") refresh();
    return { error: errorMessage(code), code };
  }

  const { cancel_token } = data as { cancel_token: string };
  redirect(`/cita/${cancel_token}?nueva=1`);
}
