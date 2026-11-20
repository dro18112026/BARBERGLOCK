import Link from "next/link";
import { maps, siteConfig } from "@/config/site";
import { formatPhone } from "@/lib/format";

const link = "underline underline-offset-2 hover:text-bone";

export function SiteFooter() {
  const { address, social, phone } = siteConfig;
  return (
    <footer className="mt-8 bg-ink text-bone/80">
      <div className="mx-auto flex max-w-xl flex-col items-center gap-3 px-4 py-8 text-center">
        <p className="font-display text-2xl tracking-wider text-bone">{siteConfig.name}</p>

        <address className="not-italic">
          <a href={maps.directions} target="_blank" rel="noopener noreferrer" className={link}>
            {address.street}, {address.city}
          </a>
        </address>

        <div className="flex flex-wrap justify-center gap-x-5 gap-y-2">
          {phone && (
            <a href={`tel:+${phone}`} className={link}>
              📞 {formatPhone(phone)}
            </a>
          )}
          {phone && (
            <a href={`https://wa.me/${phone}`} target="_blank" rel="noopener noreferrer" className={link}>
              💬 WhatsApp
            </a>
          )}
          {social.instagram && (
            <a href={social.instagram} target="_blank" rel="noopener noreferrer" className={link}>
              📷 Instagram {social.instagramHandle}
            </a>
          )}
        </div>

        <nav className="mt-2 flex gap-4 text-sm text-bone/60">
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
