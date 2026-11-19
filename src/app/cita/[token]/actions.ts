"use server";

import { refresh } from "next/cache";
import { isUuid } from "@/lib/booking/data";
import { errorCode, errorMessage } from "@/lib/booking/errors";
import { createClient } from "@/lib/supabase/server";

export type CancelState = { error: string | null };

// Used with useActionState(cancelAppointment.bind(null, token)); the previous
// state and form data it also passes are not needed.
export async function cancelAppointment(token: string): Promise<CancelState> {
  if (!isUuid(token)) return { error: errorMessage("NOT_FOUND") };

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_appointment", { p_token: token });

  if (error) {
    const code = errorCode(error.message);
    if (!code) console.error("cancel_appointment failed:", error);
    return { error: errorMessage(code) };
  }

  refresh(); // re-render the page with the cancelled status
  return { error: null };
}
