import Link from "next/link";
import { ActionForm, SubmitButton, type FormAction } from "@/components/admin/action-form";
import { btnPrimary, btnSecondary, input } from "@/components/ui";
import { formatCLP } from "@/lib/format";

type Service = { id: string; name: string; duration_min: number; price_clp: number; active: boolean };

export type AppointmentDefaults = {
  serviceId?: string;
  date: string;
  time?: string;
  name?: string;
  phone?: string;
  notes?: string | null;
  status?: string;
};

const label = "flex min-w-0 flex-col gap-1";
const labelText = "font-bold";

export function AppointmentForm({
  action,
  services,
  defaults,
  showStatus = false,
  submitLabel,
}: {
  action: FormAction;
  services: Service[];
  defaults: AppointmentDefaults;
  showStatus?: boolean;
  submitLabel: string;
}) {
  return (
    <ActionForm action={action} successText="" className="flex flex-col gap-4">
      <label className={label}>
        <span className={labelText}>Servicio</span>
        <select name="serviceId" required defaultValue={defaults.serviceId ?? services.find((s) => s.active)?.id} className={input}>
          {services.map((s) => (
            <option key={s.id} value={s.id} disabled={!s.active && s.id !== defaults.serviceId}>
              {s.name} · {s.duration_min} min · {formatCLP(s.price_clp)}
              {!s.active ? " (inactivo)" : ""}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className={label}>
          <span className={labelText}>Fecha</span>
          <input type="date" name="date" required defaultValue={defaults.date} className={input} />
        </label>
        <label className={label}>
          <span className={labelText}>Hora</span>
          <input type="time" name="time" required step={900} defaultValue={defaults.time ?? "10:00"} className={input} />
        </label>
      </div>

      <label className={label}>
        <span className={labelText}>Nombre del cliente</span>
        <input name="name" required minLength={2} maxLength={80} defaultValue={defaults.name} className={input} />
      </label>

      <label className={label}>
        <span className={labelText}>Teléfono</span>
        <input name="phone" type="tel" required defaultValue={defaults.phone} placeholder="9 1234 5678" className={input} />
      </label>

      <label className={label}>
        <span className={labelText}>Nota (opcional)</span>
        <textarea name="notes" rows={2} maxLength={500} defaultValue={defaults.notes ?? ""} className={input} />
      </label>

      {showStatus && (
        <label className={label}>
          <span className={labelText}>Estado</span>
          <select name="status" defaultValue={defaults.status} className={input}>
            <option value="confirmed">Confirmada</option>
            <option value="completed">Atendida</option>
            <option value="no_show">No asistió</option>
            <option value="cancelled">Cancelada</option>
          </select>
        </label>
      )}

      <p className="text-sm text-smoke">
        Puedes agendar fuera del horario normal. El sistema solo impide que dos citas se crucen.
      </p>

      <SubmitButton className={btnPrimary}>{submitLabel}</SubmitButton>
      <Link href={`/admin?fecha=${defaults.date}&vista=dia`} className={btnSecondary}>
        Volver
      </Link>
    </ActionForm>
  );
}
