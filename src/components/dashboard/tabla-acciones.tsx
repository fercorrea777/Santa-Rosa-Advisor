"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatPct, formatUnidades } from "@/lib/format";
import type { AccionVersion } from "@/lib/informes/acciones";
import { nombreDeClave, type CruceFamilia } from "@/lib/informes/acciones-cruce";

/** Una familia (X50, TANK 300) con sus versiones del Excel y lo que el
 *  mercado y Cars dicen de ella. */
export interface FamiliaAcciones {
  clave: string;
  nombre: string;
  versiones: AccionVersion[];
  matriculaciones: CruceFamilia | null;
  importaciones: CruceFamilia | null;
  facturadas: CruceFamilia | null;
}

export interface EtiquetasCruce {
  matriculaciones: string;
  importaciones: string;
  facturadas: string | null;
}

/** La columna de la versión queda fija al scrollear de lado: con doce
 *  columnas la tabla no entra en una notebook y el nombre es lo único
 *  que no puede irse de la vista. El fondo tapa lo que pasa por debajo. */
const PEGADA = "sticky left-0 z-10 bg-card";

const usd = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : formatUnidades(Math.round(n));
const num = (n: number | null | undefined, decimales = 0) =>
  n === null || n === undefined
    ? "—"
    : new Intl.NumberFormat("es-PY", { maximumFractionDigits: decimales }).format(n);

/** Qué columnas opcionales muestra la tabla: solo las que alguna versión
 *  de la hoja trae con dato. Jetour tiene seña y soporte; Renault, precio
 *  máximo sin afectar comisión; Mitsubishi, la venta mayorista. */
function tiene(versiones: AccionVersion[], campo: keyof AccionVersion): boolean {
  return versiones.some((v) => v[campo] !== null && v[campo] !== undefined && v[campo] !== "");
}

/**
 * La planilla de acciones de UNA marca, familia por familia.
 *
 * Cada familia lleva una fila de contexto —cuánto matriculó, importó y
 * facturó ese modelo en el año, según CADAM y Cars— y debajo sus versiones
 * tal cual las escribió Fernando: PVP, descuento máximo, precio con
 * descuento, bono y mecánica. Costo y márgenes solo para el rol admin.
 * Tocar «detalle» abre el resto de la fila del Excel (precios sin IVA,
 * soporte de fábrica, precio máximo sin afectar comisión…).
 */
