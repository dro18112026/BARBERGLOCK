"use server";

import { refresh } from "next/cache";
import { isUuid } from "@/lib/booking/data";
import { errorCode, errorMessage } from "@/lib/booking/errors";
import { bestEffort, cancelledMessage, notifyStaff } from "@/lib/push";
import { createClient } from "@/lib/supabase/server";

export type CancelState = { error: string | null };

// Used with useActionState(cancelAppointment.bind(null, token)); the previous
// state and form data it also passes are not needed.
export async function cancelAppointment(token: string): Promise<CancelState> {
  if (!isUuid(token)) return { error: errorMessage("NOT_FOUND") };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cancel_appointment", { p_token: token });

  if (error) {
    const code = errorCode(error.message);
    if (!code) console.error("cancel_appointment failed:", error);
    return { error: errorMessage(code) };
  }

  // Tell the barber's phone that the slot is free again.
  const appt = data as { customer_name: string; service_name: string; starts_at: string } | null;
  if (appt) {
    await bestEffort(
      notifyStaff(
        cancelledMessage({
          customerName: appt.customer_name,
          serviceName: appt.service_name,
          startsAt: appt.starts_at,
        }),
      ),
    );
  }

  refresh(); // re-render the page with the cancelled status
  return { error: null };
}
