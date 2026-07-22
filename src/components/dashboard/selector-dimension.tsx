"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

/** Selector de fuente + dimension de analisis, escrito en la URL. */
export function SelectorDimension({
  dimensiones,
  dimensionActual,
  fuente,
}: {
  dimensiones: { valor: string; label: string }[];
  dimensionActual: string;
  fuente: "matriculacion" | "importacion";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const set = (cambios: Record<string, string>) => {
    const p = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(cambios)) p.set(k, v);
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  };

  return (
    <div className="flex flex-wrap items-end gap-x-6 gap-y-3 rounded-lg border bg-card px-4 py-3">
      <Grupo label="Fuente">
        {(["matriculacion", "importacion"] as const).map((v) => (
          <Boton key={v} activo={fuente === v} onClick={() => set({ fuente: v })}>
            {v === "matriculacion" ? "Matriculación" : "Importación"}
          </Boton>
        ))}
      </Grupo>

      <Grupo label="Analizar por">
        {dimensiones.map((d) => (
          <Boton
            key={d.valor}
            activo={dimensionActual === d.valor}
            onClick={() => set({ dim: d.valor })}
          >
            {d.label}
          </Boton>
        ))}
      </Grupo>
    </div>
  );
}

function Grupo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

function Boton({
  activo, onClick, children,
}: { activo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={cn(
        "h-8 rounded-md px-3 text-xs font-medium",
        activo ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
      )}
    >
      {children}
    </button>
  );
}
