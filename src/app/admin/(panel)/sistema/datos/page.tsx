import type { Metadata } from "next";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { btnSecondary, card } from "@/components/ui";
import { requireSuperadmin } from "@/lib/auth";
import { purgeNow } from "./actions";

export const metadata: Metadata = { title: "Datos" };

export default async function DatosPage() {
  await requireSuperadmin();

  return (
    <>
      <section className={`${card} flex flex-col gap-3`}>
        <h2 className="font-display text-3xl tracking-wide">Exportar citas</h2>
        <p>
          Descarga todas las citas en un archivo CSV que se abre con Excel o Google Sheets. Incluye
          nombres y teléfonos: guárdalo en un lugar seguro.
        </p>
        {/* Plain link: a file download, not a page. */}
        <a href="/admin/sistema/datos/export" className={btnSecondary}>
          Descargar citas (CSV)
        </a>
      </section>

      <section className={`${card} flex flex-col gap-3`}>
        <h2 className="font-display text-3xl tracking-wide">Datos personales antiguos</h2>
        <p>
          Todos los días, automáticamente, se borran el nombre, el teléfono y la nota de las citas
          de hace más de <strong>12 meses</strong>, y el historial de cambios de ese período. Las
          citas quedan como &quot;Anónimo&quot; para no perder las estadísticas.
        </p>
        <p className="text-smoke">
          Si un cliente pide que borren sus datos antes, puedes editar su cita y cambiar el nombre
          y teléfono, o ejecutar el borrado ahora.
        </p>
        <ActionForm
          action={purgeNow}
          confirmText="¿Borrar ahora los datos personales de las citas de hace más de 12 meses? No se puede deshacer."
          className="flex flex-col gap-2"
        >
          <SubmitButton pendingText="Borrando…" className={`${btnSecondary} border-barber text-barber`}>
            Ejecutar borrado ahora
          </SubmitButton>
        </ActionForm>
      </section>
    </>
  );
}
