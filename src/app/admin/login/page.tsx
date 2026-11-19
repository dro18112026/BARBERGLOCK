import type { Metadata } from "next";
import { card } from "@/components/ui";
import { signOut } from "./actions";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Ingresar",
  robots: { index: false, follow: false },
};

export default async function LoginPage({ searchParams }: PageProps<"/admin/login">) {
  const { error } = await searchParams;

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
      </div>
    </main>
  );
}