export function TablaAcciones({
  familias,
  etiquetas,
  esAdmin,
  totales,
}: {
  familias: FamiliaAcciones[];
  etiquetas: EtiquetasCruce;
  esAdmin: boolean;
  totales: { stock: number; enViaje: number; comprometido: number };
}) {
  const [abiertas, setAbiertas] = React.useState<Set<string>>(new Set());
  const alternar = (k: string) =>
    setAbiertas((prev) => {
      const s = new Set(prev);
      if (s.has(k)) s.delete(k);
      else s.add(k);
      return s;
    });

  const versiones = familias.flatMap((f) => f.versiones);
  const conSenia = tiene(versiones, "senia");
  const conBono = tiene(versiones, "bono") || tiene(versiones, "bono_texto");
  const conViaje = tiene(versiones, "en_viaje");
  const conAvg = tiene(versiones, "avg_ventas");
  const conObs = tiene(versiones, "observaciones");
  // Columnas que van al detalle desplegable, si la hoja las trae.
  const conSoporte = tiene(versiones, "soporte_total") || tiene(versiones, "soporte_fob");
  const conMaxComision = tiene(versiones, "precio_max_comision");
  const conNipon = tiene(versiones, "wholesale_nipon") || tiene(versiones, "stock_final");
  const conNeto = tiene(versiones, "margen_neto") || tiene(versiones, "vme");
  const hayDetalle = true;

  const columnas =
    3 + (conAvg ? 1 : 0) + (conViaje ? 1 : 0) + 2 + (conBono ? 1 : 0) + (conSenia ? 1 : 0) +
    (conObs ? 1 : 0) + (esAdmin ? 1 : 0) + (hayDetalle ? 1 : 0);

  return (
    <Table className="text-[13px]">
      <TableHeader>
        <TableRow>
          <TableHead className={PEGADA}>Versión</TableHead>
          {conAvg && (
            <TableHead className="text-right" nota="promedio, planilla">Ventas/mes</TableHead>
          )}
          <TableHead className="text-right">Stock</TableHead>
          {conViaje && <TableHead className="text-right" nota="en camino">En viaje</TableHead>}
          <TableHead className="text-right" nota="lista US$">PVP</TableHead>
          <TableHead className="text-right" nota="máximo US$">Dcto.</TableHead>
          <TableHead className="text-right" nota="PVP − dcto.">Precio c/dcto.</TableHead>
          {esAdmin && (
            <TableHead className="text-right" nota="US$ · % s/IVA, con dcto. máx.">Margen c/dcto.</TableHead>
          )}
          {conBono && <TableHead className="text-right" nota="al vendedor">Bono</TableHead>}
          {conSenia && <TableHead className="text-right">Seña</TableHead>}
          {conObs && <TableHead nota="cómo se aplica">Mecánica</TableHead>}
          {hayDetalle && <TableHead className="w-[1%]"><span className="sr-only">Detalle</span></TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {familias.flatMap((f) => [
          <TableRow key={`f-${f.clave}`} className="bg-muted/40 hover:bg-muted/40">
            <TableCell colSpan={columnas} className="py-1.5">
              {/* sticky adentro de la celda: el rótulo de la familia se queda
                  a la vista aunque la tabla esté scrolleada de lado. */}
              <div className="sticky left-3 flex w-fit max-w-full flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide">{f.nombre}</span>
                <span className="text-[11px] text-muted-foreground">
                  {f.versiones.length} {f.versiones.length === 1 ? "versión" : "versiones"}
                </span>
                <Cruce rotulo="Matric." etiqueta={etiquetas.matriculaciones} c={f.matriculaciones} />
                <Cruce rotulo="Import." etiqueta={etiquetas.importaciones} c={f.importaciones} />
                {etiquetas.facturadas && (
                  <Cruce rotulo="Fact. Cars" etiqueta={etiquetas.facturadas} c={f.facturadas} />
                )}
              </div>
            </TableCell>
          </TableRow>,
          ...f.versiones.flatMap((v) => {
            const k = `${f.clave}|${v.version}`;
            const abierta = abiertas.has(k);
            const dctoPct = v.pvp && v.descuento ? v.descuento / v.pvp : null;
            const filas = [
              <TableRow key={k} className={cn("group/fila", abierta && "border-b-0")}>
                <TableCell className={cn(PEGADA, "font-medium group-hover/fila:bg-muted/50")}>
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    <span>{v.version}</span>
                    {v.segmento && (
                      <Badge variant="outline" className="h-4 px-1.5 text-[10px] font-normal text-muted-foreground">
                        {v.segmento}
                      </Badge>
                    )}
                  </div>
                  {v.pvp_texto && (
                    <div className="text-xs text-muted-foreground">PVP: {v.pvp_texto}</div>
                  )}
                </TableCell>
                {conAvg && (
                  <TableCell className="text-right tabular-nums text-muted-foreground">{num(v.avg_ventas, 1)}</TableCell>
                )}
                <TableCell className="text-right tabular-nums">{num(v.stock)}</TableCell>
                {conViaje && (
                  <TableCell className="text-right tabular-nums text-muted-foreground">{num(v.en_viaje)}</TableCell>
                )}
                <TableCell className="text-right tabular-nums">{usd(v.pvp)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {(v.descuento ?? 0) > 0 ? (
                    <span className="font-semibold text-rose-600 dark:text-rose-400">
                      −{usd(v.descuento)}
                      {dctoPct !== null && (
                        <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                          {formatPct(dctoPct)}
                        </span>
                      )}
                    </span>
                  ) : v.descuento === 0 ? (
                    <span className="text-muted-foreground">sin dcto.</span>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums font-semibold">{usd(v.precio_descuento)}</TableCell>
                {esAdmin && (
                  <TableCell className="text-right tabular-nums">
                    <Margen valor={v.margen_descuento} pct={v.margen_descuento_pct} destacar />
                  </TableCell>
                )}
                {conBono && (
                  <TableCell className="text-right tabular-nums">
                    {v.bono_texto ? (
                      <span className="block max-w-[22ch] whitespace-normal text-left text-xs leading-snug">{v.bono_texto}</span>
                    ) : (v.bono ?? 0) > 0 ? (
                      <span className="font-semibold text-emerald-700 dark:text-emerald-400">{usd(v.bono)}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                )}
                {conSenia && (
                  <TableCell className="text-right tabular-nums text-muted-foreground">{usd(v.senia)}</TableCell>
                )}
                {conObs && (
                  <TableCell>
                    {v.observaciones ? (
                      <span className="block min-w-[18ch] max-w-[28ch] whitespace-normal text-xs leading-snug">{v.observaciones}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                )}
                {hayDetalle && (
                  <TableCell className="text-right">
                    <button
                      type="button"
                      onClick={() => alternar(k)}
                      aria-expanded={abierta}
                      className="rounded px-1.5 py-0.5 text-[11px] text-muted-foreground underline-offset-2 hover:bg-muted hover:text-foreground hover:underline"
                    >
                      {abierta ? "cerrar" : "detalle"}
                    </button>
                  </TableCell>
                )}
              </TableRow>,
            ];
            if (abierta) {
              filas.push(
                <TableRow key={`${k}-detalle`} className="bg-muted/20 hover:bg-muted/20">
                  <TableCell colSpan={columnas} className="py-2">
                    <dl className="sticky left-3 grid w-fit max-w-[calc(100vw-20rem)] grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-3 lg:grid-cols-4">
                      <Dato rotulo="PVP s/IVA" valor={usd(v.pvp_sin_iva)} />
                      <Dato rotulo="Precio c/dcto. s/IVA" valor={usd(v.precio_descuento_sin_iva)} />
                      {esAdmin && <Dato rotulo="Costo SR" valor={usd(v.costo)} />}
                      {esAdmin && (
                        <Dato
                          rotulo="Margen sin descuento"
                          valor={`${usd(v.margen)}${v.margen_pct !== null ? ` · ${formatPct(v.margen_pct)}` : ""}`}
                        />
                      )}
                      {esAdmin && conNeto && <Dato rotulo="Margen neto" valor={usd(v.margen_neto)} />}
                      {esAdmin && conNeto && <Dato rotulo="VME" valor={usd(v.vme)} />}
                      {conMaxComision && (
                        <Dato rotulo="Precio máx. sin afectar comisión" valor={usd(v.precio_max_comision)} />
                      )}
                      {conSoporte && <Dato rotulo="Soporte FOB" valor={usd(v.soporte_fob)} />}
                      {conSoporte && <Dato rotulo="Soporte por venta" valor={usd(v.soporte_venta)} />}
                      {conSoporte && <Dato rotulo="Total soporte" valor={usd(v.soporte_total)} />}
                      {esAdmin && conSoporte && (
                        <Dato
                          rotulo="Margen con soporte"
                          valor={`${usd(v.margen_soporte)}${v.margen_soporte_pct !== null ? ` · ${formatPct(v.margen_soporte_pct)}` : ""}`}
                        />
                      )}
                      {conNipon && <Dato rotulo="Venta wholesale Nipon" valor={num(v.wholesale_nipon)} />}
                      {conNipon && <Dato rotulo="Stock final SR" valor={num(v.stock_final)} />}
                      {!conBono && (v.bono || v.bono_texto) && (
                        <Dato rotulo="Bono vendedor" valor={v.bono_texto ?? usd(v.bono)} />
                      )}
                    </dl>
                  </TableCell>
                </TableRow>
              );
            }
            return filas;
          }),
        ])}
        <TableRow className="bg-muted/40 font-semibold hover:bg-muted/40">
          <TableCell colSpan={columnas} className="py-2">
            <div className="sticky left-3 flex w-fit max-w-full flex-wrap items-baseline gap-x-4 gap-y-1 text-xs">
              <span className="uppercase tracking-wide">Total marca</span>
              <span>Stock {formatUnidades(totales.stock)}</span>
              {totales.enViaje > 0 && <span>En viaje {formatUnidades(totales.enViaje)}</span>}
              <Tooltip>
                <TooltipTrigger render={<span className="cursor-help underline decoration-dotted underline-offset-2" />}>
                  Descuento comprometido US$ {formatUnidades(Math.round(totales.comprometido))}
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  Stock × descuento máximo de cada versión: lo que costaría vender
                  todo el stock de hoy al precio con descuento. Es una cota, no
                  un pronóstico.
                </TooltipContent>
              </Tooltip>
            </div>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}

function Margen({ valor, pct, destacar }: { valor: number | null; pct: number | null; destacar?: boolean }) {
  if (valor === null) return <>—</>;
  const negativo = valor < 0;
  return (
    <span className={cn(negativo && "text-rose-600 dark:text-rose-400", destacar && !negativo && "text-foreground")}>
      {usd(valor)}
      {pct !== null && (
        <span className="ml-1 text-[11px] text-muted-foreground">{formatPct(pct)}</span>
      )}
    </span>
  );
}

function Dato({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{rotulo}</dt>
      <dd className="tabular-nums">{valor}</dd>
    </div>
  );
}

function Cruce({ rotulo, etiqueta, c }: { rotulo: string; etiqueta: string; c: CruceFamilia | null }) {
  const contenido = (
    <span className="text-[11px] text-muted-foreground">
      {rotulo} <span className="text-muted-foreground/70">{etiqueta}</span>{" "}
      <span className={cn("font-semibold tabular-nums", c ? "text-foreground" : "text-muted-foreground")}>
        {c ? formatUnidades(c.unidades) : "—"}
      </span>
      {c?.aproximado && <span aria-hidden="true"> ≈</span>}
    </span>
  );
  if (!c) return contenido;
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="cursor-help" />}>{contenido}</TooltipTrigger>
      <TooltipContent className="max-w-xs">
        {c.aproximado
          ? `Esa fuente no tiene un modelo con este nombre exacto; se muestra «${c.aproximado.split(" + ").map(nombreDeClave).join(" + ")}»: `
          : "Suma de: "}
        {c.modelos.join(", ")}.
      </TooltipContent>
    </Tooltip>
  );
}
