import { timingSafeEqual } from "node:crypto";
import { isPushConfigured, notifyStaff, reminderMessage } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";

/** How long before an appointment the reminder goes out. */
const REMINDER_MINUTES = 30;

/**
 * Called every 5 minutes by the database (pg_cron + pg_net, see migration
 * 20261126000001) with `Authorization: Bearer <PUSH_CRON_SECRET>`. Sends the
 * "your appointment is in 30 min" notifications that are due.
 */
export async function POST(request: Request) {
  if (!authorized(request.headers.get("authorization"))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  // Without VAPID keys nothing can be sent: don't mark reminders as sent.
  if (!isPushConfigured()) {
    return Response.json({ error: "push not configured" }, { status: 503 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("claim_push_reminders", {
    p_minutes: REMINDER_MINUTES,
  });
  if (error) {
    console.error("claim_push_reminders failed:", error);
    return Response.json({ error: "database" }, { status: 500 });
  }

  let sent = 0;
  for (const r of data ?? []) {
    const result = await notifyStaff(
      reminderMessage({
        id: r.appointment_id,
        customerName: r.customer_name,
        serviceName: r.service_name,
        startsAt: r.starts_at,
      }),
      // Useless once the appointment has started.
      Math.max(60, Math.floor((Date.parse(r.starts_at) - Date.now()) / 1000)),
    );
    sent += result.sent;
  }

  return Response.json({ reminders: data?.length ?? 0, sent });
}

function authorized(header: string | null): boolean {
  const secret = process.env.PUSH_CRON_SECRET;
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
