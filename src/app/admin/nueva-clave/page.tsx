import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { btnPrimary, card, input } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { updatePassword } from "./actions";
import { MIN_PASSWORD } from "./rules";

export const metadata: Metadata = { title: "Contraseña nueva" };

/**
 * Outside the (panel) layout on purpose: it's where the recovery link lands,
 * before the person has a full panel session. With two-step verification on,
 * the code is asked first (Supabase requires it to change the password).
 */
export default async function NuevaClavePage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect("/admin/login");
  const { data: pending } = await supabase.rpc("mfa_pending");
  if (pending) redirect("/admin/mfa?next=clave");

  const email = data.claims.email as string | undefined;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-10">
      <h1 className="font-display text-5xl leading-none tracking-wide">Contraseña nueva</h1>
      {email && (
        <p className="text-lg">
          Cuenta: <strong>{email}</strong>
        </p>
      )}

      <ActionForm action={updatePassword} className={`${card} flex flex-col gap-4`}>
        <label className="flex flex-col gap-1">
          <span className="text-lg font-bold">Contraseña nueva</span>
          <input
            name="password"
            type="password"
            required
            minLength={MIN_PASSWORD}
            autoComplete="new-password"
            className={input}
          />
          <span className="text-sm text-smoke">Al menos {MIN_PASSWORD} caracteres.</span>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-lg font-bold">Repite la contraseña</span>
          <input
            name="confirm"
            type="password"
            required
            minLength={MIN_PASSWORD}
            autoComplete="new-password"
            className={input}
          />
        </label>
        <SubmitButton className={btnPrimary}>Guardar contraseña</SubmitButton>
      </ActionForm>

      <Link href="/admin" className="text-center font-bold text-steel underline underline-offset-2">
        Ir al panel
      </Link>
    </main>
  );
}
