"use client";

import * as React from "react";
import { LogoMarca } from "@/components/dashboard/logo-marca";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { IconChevron } from "@/components/icons";
import { cn } from "@/lib/utils";
import { formatUnidades } from "@/lib/format";

export type AccionStock = "pedir" | "llega" | "empujar" | "ok" | "sin ritmo";

export interface VersionStock {
  version: string;
  libres: number;
  reservadas: number;
  enViaje: number;
  noVendible: number;
  ritmo: number;
  meses: number | null;
  precio: number | null;
  accion: AccionStock;
}

export interface ModeloStock {
  marca: string;
  modelo: string;
  total: number;
  libres: number;
  reservadas: number;
  enViaje: number;
  noVendible: number;
  ritmo: number;
  meses: number | null;
  /** El precio de lista más bajo de sus versiones: el «desde». */
  precioDesde: number | null;
  versiones: VersionStock[];
}

const ETIQUETA: Record<AccionStock, string> = {
  pedir: "Pedir",
  llega: "Llega en viaje",
  empujar: "Empujar (promo)",
  ok: "Bien",
  "sin ritmo": "Vende poco",
};
const TONO: Record<AccionStock, string> = {
  pedir: "text-rose-600 dark:text-rose-400",
  empujar: "text-amber-600 dark:text-amber-500",
  llega: "text-emerald-700 dark:text-emerald-400",
  ok: "text-emerald-700 dark:text-emerald-400",
  "sin ritmo": "text-muted-foreground",
};
const FOCO = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-1";

const n = (v: number) => (v ? formatUnidades(v) : "—");
/** Segundo renglón chico de una celda numérica. */
const Sub = ({ children }: { children: React.ReactNode }) => (
  <span className="block text-[11px] leading-tight text-muted-foreground">{children}</span>
);
const ritmoTxt = (r: number) => (r > 0 ? `${r.toFixed(1)} /mes` : "—");
const mesesTxt = (m: number | null) => (m === null ? "—" : m.toFixed(1));

/**
 * Todo el stock en UNA tabla: una fila por modelo, y sus versiones adentro.
 *
 * Reemplaza a dos tablas que decían casi lo mismo (30/09/2026): «Stock y
 * ritmo por versión» (40 filas) y «Stock por modelo» (25 filas, con una
 * columna de estados sin sumar: «EN VIAJE 49 · DESPACHADO 22 · EN VIAJE 17
 * · EN VIAJE 8…»). El modelo dice cuánto hay; la versión, qué pedir — el
 * chevron abre una dentro de la otra.
 */
