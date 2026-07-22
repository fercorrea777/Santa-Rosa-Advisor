"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MESES_CORTOS } from "@/lib/periodo";
import { cn } from "@/lib/utils";

export interface OpcionFiltro {
  /** Clave del parametro en la URL, ej. 'segmento'. */
  param: string;
  label: string;
  valores: string[];
}

/**
 * Barra de filtros. Escribe en la URL (searchParams) en vez de en estado
 * local: asi el filtro es compartible, sobrevive al refresh y el Server
 * Component vuelve a consultar la base con los valores nuevos.
 */
export function FiltroPeriodo({
  anios,
  mesMaximoPorAnio,
  opciones = [],
}: {
  anios: number[];
  /** Ultimo mes con datos, por anio. Evita ofrecer meses vacios. */
  mesMaximoPorAnio: Record<number, number>;
  opciones?: OpcionFiltro[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const anioActual = Number(sp.get("anio")) || anios[anios.length - 1];
  const topeMes = mesMaximoPorAnio[anioActual] ?? 12;
  const desde = Math.min(Number(sp.get("desde")) || 1, topeMes);
  const hasta = Math.min(Number(sp.get("hasta")) || topeMes, topeMes);

  const setParams = React.useCallback(
    (cambios: Record<string, string | number | null>) => {
      const p = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(cambios)) {
        if (v === null || v === "todos") p.delete(k);
        else p.set(k, String(v));
      }
      router.replace(`${pathname}?${p.toString()}`, { scroll: false });
    },
    [pathname, router, sp]
  );

  return (
    <div className="flex flex-wrap items-end gap-x-5 gap-y-3 rounded-lg border bg-card px-4 py-3">
      <Campo label="Año">
        <select
          className={selectCls}
          value={anioActual}
          onChange={(e) => {
            const nuevo = Number(e.target.value);
            const tope = mesMaximoPorAnio[nuevo] ?? 12;
            setParams({ anio: nuevo, desde: 1, hasta: tope });
          }}
        >
          {anios.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </Campo>

      <Campo label="Desde">
        <select
          className={selectCls}
          value={desde}
          onChange={(e) => {
            const d = Number(e.target.value);
            setParams({ desde: d, hasta: Math.max(d, hasta) });
          }}
        >
          {MESES_CORTOS.slice(0, topeMes).map((m, i) => (
            <option key={m} value={i + 1}>{m}</option>
          ))}
        </select>
      </Campo>

      <Campo label="Hasta">
        <select
          className={selectCls}
          value={hasta}
          onChange={(e) => setParams({ hasta: Number(e.target.value) })}
        >
          {MESES_CORTOS.slice(0, topeMes).map((m, i) => (
            <option key={m} value={i + 1} disabled={i + 1 < desde}>{m}</option>
          ))}
        </select>
      </Campo>

      {opciones.map((o) => (
        <Campo key={o.param} label={o.label}>
          <select
            className={selectCls}
            value={sp.get(o.param) ?? "todos"}
            onChange={(e) => setParams({ [o.param]: e.target.value })}
          >
            <option value="todos">Todos</option>
            {o.valores.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </Campo>
      ))}

      {[...sp.keys()].length > 0 && (
        <button
          type="button"
          onClick={() => router.replace(pathname, { scroll: false })}
          className="ml-auto text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          Limpiar filtros
        </button>
      )}
    </div>
  );
}

const selectCls = cn(
  "h-8 rounded-md border bg-background px-2 text-sm",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
);

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
