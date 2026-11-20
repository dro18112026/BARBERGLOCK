/** Step-by-step "add to home screen" help, collapsed by default. No JS needed. */
export function InstallGuide({ appName }: { appName: string }) {
  return (
    <details className="rounded-lg border border-smoke/30 bg-paper p-4 text-left">
      <summary className="cursor-pointer text-lg font-bold">
        📲 Instalar &quot;{appName}&quot; en tu celular
      </summary>
      <div className="mt-3 flex flex-col gap-4">
        <div>
          <p className="font-bold">iPhone (Safari)</p>
          <ol className="ml-5 list-decimal">
            <li>Abre esta página en <strong>Safari</strong>.</li>
            <li>
              Toca el botón <strong>Compartir</strong> (cuadrado con flecha hacia arriba).
            </li>
            <li>
              Elige <strong>&quot;Agregar a inicio&quot;</strong> y luego <strong>Agregar</strong>.
            </li>
            <li>
              Abre la app desde el ícono e <strong>inicia sesión ahí una vez</strong> (la app
              guarda su sesión aparte de Safari).
            </li>
          </ol>
        </div>
        <div>
          <p className="font-bold">Android (Chrome)</p>
          <ol className="ml-5 list-decimal">
            <li>Abre esta página en <strong>Chrome</strong>.</li>
            <li>
              Toca el menú <strong>⋮</strong> y elige <strong>&quot;Instalar app&quot;</strong> o
              &quot;Agregar a pantalla principal&quot;.
            </li>
          </ol>
        </div>
      </div>
    </details>
  );
}