export function TablaStockModelos({
  modelos,
  otras,
}: {
  modelos: ModeloStock[];
  /** Marcas que la casa no distribuye (canje y usados): una sola fila. */
  otras: { marcas: number; unidades: number } | null;
}) {
  const [abiertos, setAbiertos] = React.useState<Set<string>>(new Set());
  const alternar = (k: string) =>
    setAbiertos((prev) => {
      const s = new Set(prev);
      if (s.has(k)) s.delete(k);
      else s.add(k);
      return s;
    });
  return (
    <Table className="sin-cebra">
      <TableHeader>
        <TableRow>
          <TableHead className="min-w-[13rem]">Modelo</TableHead>
          <TableHead className="text-right" nota="todos los estados">Total</TableHead>
          <TableHead className="text-right" nota="entregables hoy · con seña">Libres</TableHead>
          <TableHead className="text-right" nota="compradas, sin llegar">En viaje</TableHead>
          <TableHead className="text-right" nota="por mes, últimos 3">Ritmo</TableHead>
          <TableHead className="text-right" nota="libres ÷ ritmo">Meses</TableHead>
          <TableHead className="text-right" nota="lista US$, la más barata">Precio desde</TableHead>
          <TableHead nota="por versión">Qué hacer</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {modelos.flatMap((m) => {
          const k = `${m.marca}|${m.modelo}`;
          const abierto = abiertos.has(k);
          const pedir = m.versiones.filter((v) => v.accion === "pedir").length;
          const empujar = m.versiones.filter((v) => v.accion === "empujar").length;
          const unica = m.versiones.length === 1 ? m.versiones[0] : null;
          const filas = [
            <TableRow key={k} className={cn("group/fila", abierto && "border-b-0 bg-muted/30")}>
              <TableCell>
                <div className="flex items-center gap-1.5">
                  {m.versiones.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => alternar(k)}
                      aria-expanded={abierto}
                      aria-label={`${abierto ? "Cerrar" : "Ver"} las ${m.versiones.length} versiones de ${m.modelo}`}
                      className={cn(
                        "-ml-1 flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground",
                        FOCO
                      )}
                    >
                      <IconChevron size={13} className={cn("transition-transform duration-150", !abierto && "-rotate-90")} />
                    </button>
                  ) : (
                    <span className="size-6 shrink-0" aria-hidden="true" />
                  )}
                  <LogoMarca marca={m.marca} />
                  <span className="min-w-0">
                    <span className="block font-medium">{m.modelo}</span>
                    <span className="block text-[11px] leading-tight text-muted-foreground">
                      {m.marca}
                      {m.versiones.length > 1 ? ` · ${m.versiones.length} versiones` : unica ? ` · ${unica.version}` : ""}
                    </span>
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-right tabular-nums font-semibold">{formatUnidades(m.total)}</TableCell>
              <TableCell className="text-right tabular-nums">
                {n(m.libres)}
                {m.reservadas > 0 && <Sub>{formatUnidades(m.reservadas)} con seña</Sub>}
              </TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">{n(m.enViaje)}</TableCell>
              <TableCell className="text-right tabular-nums">{ritmoTxt(m.ritmo)}</TableCell>
              <TableCell className="text-right tabular-nums">{mesesTxt(m.meses)}</TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                {m.precioDesde ? formatUnidades(m.precioDesde) : "—"}
              </TableCell>
              <TableCell className="text-xs font-medium">
                {unica ? (
                  <span className={TONO[unica.accion]}>{ETIQUETA[unica.accion]}</span>
                ) : pedir || empujar ? (
                  <span className="flex flex-wrap gap-x-2">
                    {pedir > 0 && <span className={TONO.pedir}>Pedir {pedir}</span>}
                    {empujar > 0 && <span className={TONO.empujar}>Empujar {empujar}</span>}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Sin alertas</span>
                )}
              </TableCell>
            </TableRow>,
          ];
          if (m.versiones.length > 1) {
            for (const v of m.versiones) {
              filas.push(
                <FilaVersion key={`${k}|${v.version}`} abierta={abierto}>
                  <TableCell className="py-1.5 pl-[3.25rem] text-[13px]">{v.version}</TableCell>
                  <TableCell className="py-1.5 text-right tabular-nums text-[13px]">
                    {formatUnidades(v.libres + v.reservadas + v.enViaje + v.noVendible)}
                  </TableCell>
                  <TableCell className="py-1.5 text-right tabular-nums text-[13px]">
                    {n(v.libres)}
                    {v.reservadas > 0 && <Sub>{formatUnidades(v.reservadas)} con seña</Sub>}
                  </TableCell>
                  <TableCell className="py-1.5 text-right tabular-nums text-[13px] text-muted-foreground">{n(v.enViaje)}</TableCell>
                  <TableCell className="py-1.5 text-right tabular-nums text-[13px]">{ritmoTxt(v.ritmo)}</TableCell>
                  <TableCell className="py-1.5 text-right tabular-nums text-[13px]">{mesesTxt(v.meses)}</TableCell>
                  <TableCell className="py-1.5 text-right tabular-nums text-[13px] text-muted-foreground">
                    {v.precio ? formatUnidades(v.precio) : "—"}
                  </TableCell>
                  <TableCell className={cn("py-1.5 text-xs font-medium", TONO[v.accion])}>{ETIQUETA[v.accion]}</TableCell>
                </FilaVersion>
              );
            }
          }
          return filas;
        })}
        {otras && otras.marcas > 0 && (
          <TableRow className="text-muted-foreground">
            <TableCell className="pl-[3.25rem] italic">Otras {otras.marcas} marcas (canje y usados)</TableCell>
            <TableCell className="text-right tabular-nums">{formatUnidades(otras.unidades)}</TableCell>
            <TableCell colSpan={6} />
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

/** Fila de versión: se ve solo con el modelo abierto. `hidden` común (no
 *  «until-found»): ese valor pliega con content-visibility, que no se
 *  aplica a filas de tabla, y la fila quedaba siempre a la vista. */
function FilaVersion({
  abierta,
  children,
}: {
  abierta: boolean;
  children: React.ReactNode;
}) {
  return (
    <TableRow hidden={!abierta} className="bg-muted/15 hover:bg-muted/25">
      {children}
    </TableRow>
  );
}
