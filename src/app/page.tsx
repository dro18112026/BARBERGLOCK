import Image from "next/image";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { CallUs } from "@/components/call-us";
import { btnPrimary, card } from "@/components/ui";
import { siteConfig } from "@/config/site";
import { getServices, type Service } from "@/lib/booking/data";
import { formatCLP } from "@/lib/format";

async function loadServices(): Promise<Service[] | null> {
  try {
    return await getServices();
  } catch (error) {
    unstable_rethrow(error); // let Next.js internal signals (e.g. dynamic rendering) through
    console.error(error);
    return null; // DB unreachable: still show the page with the phone number
  }
}

export default async function Home() {
  const services = await loadServices();

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center gap-8 px-4 py-8">
      <Image
        src={siteConfig.logo.src}
        width={siteConfig.logo.width}
        height={siteConfig.logo.height}
        alt={siteConfig.logo.alt}
        priority
        className="w-64 sm:w-80"
      />

      <div className="text-center">
        <h1 className="font-display text-5xl leading-none tracking-wide">Reserva tu hora</h1>
        <p className="mt-2 text-lg text-smoke">{siteConfig.tagline}</p>
        <p className="text-smoke">Lunes a sábado · 10:00 a 19:00</p>
      </div>

      {services && services.length > 0 ? (
        <>
          <ul className="flex w-full flex-col gap-3">
            {services.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/reservar?servicio=${s.id}`}
                  className={`${card} flex items-center justify-between gap-4 transition-colors hover:border-ink`}
                >
                  <div>
                    <p className="font-display text-3xl tracking-wide">{s.name}</p>
                    <p className="text-smoke">{s.duration_min} minutos</p>
                  </div>
                  <span className="font-display text-3xl tracking-wide">
                    {formatCLP(s.price_clp)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/reservar" className={btnPrimary}>
            Reservar hora
          </Link>
        </>
      ) : (
        <p className={`${card} text-center text-lg`}>
          Las reservas en línea no están disponibles en este momento.
        </p>
      )}

      <CallUs />
    </main>
  );
}
