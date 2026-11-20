import Link from "next/link";
import { siteConfig } from "@/config/site";
import { formatPhone } from "@/lib/format";

/** Minimal footer. The full version (address, map, social) comes later. */
export function SiteFooter() {
  return (
    <footer className="mt-8 bg-ink text-bone/80">
      <div className="mx-auto flex max-w-xl flex-col items-center gap-2 px-4 py-6 text-center text-sm">
        <p className="font-display text-xl tracking-wider text-bone">{siteConfig.name}</p>
        <p>{siteConfig.location}</p>
        {siteConfig.phone && (
          <a href={`tel:+${siteConfig.phone}`} className="underline underline-offset-2">
            {formatPhone(siteConfig.phone)}
          </a>
        )}
        <nav className="mt-2 flex gap-4 text-bone/60">
          <Link href="/privacidad" className="hover:text-bone">
            Privacidad
          </Link>
          {/* Discreet access for the barber; security is the login, not hiding the link. */}
          <Link href="/admin" className="hover:text-bone">
            Acceso barbería
          </Link>
        </nav>
      </div>
    </footer>
  );
}
