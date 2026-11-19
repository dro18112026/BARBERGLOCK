import Link from "next/link";
import { siteConfig } from "@/config/site";

export function SiteHeader() {
  return (
    <header className="bg-ink text-bone">
      <div className="mx-auto flex max-w-xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="font-display text-2xl tracking-wider">
          {siteConfig.name}
        </Link>
        <span className="text-right text-sm text-bone/70">{siteConfig.location}</span>
      </div>
    </header>
  );
}
