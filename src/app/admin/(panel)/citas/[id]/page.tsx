import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAllServices, getAppointmentById } from "@/lib/admin/data";
import { requireAdmin } from "@/lib/auth";
import { isUuid } from "@/lib/booking/data";
import { dayKey, formatTime } from "@/lib/datetime";
import { saveAppointment } from "../actions";
import { AppointmentForm } from "../appointment-form";

export const metadata: Metadata = { title: "Editar cita" };

export default async function EditAppointmentPage({ params }: PageProps<"/admin/citas/[id]">) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { supabase } = await requireAdmin();
  const [appt, services] = await Promise.all([
    getAppointmentById(supabase, id),
    getAllServices(supabase),
  ]);
  if (!appt) notFound();

  return (
    <>
      <h1 className="font-display text-5xl leading-none tracking-wide">Editar cita</h1>
      <AppointmentForm
        action={saveAppointment.bind(null, id)}
        services={services}
        showStatus
        defaults={{
          serviceId: appt.service_id,
          date: dayKey(appt.starts_at),
          time: formatTime(appt.starts_at),
          name: appt.customer_name,
          phone: appt.customer_phone,
          notes: appt.notes,
          status: appt.status,
        }}
        submitLabel="Guardar cambios"
      />
    </>
  );
}
