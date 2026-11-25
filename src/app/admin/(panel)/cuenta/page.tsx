import type { Metadata } from "next";
import Link from "next/link";
import { card } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { TwoFactor } from "./two-factor";

export const metadata: Metadata = { title: "Mi cuenta" };

const ROLE_LABEL = { barber: "Barbero", superadmin: "Administrador del sistema" } as const;

export default async function CuentaPage() {
  const { supabase, role, email } = await requireAdmin();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const verified = factors?.totp?.find((f) => f.status === "verified") ?? null;

  return (
    <>
      <h1 className="font-display text-5xl leading-none tracking-wide">Mi cuenta</h1>

      <section className={`${card} flex flex-col gap-1`}>
        <p className="text-lg font-bold">{email}</p>
        <p className="text-smoke">Perfil: {ROLE_LABEL[role]}</p>
        <Link
          href="/admin/nueva-clave"
          className="mt-2 font-bold text-steel underline underline-offset-2"
        >
          Cambiar contraseña
        </Link>
      </section>

      <section className={`${card} flex flex-col gap-3`}>
        <h2 className="font-display text-3xl tracking-wide">Verificación en dos pasos</h2>
        <TwoFactor enabledFactorId={verified?.id ?? null} />
      </section>
    </>
  );
}
