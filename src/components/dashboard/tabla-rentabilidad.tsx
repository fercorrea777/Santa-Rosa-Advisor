import * as React from "react";
import { LogoMarca } from "@/components/dashboard/logo-marca";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatPct, formatUnidades } from "@/lib/format";
import type {
  FamiliaRentabilidad, Rentabilidad, SinCruce, VersionRentabilidad,
} from "@/lib/informes/rentabilidad";

/**
 * Las dos tablas que pidió Fernando (18/09/2026), lado a lado en UNA:
 *
 *   BASE (la planilla)        | VENTAS (Cars)
 *   PVP · Margen · Margen %   | Cant. vendida · Ticket · Margen · Margen %
 *
 * Una sola tabla con dos bloques y no dos tablas separadas: comparten la
 * columna de marca, modelo y versión, así cada fila se lee de corrido de un
 * bloque al otro, y entra en una notebook. Dos tablas "al lado" solo cabían
 * desde 1.536 px; más angostas se apilaban y la comparación se perdía.
 *
 * Debajo de cada valor va su composición: qué parte del total del filtro
 * es ("todas las columnas con eso, excepto la de margen %, esa queda solo
 * con ese valor").
 */

type Fila =
  | { tipo: "familia"; f: FamiliaRentabilidad }
  | { tipo: "version"; f: FamiliaRentabilidad; v: VersionRentabilidad }
  | { tipo: "sinPareja"; f: FamiliaRentabilidad; s: SinCruce }
  | { tipo: "sinPlanilla"; marca: string; s: SinCruce };

function filasDe(r: Rentabilidad): Fila[] {
  const out: Fila[] = [];
  for (const m of r.marcas) {
    for (const f of m.familias) {
      out.push({ tipo: "familia", f });
      for (const v of f.versiones) out.push({ tipo: "version", f, v });
      for (const s of f.sinPareja) out.push({ tipo: "sinPareja", f, s });
    }
    for (const s of m.sinPlanilla) out.push({ tipo: "sinPlanilla", marca: m.marca, s });
  }
  return out;
}

const claveDe = (fila: Fila): string => {
  switch (fila.tipo) {
    case "familia": return `f|${fila.f.marca}|${fila.f.clave}`;
    case "version": return `v|${fila.f.marca}|${fila.f.clave}|${fila.v.version}`;
    case "sinPareja": return `s|${fila.f.marca}|${fila.f.clave}|${fila.s.nombre}`;
    case "sinPlanilla": return `p|${fila.marca}|${fila.s.nombre}`;
  }
};

const FOCO = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-1";
/** El borde que separa los dos bloques, en encabezado y celdas. */
const CORTE = "border-l border-border";

const usd = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : formatUnidades(Math.round(n));
const pct = (n: number | null | undefined) => (n === null || n === undefined || !Number.isFinite(n) ? null : n);

/** Un valor con su composición abajo, chica y apagada. */
function Valor({
  valor, parte, negativo, tenue, fuerte,
}: {
  valor: string;
  parte?: number | null;
  negativo?: boolean;
  tenue?: boolean;
  fuerte?: boolean;
}) {
  return (
    <span className={cn("block tabular-nums", fuerte && "font-semibold", tenue && "text-muted-foreground", negativo && "font-semibold text-rose-600 dark:text-rose-400")}>
      {valor}
      {parte !== null && parte !== undefined && (
        <span className="block text-[11px] font-normal leading-tight text-muted-foreground">{formatPct(parte)}</span>
      )}
    </span>
  );
}

