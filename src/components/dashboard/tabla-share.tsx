"use client";

import * as React from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatPct, formatPuntosPct, formatUnidades } from "@/lib/format";
import type { FilaDimension } from "@/lib/cadam/mercado";

export interface FilaShare extends FilaDimension {
  esPropia?: boolean;
}

/**
 * Tabla de market share. La columna que importa es "Δ participacion":
 * una marca puede CRECER en unidades y PERDER market share si el mercado
 * crecio mas rapido (spec sec. 17). Por eso las dos columnas van juntas
 * y la fila se marca cuando los signos no coinciden.
 */
export function TablaShare({
  filas,
  etiqueta,
  anioAnterior,
  nombreArchivo = "market-share",
}: {
  filas: FilaShare[];
  etiqueta: string;
  anioAnterior: number;
  nombreArchivo?: string;
}) {
  const [soloDivergentes, setSoloDivergentes] = React.useState(false);

  const divergente = (f: FilaShare) =>
    f.variacion !== null && f.deltaParticipacion !== null &&
    ((f.variacion > 0 && f.deltaParticipacion < 0) ||
     (f.variacion < 0 && f.deltaParticipacion > 0));

  const visibles = soloDivergentes ? filas.filter(divergente) : filas;
  const nDiv = filas.filter(divergente).length;

  const exportar = () => {
    const cab = [etiqueta, "Unidades", `Unidades ${anioAnterior}`, "Var %",
      "Participacion %", `Participacion ${anioAnterior} %`, "Delta pp"];
    const cuerpo = visibles.map((f) => [
      f.valor, f.unidades, f.unidadesAnterior,
      f.variacion === null ? "" : (f.variacion * 100).toFixed(2),
      (f.participacion * 100).toFixed(2),
      ((f.participacion - (f.deltaParticipacion ?? 0)) * 100).toFixed(2),
      f.deltaParticipacion === null ? "" : (f.deltaParticipacion * 100).toFixed(2),
    ]);
    const csv = [cab, ...cuerpo]
      .map((r) => r.map((c) => (typeof c === "string" && /[;"\n]/.test(c)
        ? `"${c.replace(/"/g, '""')}"` : c)).join(";"))
      .join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${nombreArchivo}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (!filas.length) {
    return <p className="py-8 text-center text-sm text-muted-foreground">
      No hay datos para este filtro.
    </p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        {nDiv > 0 && (
          <label className="flex cursor-pointer items-center gap-2 text-xs">
            <input
              type="checkbox"
              className="size-3.5 accent-primary"
              checked={soloDivergentes}
              onChange={(e) => setSoloDivergentes(e.target.checked)}
            />
            Ver solo los {nDiv} casos donde unidades y participación van en
            sentido contrario
          </label>
        )}
        <button
          type="button"
          onClick={exportar}
          className="ml-auto inline-flex h-8 items-center rounded-md border px-2.5 text-xs font-medium hover:bg-muted"
        >
          Exportar CSV
        </button>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>{etiqueta}</TableHead>
              <TableHead className="text-right">Unidades</TableHead>
              <TableHead className="text-right">Var. unidades</TableHead>
              <TableHead className="text-right">Participación</TableHead>
              <TableHead className="text-right">Part. {anioAnterior}</TableHead>
              <TableHead className="text-right">Δ participación</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibles.map((f, i) => {
              const partAnterior = f.deltaParticipacion === null
                ? null : f.participacion - f.deltaParticipacion;
              return (
                <TableRow
                  key={f.valor}
                  className={cn(
                    f.esPropia && "bg-primary/5 hover:bg-primary/10",
                    // La divergencia se marca con un tinte de fondo y un icono
                    // junto al nombre, no con una franja lateral de color.
                    divergente(f) && "bg-amber-500/8"
                  )}
                >
                  <TableCell className="tabular-nums text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="font-medium">
                    <span className="inline-flex items-center gap-2">
                      {divergente(f) && (
                        <span
                          className="shrink-0 text-amber-600 dark:text-amber-500"
                          role="img"
                          aria-label="Unidades y participación van en sentido contrario"
                        >
                          ⚠
                        </span>
                      )}
                      {f.valor}
                      {f.esPropia && <Badge className="h-5 px-1.5 text-[10px]">propia</Badge>}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatUnidades(f.unidades)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <Signo v={f.variacion} texto={formatPct(f.variacion, { signed: true })} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatPct(f.participacion)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {partAnterior === null ? "—" : formatPct(partAnterior)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <Signo
                      v={f.deltaParticipacion}
                      texto={f.deltaParticipacion === null
                        ? "—" : formatPuntosPct(f.deltaParticipacion)}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        Las filas con <span className="text-amber-600 dark:text-amber-500">⚠</span>{" "}
        crecen en unidades pero pierden participación (o al revés): el mercado
        se movió más rápido que ellas.
      </p>
    </div>
  );
}

function Signo({ v, texto }: { v: number | null; texto: string }) {
  if (v === null) return <span className="text-muted-foreground">{texto}</span>;
  const up = v > 0, down = v < 0;
  return (
    <span className={cn(
      "inline-flex items-center gap-0.5",
      up && "text-emerald-600 dark:text-emerald-400",
      down && "text-rose-600 dark:text-rose-400"
    )}>
      <span aria-hidden="true">{up ? "▲" : down ? "▼" : "–"}</span>
      {texto}
    </span>
  );
}
