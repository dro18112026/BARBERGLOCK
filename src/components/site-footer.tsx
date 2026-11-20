import Link from "next/link";
import { InstagramIcon, PhoneIcon, WhatsAppIcon } from "@/components/brand-icons";
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

        {phone && (
          <a href={`tel:+${phone}`} className={`${link} inline-flex items-center gap-2`}>
            <PhoneIcon className="h-4 w-4" />
            {formatPhone(phone)}
          </a>
        )}

        {/* Social buttons: brand colours on round badges so they're recognised at a glance. */}
        <div className="flex justify-center gap-4">
          {phone && (
            <a
              href={`https://wa.me/${phone}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Escríbenos por WhatsApp"
              className="flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366] text-white transition-transform hover:scale-105"
            >
              <WhatsAppIcon className="h-7 w-7" />
            </a>
          )}
          {social.instagram && (
            <a
              href={social.instagram}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Instagram ${social.instagramHandle}`}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-[radial-gradient(circle_at_30%_107%,#fdf497_0%,#fdf497_5%,#fd5949_45%,#d6249f_60%,#285AEB_90%)] text-white transition-transform hover:scale-105"
            >
              <InstagramIcon className="h-6 w-6" />
            </a>
          )}
        </div>
        {social.instagram && <p className="text-sm text-bone/60">{social.instagramHandle}</p>}

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