export function TablaRentabilidad({
  r, mes, periodo,
}: {
  r: Rentabilidad;
  /** "Septiembre 2026": de qué planilla salen PVP y márgenes. */
  mes: string;
  /** "Ene–Sep 2026": de qué período son las ventas. */
  periodo: string;
}) {
  const filas = filasDe(r);
  const t = r.totales;
  const parteU = (u: number | null) => (u !== null && t.unidades > 0 ? u / t.unidades : null);
  const parteF = (x: number | null) => (x !== null && t.facturacion > 0 ? x / t.facturacion : null);
  const parteM = (x: number | null) => (x !== null && t.margenTotal > 0 ? x / t.margenTotal : null);
  const partePvp = (x: number | null) => (x !== null && t.sumaPvp > 0 ? x / t.sumaPvp : null);
  const parteMb = (x: number | null) => (x !== null && t.sumaMargen > 0 ? x / t.sumaMargen : null);
  const ticketTotal = t.unidadesCruzadas > 0 ? t.facturacion / t.unidadesCruzadas : null;
  const margenUnidadTotal = t.unidadesCruzadas > 0 ? t.margenTotal / t.unidadesCruzadas : null;

  return (
    <Table className="sin-cebra text-[13px]">
      <TableHeader>
        {/* Fila de bloques: dice de dónde sale cada lado. */}
        <TableRow className="hover:bg-transparent">
          <TableHead className="h-8" />
          <TableHead colSpan={3} className="h-8 text-center text-[11px] text-foreground/80">
            Base · planilla de {mes}
          </TableHead>
          <TableHead colSpan={4} className={cn("h-8 bg-muted/40 text-center text-[11px] text-foreground/80", CORTE)}>
            Ventas · Cars {periodo}
          </TableHead>
        </TableRow>
        <TableRow>
          <TableHead className="w-[16rem] min-w-[16rem]" nota="marca, modelo y versión">Versión</TableHead>
          <TableHead className="text-right" nota="lista US$ · % del total">PVP base</TableHead>
          <TableHead className="text-right" nota="US$, sin descuento · % del total">Margen base</TableHead>
          <TableHead className="text-right" nota="sobre el PVP sin IVA">Margen % base</TableHead>
          <TableHead className={cn("bg-muted/40 text-right", CORTE)} nota="facturadas · % del total">Cant. vendida</TableHead>
          <TableHead className="bg-muted/40 text-right" nota="US$ a precio de acción · % de la facturación">Ticket prom.</TableHead>
          <TableHead className="bg-muted/40 text-right" nota="US$ por unidad · % del margen">Margen prom.</TableHead>
          <TableHead className="bg-muted/40 text-right" nota="sobre el ticket sin IVA">Margen prom. %</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filas.map((fila) => {
          if (fila.tipo === "familia") {
            const f = fila.f;
            return (
              <TableRow key={claveDe(fila)} className="bg-muted/40 hover:bg-muted/40">
                <TableCell className="py-1.5">
                  {/* Ancho tope en toda la columna: los nombres de Cars sin
                      planilla son largos y, sin tope, la ensanchaban hasta
                      empujar el bloque de ventas fuera de la tarjeta. */}
                  <span className="flex max-w-[16rem] items-center gap-2">
                    <LogoMarca marca={f.marca} />
                    <span className="truncate text-xs font-bold uppercase tracking-wide text-primary">{f.nombre}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {f.versiones.length} {f.versiones.length === 1 ? "versión" : "versiones"}
                    </span>
                  </span>
                </TableCell>
                <TableCell colSpan={3} className="py-1.5" />
                <TableCell className={cn("py-1.5 text-right font-semibold", CORTE)}>
                  <Valor valor={f.unidades > 0 ? formatUnidades(f.unidades) : "—"} parte={f.unidades > 0 ? pct(parteU(f.unidades)) : null} />
                </TableCell>
                <TableCell className="py-1.5 text-right">
                  <Valor valor={usd(f.ticket)} parte={f.ticket !== null ? pct(parteF(f.facturacion)) : null} />
                </TableCell>
                <TableCell className="py-1.5 text-right">
                  <Valor valor={usd(f.margenUnidad)} parte={f.margenUnidad !== null ? pct(parteM(f.margenTotal)) : null} negativo={(f.margenUnidad ?? 0) < 0} />
                </TableCell>
                <TableCell className="py-1.5 text-right">
                  <Valor valor={f.margenPct === null ? "—" : formatPct(f.margenPct)} negativo={(f.margenPct ?? 0) < 0} />
                </TableCell>
              </TableRow>
            );
          }
          if (fila.tipo !== "version") {
            const s = fila.s;
            return (
              <TableRow key={claveDe(fila)}>
                <TableCell className="py-1.5">
                  {fila.tipo === "sinPareja" ? (
                    <span
                      className="flex max-w-[16rem] items-center gap-1.5 pl-7 text-xs italic text-muted-foreground"
                      title={`${s.nombre}: facturada en Cars, sin fila en la planilla`}
                    >
                      <span className="truncate">{s.nombre}</span>
                      <SinPlanilla />
                    </span>
                  ) : (
                    <span
                      className="flex max-w-[16rem] items-center gap-2 text-xs italic text-muted-foreground"
                      title={`${s.nombre}: facturada en Cars, su familia no está en la planilla`}
                    >
                      <LogoMarca marca={fila.marca} />
                      <span className="truncate">{s.nombre}</span>
                      <SinPlanilla />
                    </span>
                  )}
                </TableCell>
                <TableCell colSpan={3} className="py-1.5 text-center text-muted-foreground/60">—</TableCell>
                <TableCell className={cn("py-1.5 text-right", CORTE)}>
                  <Valor valor={formatUnidades(s.unidades)} parte={pct(parteU(s.unidades))} tenue />
                </TableCell>
                <TableCell colSpan={3} className="py-1.5 text-center text-muted-foreground/60">—</TableCell>
              </TableRow>
            );
          }
          const v = fila.v;
          const sinVenta = v.unidades === null;
          return (
            <TableRow key={claveDe(fila)}>
              <TableCell className="py-1.5">
                <span className="block max-w-[16rem] truncate pl-7 font-medium" title={v.version}>{v.version}</span>
              </TableCell>
              <TableCell className="py-1.5 text-right">
                <Valor valor={usd(v.pvp)} parte={pct(partePvp(v.pvp))} />
              </TableCell>
              <TableCell className="py-1.5 text-right">
                <Valor valor={usd(v.margen)} parte={pct(parteMb(v.margen))} negativo={(v.margen ?? 0) < 0} />
              </TableCell>
              <TableCell className="py-1.5 text-right">
                <Valor valor={v.margenPct === null ? "—" : formatPct(v.margenPct)} negativo={(v.margenPct ?? 0) < 0} />
              </TableCell>
              <TableCell className={cn("py-1.5 text-right", CORTE)}>
                {sinVenta ? (
                  <Valor valor="—" tenue />
                ) : (
                  <Cruzada v={v}>
                    <Valor valor={formatUnidades(v.unidades as number)} parte={pct(parteU(v.unidades))} />
                  </Cruzada>
                )}
              </TableCell>
              <TableCell className="py-1.5 text-right">
                <Valor valor={usd(v.ticket)} parte={sinVenta ? null : pct(parteF(v.facturacion))} tenue={sinVenta} />
              </TableCell>
              <TableCell className="py-1.5 text-right">
                <Valor
                  valor={usd(v.margenAccion)}
                  parte={sinVenta ? null : pct(parteM(v.margenTotal))}
                  negativo={(v.margenAccion ?? 0) < 0}
                  tenue={sinVenta}
                />
              </TableCell>
              <TableCell className="py-1.5 text-right">
                <Valor
                  valor={v.margenAccionPct === null ? "—" : formatPct(v.margenAccionPct)}
                  negativo={(v.margenAccionPct ?? 0) < 0}
                  tenue={sinVenta}
                />
              </TableCell>
            </TableRow>
          );
        })}
        <TableRow className="bg-muted/40 font-semibold hover:bg-muted/40">
          <TableCell className="py-2 text-xs uppercase tracking-wide">Total del filtro</TableCell>
          <TableCell colSpan={3} className="py-2 text-right text-xs font-normal text-muted-foreground">
            {formatUnidades(t.versiones)} versiones · {formatUnidades(t.versionesConVenta)} con venta
          </TableCell>
          <TableCell className={cn("py-2 text-right tabular-nums", CORTE)}>{formatUnidades(t.unidades)}</TableCell>
          <TableCell className="py-2 text-right tabular-nums">{usd(ticketTotal)}</TableCell>
          <TableCell className="py-2 text-right tabular-nums">{usd(margenUnidadTotal)}</TableCell>
          <TableCell className="py-2 text-right tabular-nums">{t.margenPct === null ? "—" : formatPct(t.margenPct)}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}

/** Marca de una fila de Cars que la planilla no tiene. */
function SinPlanilla() {
  return (
    <span className="shrink-0 rounded bg-muted px-1 text-[10px] not-italic leading-4 text-muted-foreground">
      sin planilla
    </span>
  );
}

/** Las unidades de una versión cruzada con Cars: el tooltip dice qué fila
 *  de Cars es, y «≈» cuando el cruce no fue por el nombre entero. */
function Cruzada({ v, children }: { v: VersionRentabilidad; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<button type="button" className={cn("ml-auto inline-flex cursor-help items-start justify-end gap-0.5 rounded text-right", FOCO)} />}
      >
        {children}
        {v.aproximado && <span className="text-xs font-normal text-muted-foreground" aria-label="cruce aproximado">≈</span>}
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        {v.aproximado
          ? `Cars la llama «${v.carsNombre}»: el cruce con «${v.version}» es por familia, parte del nombre y precio, no por el nombre entero.`
          : `En Cars: «${v.carsNombre}».`}
      </TooltipContent>
    </Tooltip>
  );
}
