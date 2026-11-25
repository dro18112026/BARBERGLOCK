import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { InstallGuide } from "@/components/install-guide";
import { card } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Ingresar" };

export default async function LoginPage({ searchParams }: PageProps<"/admin/login">) {
  const { error } = await searchParams;

  // Already signed in as staff (e.g. reopening the installed app): go straight to the agenda.
  if (error !== "not_admin") {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    if (data?.claims?.sub) {
      const { data: isAdmin } = await supabase.rpc("is_admin");
      if (isAdmin) redirect("/admin");
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-10">
      <h1 className="font-display text-5xl leading-none tracking-wide">Panel del barbero</h1>

      {error === "not_admin" && (
        <div role="alert" className={`${card} border-2 border-barber`}>
          <p className="text-lg font-bold text-barber">
            Esta cuenta no tiene acceso al panel.
          </p>
          <form action={signOut}>
            <button type="submit" className="mt-2 font-bold text-steel underline">
              Cerrar sesión e ingresar con otra cuenta
            </button>
          </form>
        </div>
      )}

      <div className={card}>
        <LoginForm />
        <Link
          href="/admin/recuperar"
          className="mt-4 block text-center font-bold text-steel underline underline-offset-2"
        >
          ¿Olvidaste tu contraseña?
        </Link>
      </div>

      <InstallGuide appName="Panel" />

      <Link href="/" className="text-center font-bold text-steel underline underline-offset-2">
        Volver al sitio de reservas
      </Link>
    </main>
  );
}
