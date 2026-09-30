"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Aviso honesto sobre una limitación del dato. Se usa siempre que una vista
 * no puede mostrar todo lo que su título promete.
 *
 * PLEGADA A DOS RENGLONES (30/09/2026). Había 115 de estas en 18 pantallas,
 * algunas de 1.800 caracteres: en «Nuestra operación» eran 3.500 caracteres
 * de letra chica entre tabla y tabla, y la pantalla se leía como un
 * documento. Casi todas arrancan con la frase que importa en negrita («La
 * planilla manda.», «Facturar no es matricular.»): esa queda a la vista y
 * el resto se abre con «Leer todo».
 *
 * El texto completo sigue en la página — el recorte es solo visual (lo lee
 * entero un lector de pantalla) —, y el botón aparece solo si de verdad hay
 * algo cortado.
 */
export function NotaDato({ children }: { children: React.ReactNode }) {
  const id = React.useId();
  const texto = React.useRef<HTMLSpanElement>(null);
  const [abierta, setAbierta] = React.useState(false);
  const [cortada, setCortada] = React.useState(false);

  React.useLayoutEffect(() => {
    const el = texto.current;
    if (!el || abierta) return;
    const medir = () => setCortada(el.scrollHeight > el.clientHeight + 1);
    medir();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [abierta, children]);

  return (
    <div
      data-revelar=""
      className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground"
    >
      <span
        aria-hidden="true"
        className="mt-0.5 flex size-3.5 shrink-0 items-center justify-center rounded-full border border-amber-600/50 text-[9px] font-bold leading-none text-amber-600 dark:border-amber-500/50 dark:text-amber-500"
      >
        i
      </span>
      <span ref={texto} id={id} className={cn("min-w-0 flex-1 text-pretty", !abierta && "line-clamp-2")}>
        {children}
      </span>
      {(cortada || abierta) && (
        <button
          type="button"
          aria-expanded={abierta}
          aria-controls={id}
          onClick={() => setAbierta((a) => !a)}
          className="shrink-0 self-end whitespace-nowrap rounded font-medium text-foreground/80 underline decoration-dotted underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          {abierta ? "Mostrar menos" : "Leer todo"}
        </button>
      )}
    </div>
  );
}
