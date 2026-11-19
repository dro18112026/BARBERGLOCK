"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Agenda" },
  { href: "/admin/servicios", label: "Servicios" },
  { href: "/admin/horario", label: "Horario" },
  { href: "/admin/bloqueos", label: "Bloqueos" },
];

export function AdminNav() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" || pathname.startsWith("/admin/citas") : pathname.startsWith(href);

  return (
    <nav aria-label="Panel" className="w-full sm:w-auto">
      <ul className="grid grid-cols-4 gap-1 sm:flex">
        {LINKS.map(({ href, label }) => (
          <li key={href}>
            <Link
              href={href}
              aria-current={isActive(href) ? "page" : undefined}
              className={`block whitespace-nowrap rounded-md px-1 py-2 text-center text-sm font-bold sm:px-3 sm:text-base ${
                isActive(href) ? "bg-steel text-paper" : "text-steel hover:bg-steel/10"
              }`}
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
