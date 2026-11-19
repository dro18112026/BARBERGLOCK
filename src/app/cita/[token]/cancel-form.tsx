"use client";

import { useActionState, useState } from "react";
import { btnPrimary, btnSecondary } from "@/components/ui";
import { cancelAppointment, type CancelState } from "./actions";

const initialState: CancelState = { error: null };

/** Two-step cancel: avoids accidental taps. */
export function CancelForm({ token }: { token: string }) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState(
    cancelAppointment.bind(null, token),
    initialState,
  );

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className={btnSecondary}>
        Cancelar mi hora
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-lg border-2 border-barber p-4">
      <p className="text-lg font-bold">¿Seguro que quieres cancelar tu hora?</p>
      {state.error && (
        <p role="alert" className="text-lg font-bold text-barber">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className={btnPrimary}>
        {pending ? "Cancelando…" : "Sí, cancelar"}
      </button>
      <button type="button" onClick={() => setConfirming(false)} className={btnSecondary}>
        No, mantener mi hora
      </button>
    </form>
  );
}
