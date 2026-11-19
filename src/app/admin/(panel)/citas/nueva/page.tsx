import type { Metadata } from "next";
import { getAllServices } from "@/lib/admin/data";
import { requireAdmin } from "@/lib/auth";
import { dayKey } from "@/lib/datetime";
import { saveAppointment } from "../actions";
import { AppointmentForm } from "../appointment-form";

export const metadata: Metadata = { title: "Nueva cita" };

export default async function NewAppointmentPage({ searchParams }: PageProps<"/admin/citas/nueva">) {
  const { fecha } = await searchParams;
  const { supabase } = await requireAdmin();
  const services = await getAllServices(supabase);
  const date = typeof fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : dayKey(new Date());

  return (
    <>
      <h1 className="font-display text-5xl leading-none tracking-wide">Nueva cita</h1>
      <AppointmentForm
        action={saveAppointment.bind(null, null)}
        services={services}
        defaults={{ date }}
        submitLabel="Guardar cita"
      />
    </>
  );
}
