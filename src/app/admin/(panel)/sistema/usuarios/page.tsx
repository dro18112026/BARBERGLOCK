import type { Metadata } from "next";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { card, input } from "@/components/ui";
import { requireSuperadmin } from "@/lib/auth";
import { formatLongDay } from "@/lib/datetime";
import { changeRole, grantAccess, revokeAccess } from "./actions";

export const metadata: Metadata = { title: "Usuarios" };

const ROLE_LABEL = { barber: "Barbero", superadmin: "Administrador" } as const;
const smallBtn = "rounded-md border-2 px-3 py-1.5 text-sm font-bold disabled:opacity-50";

export default async function UsuariosPage() {
  const { supabase, userId } = await requireSuperadmin();
  const { data: staff, error } = await supabase.rpc("staff_list");
  if (error) throw new Error(`staff_list: ${error.message}`);

  return (
    <>
      <section className="flex flex-col gap-3">
        {staff.map((s) => {
          const isMe = s.user_id === userId;
          const other = s.role === "superadmin" ? "barber" : "superadmin";
          return (
            <article key={s.user_id} className={`${card} flex flex-col gap-2`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="break-all text-lg font-bold">
                  {s.email} {isMe && <span className="text-sm font-normal text-smoke">(tú)</span>}
                </p>
                <span className={`rounded-full px-3 py-1 text-sm font-bold ${s.role === "superadmin" ? "bg-barber text-paper" : "bg-ink text-bone"}`}>
                  {ROLE_LABEL[s.role]}
                </span>
              </div>
              <p className="text-sm text-smoke">
                Último ingreso: {s.last_sign_in_at ? formatLongDay(s.last_sign_in_at) : "nunca"} ·
                Verificación en dos pasos: {s.has_2fa ? "✅ activada" : "⚠️ no activada"}
              </p>
              {!isMe && (
                <div className="flex flex-wrap gap-2">
                  <ActionForm action={changeRole.bind(null, s.email, other)} successText="" className="contents">
                    <SubmitButton pendingText="…" className={`${smallBtn} border-ink`}>
                      Cambiar a {ROLE_LABEL[other]}
                    </SubmitButton>
                  </ActionForm>
                  <ActionForm
                    action={revokeAccess.bind(null, s.user_id)}
                    successText=""
                    confirmText={`¿Quitar el acceso al panel a ${s.email}? La cuenta seguirá existiendo, pero no podrá entrar.`}
                    className="contents"
                  >
                    <SubmitButton pendingText="…" className={`${smallBtn} border-barber text-barber`}>
                      Quitar acceso
                    </SubmitButton>
                  </ActionForm>
                </div>
              )}
            </article>
          );
        })}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-3xl tracking-wide">Dar acceso</h2>
        <p className="text-smoke">
          Primero crea la cuenta en Supabase → Authentication → Users (correo y contraseña). Luego
          escribe aquí el mismo correo.
        </p>
        <ActionForm action={grantAccess} successText="Acceso otorgado" resetOnSuccess className={`${card} grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end`}>
          <label className="flex flex-col gap-1">
            <span className="font-bold">Correo</span>
            <input name="email" type="email" required className={input} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-bold">Perfil</span>
            <select name="role" defaultValue="barber" className={input}>
              <option value="barber">Barbero</option>
              <option value="superadmin">Administrador</option>
            </select>
          </label>
          <SubmitButton className="rounded-lg bg-ink px-5 py-3 font-bold text-bone hover:bg-ink/85 disabled:opacity-60">
            Dar acceso
          </SubmitButton>
        </ActionForm>
      </section>
    </>
  );
}
