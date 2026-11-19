import { siteConfig } from "@/config/site";
import { formatPhone } from "@/lib/format";

/** "¿Prefieres llamar? +56 9 …" — tappable phone link. Renders nothing if no phone is set. */
export function CallUs({ label = "¿Prefieres llamar?" }: { label?: string }) {
  if (!siteConfig.phone) return null;
  return (
    <p className="text-center text-smoke">
      {label}{" "}
      <a
        href={`tel:+${siteConfig.phone}`}
        className="whitespace-nowrap font-bold text-steel underline underline-offset-2"
      >
        {formatPhone(siteConfig.phone)}
      </a>
    </p>
  );
}
