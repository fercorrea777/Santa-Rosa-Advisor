"use client";

import { QuitarFiltros } from "@/components/dashboard/quitar-filtros";
import { useFiltroUrl } from "@/lib/filtro-url";
import { MESES_CORTOS } from "@/lib/periodo";
import { cn } from "@/lib/utils";

/**
 * Selector de fuente, anios y rango de meses para la evolucion mensual.
 *
 * El rango se aplica a TODOS los anios elegidos: es lo que permite
 * comparar acumulados equivalentes (ej. Ene-Jun de cada ano) en vez de un
 * ano parcial contra otros completos.
 */
export function SelectorAnios({
  aniosDisponibles,
  aniosSeleccionados,
  fuente,
  mesDesde,
  mesHasta,
}: {
  aniosDisponibles: number[];
  aniosSeleccionados: number[];
  fuente: "matriculacion" | "importacion";
  mesDesde: number;
  mesHasta: number;
}) {
  const { leer, leerNum, setParams: set, pendiente } = useFiltroUrl();

  // Los meses llegan como prop del servidor, así que acá se lee primero lo
  // recién elegido: si no, el desplegable volvía al valor viejo hasta que la
  // consulta terminaba.
  const desde = leerNum("desde", mesDesde);
  const hasta = leerNum("hasta", mesHasta);
  const fuenteVista = (leer("fuente") ?? fuente) as "matriculacion" | "importacion";
  const crudoAnios = leer("anios");
  const aniosVista = crudoAnios
    ? crudoAnios.split(",").map(Number).filter((a) => aniosDisponibles.includes(a))
    : aniosSeleccionados;

  const toggleAnio = (a: number) => {
    const actual = new Set(aniosVista);
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
                fuenteVista === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
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
            const activo = aniosVista.includes(a);
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

      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Meses
        </span>
        <div className="flex items-center gap-1">
          <select
            className={selectCls}
            value={desde}
            aria-label="Mes desde"
            onChange={(e) => {
              const d = Number(e.target.value);
              set({ desde: d, hasta: Math.max(d, hasta) });
            }}
          >
            {MESES_CORTOS.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
          <span className="text-xs text-muted-foreground">a</span>
          <select
            className={selectCls}
            value={hasta}
            aria-label="Mes hasta"
            onChange={(e) => set({ hasta: e.target.value })}
          >
            {MESES_CORTOS.map((m, i) => (
              <option key={m} value={i + 1} disabled={i + 1 < desde}>{m}</option>
            ))}
          </select>
          {(desde !== 1 || hasta !== 12) && (
            <button
              type="button"
              onClick={() => set({ desde: null, hasta: null })}
              className="ml-1 text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              año completo
            </button>
          )}
        </div>
      </div>

      <QuitarFiltros className="ml-auto self-end" />
    </div>
  );
}

const selectCls = "input-base";
