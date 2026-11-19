import type { Metadata } from "next";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { card, input } from "@/components/ui";
import { getAllServices } from "@/lib/admin/data";
import { requireAdmin } from "@/lib/auth";
import { saveService } from "./actions";

export const metadata: Metadata = { title: "Servicios" };

type ServiceValues = {
  name: string;
  description: string | null;
  duration_min: number;
  price_clp: number;
  sort_order: number;
  active: boolean;
};

const saveBtn = "rounded-lg bg-ink px-5 py-2.5 font-bold text-bone hover:bg-ink/85 disabled:opacity-60";

function ServiceFields({ s }: { s?: ServiceValues }) {
  return (
    <>
      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className="font-bold">Nombre</span>
        <input name="name" required maxLength={80} defaultValue={s?.name} className={input} />
      </label>
      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className="font-bold">Descripción (opcional)</span>
        <input name="description" maxLength={300} defaultValue={s?.description ?? ""} className={input} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-bold">Precio (CLP)</span>
        <input name="price_clp" inputMode="numeric" required defaultValue={s?.price_clp} className={input} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-bold">Duración (min)</span>
        <input name="duration_min" type="number" min={5} max={480} step={5} required defaultValue={s?.duration_min ?? 60} className={input} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-bold">Orden</span>
        <input name="sort_order" type="number" defaultValue={s?.sort_order ?? 0} className={input} />
      </label>
      <label className="flex items-center gap-3 self-end py-3">
        <input name="active" type="checkbox" defaultChecked={s?.active ?? true} className="h-6 w-6 accent-steel" />
        <span className="font-bold">Visible para reservar</span>
      </label>
    </>
  );
}

export default async function ServiciosPage() {
  const { supabase } = await requireAdmin();
  const services = await getAllServices(supabase);

  return (
    <>
      <h1 className="font-display text-5xl leading-none tracking-wide">Servicios</h1>
      <p className="-mt-3 text-smoke">
        Los cambios de precio se ven al instante en la web. Las citas ya reservadas no cambian.
        Para dejar de ofrecer un servicio, desmarca &quot;Visible para reservar&quot;.
      </p>

      {services.map((s) => (
        <ActionForm
          key={s.id}
          action={saveService.bind(null, s.id)}
          className={`${card} grid gap-3 sm:grid-cols-2 ${s.active ? "" : "opacity-70"}`}
        >
          <ServiceFields s={s} />
          <div className="sm:col-span-2">
            <SubmitButton className={saveBtn}>Guardar</SubmitButton>
          </div>
        </ActionForm>
      ))}

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-3xl tracking-wide">Agregar servicio</h2>
        <ActionForm
          action={saveService.bind(null, null)}
          successText="Servicio agregado"
          resetOnSuccess
          className={`${card} grid gap-3 border-dashed sm:grid-cols-2`}
        >
          <ServiceFields />
          <div className="sm:col-span-2">
            <SubmitButton className={saveBtn}>Agregar</SubmitButton>
          </div>
        </ActionForm>
      </section>
    </>
  );
}
