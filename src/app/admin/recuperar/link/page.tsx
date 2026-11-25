import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { btnPrimary, card } from "@/components/ui";
import { confirmReset } from "./actions";

export const metadata: Metadata = { title: "Crear contraseña nueva" };

/**
 * Landing page for the link in the recovery email.
 *
 * The token is only used when the person presses the button (a POST), never on
 * page load: some email services open every link to scan it, and a GET that
 * consumed the one-time token would leave the real click with "link expired".
 */
export default async function RecoveryLinkPage({
  searchParams,
}: PageProps<"/admin/recuperar/link">) {
  const params = await searchParams;
  const tokenHash = typeof params.token_hash === "string" ? params.token_hash : "";
  const code = typeof params.code === "string" ? params.code : "";
  const type = typeof params.type === "string" ? params.type : "recovery";

  // No token (or Supabase already rejected the link and only left an #error).
  if ((!tokenHash && !code) || type !== "recovery") redirect("/admin/recuperar?error=link");

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-10">
      <h1 className="font-display text-5xl leading-none tracking-wide">Contraseña nueva</h1>
      <ActionForm action={confirmReset} successText="" className={`${card} flex flex-col gap-4`}>
        <p className="text-lg">Toca el botón para crear tu contraseña nueva.</p>
        <input type="hidden" name="token_hash" value={tokenHash} />
        <input type="hidden" name="code" value={code} />
        <SubmitButton pendingText="Verificando…" className={btnPrimary}>
          Continuar
        </SubmitButton>
      </ActionForm>
    </main>
  );
}
