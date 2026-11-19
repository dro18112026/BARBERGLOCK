import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import type { AdminAppointment, AppointmentStatus } from "@/lib/admin/data";
import { formatTime } from "@/lib/datetime";
import { setAppointmentStatus } from "./agenda-actions";

export const STATUS: Record<AppointmentStatus, { label: string; className: string }> = {
  pending: { label: "Pendiente", className: "bg-smoke/20 text-ink" },
  confirmed: { label: "Confirmada", className: "bg-ink text-bone" },
  completed: { label: "Atendida", className: "bg-steel text-paper" },
  no_show: { label: "No asistió", className: "bg-barber/15 text-barber" },
  cancelled: { label: "Cancelada", className: "bg-smoke/20 text-smoke" },
};

const smallBtn =
  "rounded-md border-2 px-3 py-1.5 text-sm font-bold transition-colors disabled:opacity-50";

function StatusButton({
  id,
  status,
  label,
  className,
  confirmText,
}: {
  id: string;
  status: AppointmentStatus;
  label: string;
  className: string;
  confirmText?: string;
}) {
  return (
    <ActionForm
      action={setAppointmentStatus.bind(null, id, status)}
      successText=""
      confirmText={confirmText}
      className="contents"
    >
      <SubmitButton pendingText="…" className={`${smallBtn} ${className}`}>
        {label}
      </SubmitButton>
    </ActionForm>
  );
}

export function AppointmentCard({ appt }: { appt: AdminAppointment }) {
  const active = appt.status === "confirmed" || appt.status === "pending";
  const phoneDigits = appt.customer_phone.replace(/\D/g, "");
  const status = STATUS[appt.status];

  return (
    <article
      className={`rounded-lg border bg-paper p-4 shadow-sm ${
        active ? "border-smoke/30" : "border-transparent opacity-70"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`font-display text-3xl leading-none tracking-wide ${appt.status === "cancelled" ? "line-through" : ""}`}>
            {formatTime(appt.starts_at)}–{formatTime(appt.ends_at)}
          </p>
          <p className="mt-1 text-lg font-bold">{appt.customer_name}</p>
          <p className="text-smoke">{appt.service_name}</p>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-bold ${status.className}`}>
          {status.label}
        </span>
      </div>

      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        <a href={`tel:${appt.customer_phone}`} className="font-bold text-steel underline underline-offset-2">
          {appt.customer_phone}
        </a>
        <a
          href={`https://wa.me/${phoneDigits}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-bold text-steel underline underline-offset-2"
        >
          WhatsApp
        </a>
      </p>
      {appt.notes && <p className="mt-2 rounded bg-bone p-2 text-sm">{appt.notes}</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        {active ? (
          <>
            <StatusButton id={appt.id} status="completed" label="Atendida" className="border-steel text-steel hover:bg-steel/10" />
            <StatusButton id={appt.id} status="no_show" label="No asistió" className="border-smoke text-smoke hover:bg-smoke/10" />
            <StatusButton
              id={appt.id}
              status="cancelled"
              label="Cancelar"
              confirmText={`¿Cancelar la cita de ${appt.customer_name}?`}
              className="border-barber text-barber hover:bg-barber/10"
            />
          </>
        ) : (
          <StatusButton id={appt.id} status="confirmed" label="Reactivar" className="border-ink text-ink hover:bg-bone" />
        )}
        <Link href={`/admin/citas/${appt.id}`} className={`${smallBtn} border-ink text-ink hover:bg-bone`}>
          Editar
        </Link>
      </div>
    </article>
  );
}
