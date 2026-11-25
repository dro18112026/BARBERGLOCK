import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { btnPrimary, card, input } from "@/components/ui";
import { requestReset } from "./actions";

export const metadata: Metadata = { title: "Recuperar contraseña" };

export default async function RecuperarPage({ searchParams }: PageProps<"/admin/recuperar">) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-10">
      <h1 className="font-display text-5xl leading-none tracking-wide">Recuperar contraseña</h1>

      {error === "link" && (
        <div role="alert" className={`${card} border-2 border-barber`}>
          <p className="text-lg font-bold text-barber">Ese link ya no sirve.</p>
          <p className="mt-1">
            Puede que haya vencido (dura 1 hora), que ya se haya usado o que hayas pedido otro
            después. Pide uno nuevo aquí abajo.
          </p>
        </div>
      )}

      <p className="text-lg">
        Escribe el correo con el que entras al panel y te enviaremos un link para crear una
        contraseña nueva.
      </p>

      <ActionForm action={requestReset} className={`${card} flex flex-col gap-4`}>
        <label className="flex flex-col gap-1">
          <span className="text-lg font-bold">Correo</span>
          <input name="email" type="email" required autoComplete="email" className={input} />
        </label>
        <SubmitButton pendingText="Enviando…" className={btnPrimary}>
          Enviar link
        </SubmitButton>
      </ActionForm>

      <Link
        href="/admin/login"
        className="text-center font-bold text-steel underline underline-offset-2"
      >
        Volver a ingresar
      </Link>
    </main>
  );
}
