"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FilterX } from "lucide-react";

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
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const n = [...sp.keys()].length;
  if (n === 0) return null;

  return (
    <button
      type="button"
      onClick={() => router.replace(pathname, { scroll: false })}
      title="Volver a mostrar todos los datos, sin ningún filtro"
      className={
        "inline-flex h-8 items-center gap-1.5 rounded-md border border-destructive/40 " +
        "bg-destructive/10 px-2.5 text-xs font-medium text-foreground " +
        "hover:bg-destructive/20 " +
        (className ?? "")
      }
    >
      <FilterX className="size-3.5" />
      Quitar {n === 1 ? "el filtro" : `los ${n} filtros`}
    </button>
  );
}
