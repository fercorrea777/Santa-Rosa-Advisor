"use client";

import { useFiltroUrl } from "@/lib/filtro-url";

/**
 * Vuelve la pantalla a su estado sin filtros.
 *
 * Todos los filtros viven en la URL, asi que "desfiltrar todo" es
 * simplemente navegar a la ruta pelada: no hay estado escondido en
 * ningun lado que pueda quedar desincronizado.
 *
 * Solo aparece cuando hay algo que quitar, y dice CUANTOS filtros va a
 * sacar para que el usuario sepa que esta por perder antes de tocarlo.
 */
export function QuitarFiltros({ className }: { className?: string }) {
  const { puestos, limpiar } = useFiltroUrl();

  // `puestos` cuenta los filtros contando el clic que todavía viaja: sin eso,
  // el botón tardaba media consulta en aparecer o en desaparecer.
  const n = puestos.length;
  if (n === 0) return null;

  return (
    <button
      type="button"
      onClick={limpiar}
      title="Volver a mostrar todos los datos, sin ningún filtro"
      className={
        "inline-flex h-8 items-center gap-1.5 rounded-md border border-destructive/40 " +
        "bg-destructive/10 px-2.5 text-xs font-medium text-foreground " +
        "hover:bg-destructive/20 " +
        (className ?? "")
      }
    >
      Quitar {n === 1 ? "el filtro" : `los ${n} filtros`}
    </button>
  );
}
