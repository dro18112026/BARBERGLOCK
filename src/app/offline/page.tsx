import type { Metadata } from "next";
import { CallUs } from "@/components/call-us";

export const metadata: Metadata = {
  title: "Sin conexión",
  robots: { index: false, follow: false },
};

// Served by the service worker when there's no internet. Must stay static.
export default function OfflinePage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center gap-6 px-4 py-12 text-center">
      <h1 className="font-display text-5xl leading-none tracking-wide">Sin conexión</h1>
      <p className="text-lg">
        No hay internet en este momento. Revisa tu señal o Wi-Fi e inténtalo de nuevo.
      </p>
      <CallUs label="También puedes reservar llamando al" />
    </main>
  );
}
