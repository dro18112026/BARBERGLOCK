import type { Metadata } from "next";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { card, input } from "@/components/ui";
import { requireSuperadmin } from "@/lib/auth";
import { saveBookingRules } from "./actions";

export const metadata: Metadata = { title: "Reglas de reserva" };

function NumberField(props: {
  name: string;
  label: string;
  help: string;
  value: number;
  min: number;
  max: number;
  unit: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-bold">{props.label}</span>
      <span className="flex items-center gap-2">
        <input
          type="number"
          name={props.name}
          defaultValue={props.value}
          min={props.min}
          max={props.max}
          required
          className={`${input} w-32`}
        />
        <span className="text-smoke">{props.unit}</span>
      </span>
      <span className="text-sm text-smoke">{props.help}</span>
    </label>
  );
}

export default async function ReglasPage() {
  const { supabase } = await requireSuperadmin();
  const { data: s } = await supabase.from("booking_settings").select("*").eq("id", true).single();
  if (!s) throw new Error("booking_settings row missing");

  return (
    <ActionForm action={saveBookingRules} className={`${card} flex flex-col gap-5`}>
      <p className="text-smoke">
        Estas reglas se aplican a las reservas por internet. El barbero puede agendar a mano sin
        estos límites. Zona horaria: <strong>{s.time_zone}</strong>.
      </p>
      <NumberField name="min_lead_min" label="Anticipación mínima" unit="minutos" value={s.min_lead_min} min={0} max={10080}
        help="Cuánto antes hay que reservar. 60 = no se puede reservar una hora que empieza en menos de 1 hora." />
      <NumberField name="max_days_ahead" label="Días hacia adelante" unit="días" value={s.max_days_ahead} min={1} max={365}
        help="Hasta cuántos días en el futuro se muestran horas." />
      <NumberField name="max_active_per_phone" label="Citas por teléfono" unit="citas" value={s.max_active_per_phone} min={1} max={20}
        help="Máximo de citas futuras que puede tener un mismo teléfono (evita que alguien llene la agenda)." />
      <NumberField name="max_active_per_client" label="Citas por dispositivo" unit="citas" value={s.max_active_per_client} min={1} max={20}
        help="Máximo de citas futuras reservadas desde una misma conexión a internet, aunque use teléfonos distintos." />
      <NumberField name="max_bookings_per_client_hour" label="Reservas por hora" unit="reservas" value={s.max_bookings_per_client_hour} min={1} max={20}
        help="Cuántas reservas se pueden hacer en una hora desde una misma conexión (cuentan también las que se cancelan)." />
      <NumberField name="cancel_min_lead_min" label="Plazo para cancelar" unit="minutos" value={s.cancel_min_lead_min} min={0} max={10080}
        help="Hasta cuánto antes el cliente puede cancelar desde su link. Después, tiene que llamar." />
      <NumberField name="slot_step_min" label="Intervalo de horas" unit="minutos" value={s.slot_step_min} min={5} max={240}
        help="Cada cuántos minutos se ofrece una hora de inicio (30 = 10:00, 10:30, 11:00…)." />
      <div>
        <SubmitButton className="rounded-lg bg-ink px-5 py-2.5 font-bold text-bone hover:bg-ink/85 disabled:opacity-60">
          Guardar reglas
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
