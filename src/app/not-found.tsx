import Link from "next/link";
import { CallUs } from "@/components/call-us";
import { btnPrimary } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center gap-6 px-4 py-12 text-center">
      <h1 className="font-display text-5xl leading-none tracking-wide">No encontramos esta página</h1>
      <p className="text-lg text-smoke">
        Si buscabas tu reserva, revisa que el link esté completo.
      </p>
      <Link href="/" className={btnPrimary}>
        Ir al inicio
      </Link>
      <CallUs />
    </main>
  );
}
