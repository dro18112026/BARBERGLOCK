import type { Metadata } from "next";
import { connection } from "next/server";
import { CallUs } from "@/components/call-us";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = { title: "Privacidad" };

/**
 * Plain-language privacy notice. Template: the barbershop should review it
 * (ideally with legal advice) — Chile's Ley 21.719 applies from Dec 2026.
 */
// Rendered per request so its scripts get the CSP nonce (see src/proxy.ts).
export default async function PrivacidadPage() {
  await connection();
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-4 py-8 text-lg leading-relaxed">
      <h1 className="font-display text-5xl leading-none tracking-wide">Privacidad</h1>

      <section>
        <h2 className="font-bold">¿Quién guarda tus datos?</h2>
        <p>
          {siteConfig.name}, {siteConfig.location}. Solo la barbería tiene acceso a ellos.
        </p>
      </section>

      <section>
        <h2 className="font-bold">¿Qué datos pedimos?</h2>
        <p>Tu nombre y tu teléfono, junto con el servicio, el día y la hora que reservas.</p>
      </section>

      <section>
        <h2 className="font-bold">¿Para qué?</h2>
        <p>
          Solo para gestionar tu hora: confirmarla, avisarte si hay cambios y recordártela. No
          enviamos publicidad ni compartimos tus datos con nadie.
        </p>
      </section>

      <section>
        <h2 className="font-bold">¿Por cuánto tiempo?</h2>
        <p>
          Los guardamos mientras sean necesarios para atenderte y como máximo 12 meses después de
          tu cita. Después se borran tu nombre y teléfono.
        </p>
      </section>

      <section>
        <h2 className="font-bold">Tus derechos</h2>
        <p>
          Puedes pedir ver, corregir o borrar tus datos en cualquier momento. Puedes cancelar tu
          hora desde el link de tu reserva, o escribirnos o llamarnos.
        </p>
      </section>

      <section>
        <h2 className="font-bold">Datos técnicos</h2>
        <p>
          Para evitar abusos, el sistema registra por 24 horas una huella cifrada de la conexión
          desde la que se reserva (no tu dirección IP). No usamos cookies de seguimiento ni
          publicidad.
        </p>
        <p className="mt-2">
          Tu celular recuerda el link de tus reservas para mostrarte &quot;Tu próxima hora&quot; en
          la portada. Esa información queda solo en tu dispositivo.
        </p>
        <p className="mt-2">
          El mapa de la portada es de Google Maps y solo se carga si tocas &quot;Ver mapa&quot;; desde
          ese momento aplica la política de privacidad de Google.
        </p>
      </section>

      <CallUs label="Consultas:" />
    </main>
  );
}
