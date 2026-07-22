"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

/** Selector de fuente + multiples anios para la evolucion mensual. */
export function SelectorAnios({
  aniosDisponibles,
  aniosSeleccionados,
  fuente,
}: {
  aniosDisponibles: number[];
  aniosSeleccionados: number[];
  fuente: "matriculacion" | "importacion";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const set = (cambios: Record<string, string | null>) => {
    const p = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(cambios)) {
      if (v === null) p.delete(k);
      else p.set(k, v);
    }
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  };

  const toggleAnio = (a: number) => {
    const actual = new Set(aniosSeleccionados);
    if (actual.has(a)) {
      // Nunca dejar la seleccion vacia: el grafico quedaria sin nada.
      if (actual.size === 1) return;
      actual.delete(a);
    } else {
      actual.add(a);
    }
    set({ anios: [...actual].sort((x, y) => x - y).join(",") });
  };

  return (
    <div className="flex flex-wrap items-end gap-x-6 gap-y-3 rounded-lg border bg-card px-4 py-3">
      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Fuente
        </span>
        <div className="flex gap-1">
          {(["matriculacion", "importacion"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => set({ fuente: v, anios: null })}
              className={cn(
                "h-8 rounded-md px-3 text-xs font-medium",
                fuente === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              )}
            >
              {v === "matriculacion" ? "Matriculación" : "Importación"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Años a comparar
        </span>
        <div className="flex flex-wrap gap-1">
          {aniosDisponibles.map((a) => {
            const activo = aniosSeleccionados.includes(a);
            return (
              <button
                key={a}
                type="button"
                onClick={() => toggleAnio(a)}
                aria-pressed={activo}
                className={cn(
                  "h-8 rounded-md border px-2.5 text-xs font-medium tabular-nums",
                  activo
                    ? "border-primary bg-primary/10 text-foreground"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                {a}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
