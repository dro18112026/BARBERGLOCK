import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { signOut } from "../login/actions";
import { AdminNav } from "./admin-nav";

export const metadata: Metadata = {
  title: { default: "Panel", template: "%s · Panel" },
};

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const { email } = await requireAdmin();

  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b border-smoke/30 bg-paper">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2 px-4 py-2">
          <AdminNav />
          <form action={signOut} className="flex items-center gap-2 text-sm text-smoke">
            <span className="hidden sm:inline">{email}</span>
            <button type="submit" className="font-bold text-steel underline underline-offset-2">
              Salir
            </button>
          </form>
        </div>
      </div>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
