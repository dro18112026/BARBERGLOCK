import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { signOut } from "../login/actions";
import { AdminNav } from "./admin-nav";
import { AutoRefresh } from "./auto-refresh";

export const metadata: Metadata = {
  title: { default: "Panel", template: "%s · Panel" },
};

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const { email, role } = await requireAdmin();
  const link = "font-bold text-steel underline underline-offset-2";

  return (
    <div className="flex flex-1 flex-col">
      <AutoRefresh />
      <div className="border-b border-smoke/30 bg-paper">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2 px-4 py-2">
          <AdminNav />
          <div className="flex w-full items-center justify-end gap-4 text-sm text-smoke sm:w-auto">
            <span className="mr-auto hidden md:inline">{email}</span>
            <Link href="/admin/reportes" className={link}>
              Reportes
            </Link>
            {role === "superadmin" && (
              <Link href="/admin/sistema" className={`${link} text-barber`}>
                Sistema
              </Link>
            )}
            <Link href="/admin/cuenta" className={link}>
              Mi cuenta
            </Link>
            <form action={signOut}>
              <button type="submit" className={link}>
                Salir
              </button>
            </form>
          </div>
        </div>
      </div>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
