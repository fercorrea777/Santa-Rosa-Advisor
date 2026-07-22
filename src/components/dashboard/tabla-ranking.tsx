"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatPct, formatUnidades } from "@/lib/format";
import type { FilaRanking } from "@/lib/cadam/mercado";
import {
  ArrowDown, ArrowDownRight, ArrowUp, ArrowUpRight, ChevronsUpDown,
  Download, Minus, Search,
} from "lucide-react";

type Campo = "posicion" | "marca" | "modelo" | "segmento" | "unidades"
  | "participacion" | "variacion" | "cambioPosicion";

const TOPES = [5, 10, 20, 50, 0] as const;

/**
 * Tabla de ranking con orden por cualquier columna, busqueda, tope
 * Top N, exportacion a CSV y marcado de marcas propias (spec sec. 14).
 *
 * Las posiciones se calculan una sola vez en el servidor sobre el ranking
 * completo: reordenar aca cambia como se LISTA, no la posicion real de
 * cada marca.
 */
export function TablaRanking({
  filas,
  columnaClave = "Marca",
  mostrarModelo = false,
  mostrarSegmento = false,
  nombreArchivo = "ranking",
  notaVariacion,
  filtrarPor,
  etiquetaModelo = "Modelo",
}: {
  filas: FilaRanking[];
  columnaClave?: string;
  mostrarModelo?: boolean;
  mostrarSegmento?: boolean;
  nombreArchivo?: string;
  notaVariacion?: string;
  /**
   * Si se pasa, cada fila filtra la pagina al hacerle clic. `marca` es el
   * parametro que recibe la columna de marca; `detalle` el de la columna
   * de modelo/version (cuando se muestra).
   */
  filtrarPor?: { marca?: string; detalle?: string };
  etiquetaModelo?: string;
}) {
  const [orden, setOrden] = React.useState<{ campo: Campo; asc: boolean }>({
    campo: "posicion", asc: true,
  });
  const [busqueda, setBusqueda] = React.useState("");
  const [tope, setTope] = React.useState<number>(20);

  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  /** Clic en una celda: pone (o quita) ese valor como filtro en la URL. */
  const alternarFiltro = (param: string, valor: string) => {
    const q = new URLSearchParams(sp.toString());
    if (q.get(param) === valor) q.delete(param);
    else q.set(param, valor);
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  };

  const filtradas = React.useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const base = q
      ? filas.filter((f) =>
          f.marca.toLowerCase().includes(q) ||
          (f.modelo ?? "").toLowerCase().includes(q))
      : filas;
    const dir = orden.asc ? 1 : -1;
    const val = (f: FilaRanking) => {
      const v = f[orden.campo];
      return v === null || v === undefined ? (orden.asc ? Infinity : -Infinity) : v;
    };
    const ordenadas = [...base].sort((a, a2) => {
      const va = val(a), vb = val(a2);
      if (typeof va === "string" || typeof vb === "string") {
        return String(va).localeCompare(String(vb)) * dir;
      }
      return ((va as number) - (vb as number)) * dir;
    });
    return tope > 0 ? ordenadas.slice(0, tope) : ordenadas;
  }, [filas, busqueda, orden, tope]);

  const exportar = () => {
    const cab = ["Posicion", "Marca"];
    if (mostrarModelo) cab.push("Modelo");
    if (mostrarSegmento) cab.push("Segmento");
    cab.push("Unidades", "Participacion %", "Variacion %", "Unidades periodo anterior",
      "Posicion anterior", "Cambio posicion", "Marca propia");
    const filasCsv = filtradas.map((f) => {
      const c: (string | number)[] = [f.posicion, f.marca];
      if (mostrarModelo) c.push(f.modelo ?? "");
      if (mostrarSegmento) c.push(f.segmento ?? "");
      c.push(
        f.unidades,
        (f.participacion * 100).toFixed(2),
        f.variacion === null ? "" : (f.variacion * 100).toFixed(2),
        f.unidadesAnterior,
        f.posicionAnterior ?? "",
        f.cambioPosicion ?? "",
        f.esPropia ? "si" : "no",
      );
      return c;
    });
    const csv = [cab, ...filasCsv]
      .map((r) => r.map((c) => (typeof c === "string" && /[;"\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(";"))
      .join("\n");
    // BOM para que Excel en es-PY abra los acentos bien
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${nombreArchivo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const th = (campo: Campo, label: string, alinearDerecha = false) => (
    <TableHead className={alinearDerecha ? "text-right" : undefined}>
      <button
        type="button"
        onClick={() =>
          setOrden((o) => ({ campo, asc: o.campo === campo ? !o.asc : campo === "posicion" || campo === "marca" }))
        }
        className={cn(
          "inline-flex items-center gap-1 hover:text-foreground",
          alinearDerecha && "flex-row-reverse",
          orden.campo === campo ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {label}
        {orden.campo !== campo ? (
          <ChevronsUpDown className="size-3 opacity-50" />
        ) : orden.asc ? (
          <ArrowUp className="size-3" />
        ) : (
          <ArrowDown className="size-3" />
        )}
      </button>
    </TableHead>
  );

  if (!filas.length) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No hay datos para este filtro.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar marca o modelo…"
            className="h-8 w-56 rounded-md border bg-background pl-7 pr-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="flex items-center gap-1">
          {TOPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTope(t)}
              className={cn(
                "h-8 rounded-md px-2.5 text-xs font-medium",
                tope === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              )}
            >
              {t === 0 ? "Todos" : `Top ${t}`}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={exportar}
          className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium hover:bg-muted"
        >
          <Download className="size-3.5" />
          Exportar CSV
        </button>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {th("posicion", "#")}
              {th("marca", columnaClave)}
              {mostrarModelo && th("modelo", etiquetaModelo)}
              {mostrarSegmento && th("segmento", "Segmento")}
              {th("unidades", "Unidades", true)}
              {th("participacion", "Part.", true)}
              {th("variacion", "Var.", true)}
              {th("cambioPosicion", "Pos.", true)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtradas.map((f) => (
              <TableRow
                key={f.clave}
                className={cn(f.esPropia && "bg-primary/5 hover:bg-primary/10")}
              >
                <TableCell className="tabular-nums text-muted-foreground">{f.posicion}</TableCell>
                <TableCell className="font-medium">
                  <span className="inline-flex items-center gap-2">
                    <Filtrable
                      param={filtrarPor?.marca}
                      valor={f.marca}
                      activo={filtrarPor?.marca ? sp.get(filtrarPor.marca) === f.marca : false}
                      onToggle={alternarFiltro}
                    />
                    {f.esPropia && <Badge className="h-5 px-1.5 text-[10px]">propia</Badge>}
                  </span>
                </TableCell>
                {mostrarModelo && (
                  <TableCell className="text-muted-foreground">
                    <Filtrable
                      param={filtrarPor?.detalle}
                      valor={f.modelo ?? ""}
                      activo={
                        filtrarPor?.detalle ? sp.get(filtrarPor.detalle) === f.modelo : false
                      }
                      onToggle={alternarFiltro}
                    />
                  </TableCell>
                )}
                {mostrarSegmento && (
                  <TableCell className="text-muted-foreground">{f.segmento}</TableCell>
                )}
                <TableCell className="text-right tabular-nums">{formatUnidades(f.unidades)}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {formatPct(f.participacion)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  <Variacion v={f.variacion} entrante={f.unidadesAnterior === 0} />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  <CambioPosicion cambio={f.cambioPosicion} anterior={f.posicionAnterior} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        Mostrando {filtradas.length} de {filas.length}.
        {notaVariacion ? ` ${notaVariacion}` : ""}
      </p>
    </div>
  );
}

/** Celda que filtra al hacerle clic. Si no hay `param`, es texto plano:
 *  asi la misma tabla sirve en pantallas donde el filtro no aplica. */
function Filtrable({
  param, valor, activo, onToggle,
}: {
  param?: string;
  valor: string;
  activo: boolean;
  onToggle: (param: string, valor: string) => void;
}) {
  if (!param) return <>{valor}</>;
  return (
    <button
      type="button"
      onClick={() => onToggle(param, valor)}
      aria-pressed={activo}
      title={activo ? "Quitar filtro" : `Filtrar por ${valor}`}
      className={cn(
        "rounded px-1 -mx-1 text-left underline-offset-4 hover:underline",
        activo && "bg-primary/15 font-medium text-foreground underline"
      )}
    >
      {valor}
    </button>
  );
}

function Variacion({ v, entrante }: { v: number | null; entrante: boolean }) {
  if (v === null) {
    return (
      <span className="text-muted-foreground">
        {entrante ? "Nuevo" : "—"}
      </span>
    );
  }
  const up = v > 0, down = v < 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5",
        up && "text-emerald-600 dark:text-emerald-400",
        down && "text-rose-600 dark:text-rose-400"
      )}
    >
      {up && <ArrowUpRight className="size-3.5" />}
      {down && <ArrowDownRight className="size-3.5" />}
      {!up && !down && <Minus className="size-3.5" />}
      {formatPct(v, { signed: true })}
    </span>
  );
}

function CambioPosicion({
  cambio, anterior,
}: { cambio: number | null; anterior: number | null }) {
  if (cambio === null || anterior === null) {
    return <span className="text-muted-foreground">—</span>;
  }
  if (cambio === 0) {
    return <span className="text-muted-foreground">=</span>;
  }
  const sube = cambio > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5",
        sube ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
      )}
      title={`Posición anterior: ${anterior}`}
    >
      {sube ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />}
      {Math.abs(cambio)}
    </span>
  );
}
