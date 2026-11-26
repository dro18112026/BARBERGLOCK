import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { card, input } from "@/components/ui";
import { formatPhone } from "@/lib/format";
import { blockPhone } from "./actions";

/**
 * Form to block a phone number from booking online. On the appointment page
 * the number is fixed (that customer's phone); on Bloqueos it's typed in.
 */
export function BlockPhoneForm({ phone }: { phone?: string }) {
  return (
    <ActionForm
      action={blockPhone}
      successText="Teléfono bloqueado."
      resetOnSuccess={!phone}
      confirmText={
        phone
          ? `¿Bloquear ${formatPhone(phone.replace(/^\+/, ""))}? No podrá reservar por internet.`
          : undefined
      }
      className={`${card} flex flex-col gap-3`}
    >
      {phone ? (
        <>
          <input type="hidden" name="phone" value={phone} />
          <p className="text-lg">
            <strong>{formatPhone(phone.replace(/^\+/, ""))}</strong> no podrá volver a reservar por
            internet. Tú sí puedes seguir agendándole a mano.
          </p>
        </>
      ) : (
        <label className="flex flex-col gap-1">
          <span className="font-bold">Teléfono</span>
          <input
            name="phone"
            type="tel"
            inputMode="tel"
            required
            placeholder="9 1234 5678"
            className={input}
          />
        </label>
      )}
      <label className="flex flex-col gap-1">
        <span className="font-bold">Motivo (opcional, solo lo ves tú)</span>
        <input name="reason" maxLength={200} placeholder="Ej: Reservas falsas, no se presenta" className={input} />
      </label>
      <label className="flex items-center gap-3">
        <input type="checkbox" name="cancelFuture" defaultChecked className="h-6 w-6 accent-steel" />
        <span className="font-bold">Cancelar también sus horas futuras</span>
      </label>
      <div>
        <SubmitButton
          pendingText="Bloqueando…"
          className="rounded-lg bg-barber px-5 py-2.5 font-bold text-paper hover:bg-barber-dark disabled:opacity-60"
        >
          Bloquear teléfono
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
