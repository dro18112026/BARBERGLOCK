"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin/sistema", label: "Estado" },
  { href: "/admin/sistema/reglas", label: "Reglas" },
  { href: "/admin/sistema/usuarios", label: "Usuarios" },
  { href: "/admin/sistema/historial", label: "Historial" },
  { href: "/admin/sistema/datos", label: "Datos" },
];

export function SistemaNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Sistema" className="-mx-4 overflow-x-auto px-4">
      <ul className="flex gap-1 border-b border-smoke/30">
        {LINKS.map(({ href, label }) => {
          const active = href === "/admin/sistema" ? pathname === href : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`-mb-px block whitespace-nowrap border-b-2 px-3 py-2 font-bold ${
                  active ? "border-barber text-ink" : "border-transparent text-smoke hover:text-ink"
                }`}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
