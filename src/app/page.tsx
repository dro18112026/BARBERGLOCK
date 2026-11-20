import Image from "next/image";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { CallUs } from "@/components/call-us";
import { MapEmbed } from "@/components/map-embed";
import { NextAppointment } from "@/components/next-appointment";
import { btnPrimary, btnSecondary, card } from "@/components/ui";
import { maps, siteConfig } from "@/config/site";
import { getServices, type Service } from "@/lib/booking/data";
import { getOpeningHours, type HoursLine } from "@/lib/booking/hours";
import { formatCLP } from "@/lib/format";

async function safe<T>(load: () => Promise<T>): Promise<T | null> {
  try {
    return await load();
  } catch (error) {
    unstable_rethrow(error); // let Next.js internal signals (e.g. dynamic rendering) through
    console.error(error);
    return null; // DB unreachable: still show the page with the phone number
  }
}

export default async function Home() {
  const [services, hours] = await Promise.all([
    safe<Service[]>(getServices),
    safe<HoursLine[]>(getOpeningHours),
  ]);
  const canBook = Boolean(services && services.length > 0);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center gap-8 px-4 py-6">
      {/* Hero: logo, name and the main action, all above the fold on a phone. */}
      <section className="flex w-full flex-col items-center gap-4 text-center">
        <Image
          src={siteConfig.logo.src}
          width={siteConfig.logo.width}
          height={siteConfig.logo.height}
          alt={siteConfig.logo.alt}
          priority
          className="w-44 sm:w-60"
        />
        <div>
          <h1 className="font-display text-5xl leading-none tracking-wide">Reserva tu hora</h1>
          <p className="mt-1 text-lg text-smoke">{siteConfig.tagline}</p>
        </div>

        <NextAppointment />

        {canBook ? (
          <Link href="/reservar" className={btnPrimary}>
            Reservar hora
          </Link>
        ) : (
          <p className={`${card} text-lg`}>
            Las reservas en línea no están disponibles en este momento.
          </p>
        )}
        <CallUs />
      </section>

      {canBook && (
        <section aria-labelledby="servicios" className="flex w-full flex-col gap-3">
          <h2 id="servicios" className="font-display text-3xl tracking-wide">Servicios</h2>
          <ul className="flex flex-col gap-3">
            {services!.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/reservar?servicio=${s.id}`}
                  className={`${card} group flex items-center justify-between gap-4 transition-colors hover:border-ink`}
                >
                  <div>
                    <p className="font-display text-3xl tracking-wide">{s.name}</p>
                    {s.description && <p className="text-smoke">{s.description}</p>}
                    <p className="text-smoke">{s.duration_min} minutos</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end">
                    <span className="font-display text-3xl tracking-wide">{formatCLP(s.price_clp)}</span>
                    <span className="font-bold text-barber group-hover:underline">Reservar →</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {hours && hours.length > 0 && (
        <section aria-labelledby="horario" className={`${card} flex w-full flex-col gap-2`}>
          <h2 id="horario" className="font-display text-3xl tracking-wide">Horario</h2>
          <dl className="flex flex-col gap-1 text-lg">
            {hours.map((h) => (
              <div key={h.days} className="flex flex-wrap justify-between gap-x-4">
                <dt className="font-bold">{h.days}</dt>
                <dd>{h.hours}</dd>
              </div>
            ))}
          </dl>
          <p className="text-smoke">Feriados y vacaciones se ven directo al reservar.</p>
        </section>
      )}

      <section aria-labelledby="ubicacion" className="flex w-full flex-col gap-3">
        <h2 id="ubicacion" className="font-display text-3xl tracking-wide">Dónde estamos</h2>
        <p className="text-lg">
          <strong>{siteConfig.address.street}</strong>, {siteConfig.address.city},{" "}
          {siteConfig.address.region}
        </p>
        {siteConfig.storefrontPhoto && (
          <Image
            src={siteConfig.storefrontPhoto.src}
            width={siteConfig.storefrontPhoto.width}
            height={siteConfig.storefrontPhoto.height}
            alt={`Fachada de ${siteConfig.name}`}
            className="w-full rounded-lg"
          />
        )}
        <MapEmbed />
        <a href={maps.directions} target="_blank" rel="noopener noreferrer" className={btnSecondary}>
          Cómo llegar
        </a>
      </section>
    </main>
  );
}
