"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Elige que fuente manda en la pagina: matriculacion o importacion.
 * Escribe `?fuente=` en la URL, igual que el resto de los filtros, para
 * que el estado sea compartible y sobreviva al refresh.
 */
export function SelectorFuente({ fuente }: { fuente: "matriculacion" | "importacion" }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const set = (v: string) => {
    const q = new URLSearchParams(sp.toString());
    q.set("fuente", v);
    // La tecnologia solo existe del lado de matriculacion: al pasar a
    // importacion se descarta para no dejar un filtro que no aplica.
    if (v === "importacion") q.delete("tecnologia");
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  };

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Analizar
      </span>
      <div className="flex gap-1 rounded-md border bg-card p-1">
        {(["matriculacion", "importacion"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => set(v)}
            aria-pressed={fuente === v}
            className={cn(
              "h-8 rounded px-3 text-xs font-medium transition-colors",
              fuente === v
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
