"use client";

import { useFiltroUrl } from "@/lib/filtro-url";
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
  const { leer, setParams: set, pendiente } = useFiltroUrl();
  const fuenteVista = leer("fuente") ?? fuente;
  const dimVista = leer("dim") ?? dimensionActual;

  return (
    <div
      aria-busy={pendiente}
      className="relative flex flex-wrap items-end gap-x-6 gap-y-3 rounded-lg border bg-card px-4 py-3"
    >
      {pendiente && (
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-0.5 animate-pulse rounded-t-lg bg-primary"
        />
      )}
      <Grupo label="Fuente">
        {(["matriculacion", "importacion"] as const).map((v) => (
          <Boton key={v} activo={fuenteVista === v} onClick={() => set({ fuente: v })}>
            {v === "matriculacion" ? "Matriculación" : "Importación"}
          </Boton>
        ))}
      </Grupo>

      <Grupo label="Analizar por">
        {dimensiones.map((d) => (
          <Boton
            key={d.valor}
            activo={dimVista === d.valor}
            onClick={() => set({ dim: d.valor })}
          >
            {d.label}
          </Boton>
        ))}
      </Grupo>
      {/* El boton de quitar filtros lo pone FiltroPeriodo, que en esta
          pantalla va justo debajo: ponerlo aca tambien lo duplicaria. */}
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
