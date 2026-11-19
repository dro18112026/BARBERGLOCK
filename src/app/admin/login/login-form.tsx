"use client";

import { useActionState } from "react";
import { btnPrimary, input } from "@/components/ui";
import { signIn, type LoginState } from "./actions";

const initialState: LoginState = { error: null };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(signIn, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-lg font-bold">Correo</span>
        <input name="email" type="email" required autoComplete="email" className={input} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-lg font-bold">Contraseña</span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className={input}
        />
      </label>
      {state.error && (
        <p role="alert" className="text-lg font-bold text-barber">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className={btnPrimary}>
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
