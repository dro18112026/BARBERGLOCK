import "server-only";
import webpush from "web-push";
import { addDays, dayKey, formatLongDay, formatTime } from "@/lib/datetime";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Web Push to the panel (barber's phone). Subscriptions are created in
 * Panel → Mi cuenta; this module sends to them with the VAPID keys from the
 * environment. Every send is best-effort: a failure is logged and never
 * breaks the customer's booking or cancellation.
 */

export type PushPayload = {
  title: string;
  body: string;
  /** Page opened when the notification is tapped. */
  url: string;
  /** Same tag = replaces the previous notification instead of stacking. */
  tag?: string;
};

type Subscription = { id: string; endpoint: string; p256dh: string; auth: string };

let configured: boolean | null = null;

export function isPushConfigured(): boolean {
  if (configured !== null) return configured;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return (configured = false);
  const subject =
    process.env.VAPID_SUBJECT || process.env.NEXT_PUBLIC_SITE_URL || "https://localhost";
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return (configured = true);
}

/** Sends to the given devices; forgets the ones the push service says are gone. */
async function sendTo(subs: Subscription[], payload: PushPayload, ttlSeconds: number) {
  if (!subs.length) {
    console.info(`push "${payload.title}": no devices`);
    return { sent: 0, failed: 0 };
  }
  const supabase = createAdminClient();
  const body = JSON.stringify(payload);
  let sent = 0;
  let failed = 0;

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
          { TTL: ttlSeconds, urgency: "high", timeout: 8000 },
        );
        sent++;
      } catch (error) {
        failed++;
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          // Uninstalled app, revoked permission or expired subscription.
          await supabase.from("push_subscriptions").delete().eq("id", s.id);
        } else {
          console.error("push send failed:", status, (error as Error).message);
        }
      }
    }),
  );
  console.info(`push "${payload.title}": ${sent} sent, ${failed} failed`);
  return { sent, failed };
}

/** Devices of everyone who currently has panel access. */
async function staffDevices(): Promise<Subscription[]> {
  const supabase = createAdminClient();
  const [staffResult, subsResult] = await Promise.all([
    supabase.from("staff").select("user_id"),
    supabase.from("push_subscriptions").select("id, endpoint, p256dh, auth, user_id"),
  ]);
  const error = staffResult.error ?? subsResult.error;
  if (error) {
    console.error("push: could not read staff devices:", error.message);
    return [];
  }
  const staff = staffResult.data;
  const subs = subsResult.data;
  const allowed = new Set((staff ?? []).map((s) => s.user_id));
  return (subs ?? []).filter((s) => allowed.has(s.user_id));
}

export async function notifyStaff(payload: PushPayload, ttlSeconds = 24 * 60 * 60) {
  if (!isPushConfigured()) return { sent: 0, failed: 0 };
  return sendTo(await staffDevices(), payload, ttlSeconds);
}

export async function notifyUser(userId: string, payload: PushPayload) {
  if (!isPushConfigured()) return { sent: 0, failed: 0 };
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);
  return sendTo(data ?? [], payload, 60 * 60);
}

/**
 * Runs a notification without letting it break the caller: errors are
 * swallowed, and it waits at most `ms`.
 *
 * The wait has to be generous: on a serverless host the function is frozen
 * as soon as the response is sent, so a send still in flight is lost. A cold
 * start (DB queries + TLS to Apple/Google) can take several seconds; 4 s was
 * not enough in production.
 */
export async function bestEffort(task: Promise<unknown>, ms = 10_000): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timedOut = await Promise.race([
      task.then(() => false),
      new Promise<boolean>((resolve) => {
        timer = setTimeout(() => resolve(true), ms);
      }),
    ]);
    if (timedOut) console.error(`push notification still pending after ${ms} ms`);
  } catch (error) {
    console.error("push notification failed:", error);
  } finally {
    clearTimeout(timer);
  }
}

// --- Messages (Spanish, as the barber reads them) ---------------------------------

/** "hoy 16:00", "mañana 16:00", "jueves 3 de diciembre, 16:00". */
export function whenLabel(startsAt: string): string {
  const day = dayKey(startsAt);
  const today = dayKey(new Date());
  const time = formatTime(startsAt);
  if (day === today) return `hoy ${time}`;
  if (day === addDays(today, 1)) return `mañana ${time}`;
  return `${formatLongDay(startsAt)}, ${time}`;
}

const agendaUrl = (startsAt: string) => `/admin?fecha=${dayKey(startsAt)}&vista=dia`;

type ApptInfo = { id?: string; customerName: string; serviceName: string; startsAt: string };

export function newBookingMessage(a: ApptInfo): PushPayload {
  return {
    title: "Nueva reserva",
    body: `${a.customerName} · ${a.serviceName}\n${whenLabel(a.startsAt)}`,
    url: agendaUrl(a.startsAt),
    tag: a.id ? `appt-${a.id}` : undefined,
  };
}

export function cancelledMessage(a: ApptInfo): PushPayload {
  return {
    title: "Reserva cancelada",
    body: `${a.customerName} canceló: ${a.serviceName}\n${whenLabel(a.startsAt)}`,
    url: agendaUrl(a.startsAt),
    tag: a.id ? `appt-${a.id}` : undefined,
  };
}

export function reminderMessage(a: ApptInfo): PushPayload {
  const minutes = Math.max(1, Math.round((Date.parse(a.startsAt) - Date.now()) / 60000));
  return {
    title: `En ${minutes} min: ${a.serviceName}`,
    body: `${a.customerName} · ${formatTime(a.startsAt)}`,
    url: agendaUrl(a.startsAt),
    tag: a.id ? `reminder-${a.id}` : undefined,
  };
}
