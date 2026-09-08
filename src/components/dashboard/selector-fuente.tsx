"use client";

import { useFiltroUrl } from "@/lib/filtro-url";
import { cn } from "@/lib/utils";

/**
 * Elige que fuente manda en la pagina: matriculacion o importacion.
 * Escribe `?fuente=` en la URL, igual que el resto de los filtros, para
 * que el estado sea compartible y sobreviva al refresh.
 */
export function SelectorFuente({ fuente }: { fuente: "matriculacion" | "importacion" }) {
  const { leer, setParams, pendiente } = useFiltroUrl();
  const vista = (leer("fuente") ?? fuente) as "matriculacion" | "importacion";

  const set = (v: string) => {
    // La tecnologia solo existe del lado de matriculacion: al pasar a
    // importacion se descarta para no dejar un filtro que no aplica.
    setParams(v === "importacion" ? { fuente: v, tecnologia: null } : { fuente: v });
  };

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Analizar
      </span>
      <div
        aria-busy={pendiente}
        className={cn(
          "flex gap-1 rounded-md border bg-card p-1 transition-opacity",
          pendiente && "opacity-70"
        )}
      >
        {(["matriculacion", "importacion"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => set(v)}
            aria-pressed={vista === v}
            className={cn(
              "h-8 rounded px-3 text-xs font-medium transition-colors",
              vista === v
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            {v === "matriculacion" ? "Matriculaciones" : "Importaciones"}
          </button>
        ))}
      </div>
    </div>
  );
}
