import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllServices, getAppointmentById } from "@/lib/admin/data";
import { requireAdmin } from "@/lib/auth";
import { isUuid } from "@/lib/booking/data";
import { dayKey, formatTime } from "@/lib/datetime";
import { BlockPhoneForm } from "../../bloqueos/block-phone-form";
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
  const { data: blocked } = await supabase
    .from("blocked_phones")
    .select("phone")
    .eq("phone", appt.customer_phone)
    .maybeSingle();

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

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-3xl tracking-wide">Bloquear este cliente</h2>
        {blocked ? (
          <p className="text-lg">
            Este teléfono ya está bloqueado. Puedes desbloquearlo en{" "}
            <Link href="/admin/bloqueos#telefonos" className="font-bold text-steel underline">
              Bloqueos
            </Link>
            .
          </p>
        ) : (
          <BlockPhoneForm phone={appt.customer_phone} />
        )}
      </section>
    </>
  );
}
