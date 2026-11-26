"use client";

import { useEffect, useState } from "react";
import { btnPrimary, btnSecondary } from "@/components/ui";
import { removePushSubscription, savePushSubscription, sendTestPush } from "./actions";

type Status =
  | "checking"
  | "dev" // service worker only runs in the published app
  | "not-configured" // no VAPID public key on the server
  | "unsupported"
  | "install" // iPhone/iPad: only works from the app on the home screen
  | "denied"
  | "off"
  | "on";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

const isIos = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

async function registration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration("/");
  return existing ?? navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

async function save(sub: PushSubscription) {
  const json = sub.toJSON();
  return savePushSubscription({
    endpoint: sub.endpoint,
    keys: { p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" },
    userAgent: navigator.userAgent,
  });
}

function initialStatus(): Status {
  if (process.env.NODE_ENV !== "production") return "dev";
  if (!PUBLIC_KEY) return "not-configured";
  const supported =
    "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (!supported) return isIos() && !isStandalone() ? "install" : "unsupported";
  if (Notification.permission === "denied") return "denied";
  return "checking";
}

export function PushNotifications() {
  const [status, setStatus] = useState<Status>("checking");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  // Find out whether this device is already subscribed (and re-sync it with the
  // server: the phone may have been used with another account).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const first = initialStatus();
      if (first !== "checking") {
        if (!cancelled) setStatus(first);
        return;
      }
      try {
        const reg = await registration();
        const sub = await reg.pushManager.getSubscription();
        if (sub && Notification.permission === "granted") {
          await save(sub);
          if (!cancelled) setStatus("on");
        } else if (!cancelled) {
          setStatus("off");
        }
      } catch {
        if (!cancelled) setStatus("unsupported");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    setMessage(null);
    setBusy(true);
    try {
      // First thing in the tap handler: iPhone only shows the prompt from a direct tap.
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await registration();
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyBytes(PUBLIC_KEY),
        }));
      const result = await save(sub);
      if (!result.ok) {
        setMessage({ text: result.error ?? "No se pudo activar.", error: true });
        return;
      }
      setStatus("on");
      setMessage({ text: "Listo, este dispositivo recibirá los avisos.", error: false });
    } catch (error) {
      console.error("push subscribe failed:", error);
      setMessage({ text: "No se pudieron activar los avisos en este dispositivo.", error: true });
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setMessage(null);
    setBusy(true);
    try {
      const reg = await registration();
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setStatus("off");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setMessage(null);
    setBusy(true);
    try {
      const r = await sendTestPush();
      setMessage(
        r.ok
          ? { text: "Aviso de prueba enviado. Debería llegarte en unos segundos.", error: false }
          : { text: r.error ?? "No se pudo enviar.", error: true },
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-lg">Recibe en este celular un aviso cuando:</p>
      <ul className="list-disc pl-6 text-lg">
        <li>un cliente reserva una hora,</li>
        <li>un cliente cancela su hora,</li>
        <li>falten 30 minutos para una cita.</li>
      </ul>

      {status === "checking" && <p className="text-smoke">Revisando este dispositivo…</p>}

      {status === "dev" && (
        <p className="text-smoke">Los avisos solo funcionan en la versión publicada de la app.</p>
      )}

      {status === "not-configured" && (
        <p className="text-smoke">
          Los avisos todavía no están configurados en el servidor. Avísale al administrador del
          sistema.
        </p>
      )}

      {status === "install" && (
        <p className="text-lg">
          En iPhone, los avisos solo funcionan desde la app <strong>Panel</strong> instalada en la
          pantalla de inicio. Instálala (Compartir → <strong>Agregar a inicio</strong>), ábrela
          desde ahí y vuelve a esta página.
        </p>
      )}

      {status === "unsupported" && (
        <p className="text-lg">
          Este navegador no permite avisos. Prueba desde Chrome en Android o desde la app Panel
          instalada en el iPhone.
        </p>
      )}

      {status === "denied" && (
        <p className="text-lg">
          Los avisos están <strong>bloqueados</strong> para esta app. Actívalos en los ajustes del
          celular (Ajustes → Notificaciones → Panel, o en los permisos del sitio en Chrome) y
          vuelve a abrir esta página.
        </p>
      )}

      {status === "off" && (
        <button type="button" disabled={busy} onClick={enable} className={btnPrimary}>
          {busy ? "Activando…" : "Activar avisos en este celular"}
        </button>
      )}

      {status === "on" && (
        <>
          <p className="text-lg">
            ✅ <strong>Activados</strong> en este dispositivo.
          </p>
          <button type="button" disabled={busy} onClick={test} className={btnSecondary}>
            Enviar aviso de prueba
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={disable}
            className="font-bold text-steel underline underline-offset-2"
          >
            Desactivar avisos en este celular
          </button>
        </>
      )}

      {message && (
        <p role={message.error ? "alert" : "status"} className={`font-bold ${message.error ? "text-barber" : "text-steel"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
