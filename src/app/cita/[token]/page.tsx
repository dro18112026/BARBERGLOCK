import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CallUs } from "@/components/call-us";
import { ForgetBooking, RememberBooking } from "@/components/next-appointment";
import { btnPrimary, btnSecondary, card } from "@/components/ui";
import { siteConfig } from "@/config/site";
import { getAppointment } from "@/lib/booking/data";
import { formatLongDay, formatTime } from "@/lib/datetime";
import { formatCLP } from "@/lib/format";
import { CancelForm } from "./cancel-form";

export const metadata: Metadata = {
  title: "Tu reserva",
  robots: { index: false, follow: false }, // private link
};

const STATUS_LABEL = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  cancelled: "Cancelada",
  completed: "Atendida",
  no_show: "No asistió",
} as const;

async function absoluteUrl(path: string): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return new URL(path, configured).toString();
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}${path}`;
}

export default async function CitaPage({ params, searchParams }: PageProps<"/cita/[token]">) {
  const { token } = await params;
  const { nueva } = await searchParams;
  const appt = await getAppointment(token);
  if (!appt) notFound();

  const isActive = appt.status === "confirmed" || appt.status === "pending";
  const day = formatLongDay(appt.starts_at);
  const time = formatTime(appt.starts_at);
  const link = await absoluteUrl(`/cita/${token}`);

  const reminder = `Mi hora en ${siteConfig.name}: ${appt.service_name}, ${day} a las ${time} hrs. Ver o cancelar: ${link}`;
  const toBarber = `Hola, soy ${appt.customer_name}. Reservé ${appt.service_name} el ${day} a las ${time} hrs.`;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-6">
      {/* Remember on this device for "Tu próxima hora" on the home page. */}
      {isActive ? (
        <RememberBooking booking={{ token, startsAt: appt.starts_at, service: appt.service_name }} />
      ) : (
        <ForgetBooking token={token} />
      )}
      {nueva === "1" && isActive ? (
        <div role="status" className="rounded-lg bg-ink p-5 text-center text-bone">
          <p className="font-display text-5xl leading-none tracking-wide">¡Reserva lista!</p>
          <p className="mt-2 text-lg">Te esperamos, {appt.customer_name.split(" ")[0]}.</p>
        </div>
      ) : (
        <h1 className="font-display text-5xl leading-none tracking-wide">Tu reserva</h1>
      )}

      <section className={`${card} flex flex-col gap-1 ${isActive ? "border-2 border-ink" : "opacity-80"}`}>
        <div className="flex items-start justify-between gap-4">
          <p className="font-display text-3xl tracking-wide">{appt.service_name}</p>
          <span
            className={`rounded-full px-3 py-1 text-sm font-bold ${
              isActive ? "bg-ink text-bone" : "bg-smoke/20 text-smoke"
            }`}
          >
            {STATUS_LABEL[appt.status]}
          </span>
        </div>
        <p className={`text-xl ${appt.status === "cancelled" ? "line-through" : ""}`}>
          {day}
        </p>
        <p className={`text-xl ${appt.status === "cancelled" ? "line-through" : ""}`}>
          {time} a {formatTime(appt.ends_at)} hrs
        </p>
        <p className="text-lg text-smoke">
          A nombre de {appt.customer_name} ·{" "}
          <span className="font-display text-xl tracking-wide text-ink">
            {formatCLP(appt.price_clp)}
          </span>
        </p>
        <p className="mt-1 text-smoke">{siteConfig.location}</p>
      </section>

      {isActive && (
        <>
          <section className="flex flex-col gap-3">
            <p className="text-lg">
              <strong>Guarda este link</strong> para ver o cancelar tu hora. Lo más fácil es
              mandártelo por WhatsApp:
            </p>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(reminder)}`}
              target="_blank"
              rel="noopener noreferrer"
              className={btnPrimary}
            >
              Guardar en mi WhatsApp
            </a>
            {siteConfig.phone && (
              <a
                href={`https://wa.me/${siteConfig.phone}?text=${encodeURIComponent(toBarber)}`}
                target="_blank"
                rel="noopener noreferrer"
                className={btnSecondary}
              >
                Escribir a la barbería
              </a>
            )}
          </section>

          <section className="flex flex-col gap-3 border-t border-smoke/30 pt-6">
            {appt.can_cancel ? (
              <CancelForm token={token} />
            ) : (
              <CallUs label="Falta menos de 1 hora. Para cancelar, llámanos:" />
            )}
          </section>
        </>
      )}

      {appt.status === "cancelled" && (
        <Link href="/reservar" className={btnPrimary}>
          Reservar otra hora
        </Link>
      )}

      {isActive && appt.can_cancel && <CallUs />}
    </main>
  );
}
