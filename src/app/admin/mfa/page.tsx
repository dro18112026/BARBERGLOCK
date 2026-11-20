import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { btnPrimary, card, input } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../login/actions";
import { verifyMfa } from "./actions";

export const metadata: Metadata = { title: "Verificación" };

export default async function MfaPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect("/admin/login");
  const { data: pending } = await supabase.rpc("mfa_pending");
  if (!pending) redirect("/admin");

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-10">
      <h1 className="font-display text-5xl leading-none tracking-wide">Verificación</h1>
      <p className="text-lg">
        Abre tu app de autenticación (Google Authenticator, Microsoft Authenticator, etc.) y
        escribe el código de 6 números de <strong>BARBERGLOCK</strong>.
      </p>
      <ActionForm action={verifyMfa} successText="" className={`${card} flex flex-col gap-4`}>
        <label className="flex flex-col gap-1">
          <span className="text-lg font-bold">Código</span>
          <input
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]{6,7}"
            maxLength={7}
            required
            autoFocus
            className={`${input} text-center font-display text-3xl tracking-[0.3em]`}
          />
        </label>
        <SubmitButton pendingText="Verificando…" className={btnPrimary}>
          Verificar
        </SubmitButton>
      </ActionForm>
      <form action={signOut} className="text-center">
        <button type="submit" className="font-bold text-steel underline">
          Salir
        </button>
      </form>
    </main>
  );
}
