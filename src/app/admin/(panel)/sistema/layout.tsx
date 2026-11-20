import { requireSuperadmin } from "@/lib/auth";
import { SistemaNav } from "./sistema-nav";

export default async function SistemaLayout({ children }: LayoutProps<"/admin/sistema">) {
  await requireSuperadmin();
  return (
    <>
      <div>
        <h1 className="font-display text-5xl leading-none tracking-wide">Sistema</h1>
        <p className="text-smoke">Solo visible para el administrador del sistema.</p>
      </div>
      <SistemaNav />
      {children}
    </>
  );
}
