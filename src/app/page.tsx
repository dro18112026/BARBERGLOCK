import Image from "next/image";
import { siteConfig } from "@/config/site";
import { formatPhone } from "@/lib/format";

// Phase 1 landing: shows the brand system. The booking flow arrives in Phase 3.
export default function Home() {
  return (
    <>
      <header className="bg-ink text-bone">
        <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-3">
          <span className="font-display text-2xl tracking-wider">
            {siteConfig.name}
          </span>
          <span className="text-sm text-bone/70">{siteConfig.location}</span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center gap-8 px-4 py-8">
        <Image
          src={siteConfig.logo.src}
          width={siteConfig.logo.width}
          height={siteConfig.logo.height}
          alt={siteConfig.logo.alt}
          priority
          className="w-64 rounded-sm mix-blend-multiply sm:w-80"
        />

        <div className="text-center">
          <h1 className="font-display text-5xl leading-none tracking-wide">
            Reserva tu hora
          </h1>
          <p className="mt-2 text-lg text-smoke">{siteConfig.tagline}</p>
        </div>

        <section className="w-full rounded-lg border border-smoke/30 bg-paper p-5 shadow-sm">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="font-display text-3xl tracking-wide">Corte</h2>
            {/* Display font for prices: Atkinson's slashed zero reads like a strikethrough. */}
            <span className="font-display text-3xl tracking-wide">$10.000</span>
          </div>
          <p className="mt-1 text-smoke">60 minutos · Lunes a sábado</p>
        </section>

        <button
          type="button"
          disabled
          className="w-full rounded-lg bg-barber px-6 py-4 text-xl font-bold text-paper transition-colors hover:bg-barber-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          Reservas en línea · próximamente
        </button>

        {siteConfig.phone && (
          <p className="text-smoke">
            ¿Prefieres llamar?{" "}
            <a
              href={`tel:+${siteConfig.phone}`}
              className="font-bold text-steel underline underline-offset-2"
            >
              {formatPhone(siteConfig.phone)}
            </a>
          </p>
        )}
      </main>
    </>
  );
}
