"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import { IconChevron } from "@/components/icons";
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

/** La columna de la versión queda fija al scrollear de lado: con nueve
 *  columnas la tabla no entra en una notebook y el nombre es lo único que
 *  no puede irse de la vista. El fondo tapa lo que pasa por debajo y sigue
 *  al hover de la fila para que no se vea el corte. */
const FONDO_HOVER = "group-hover/fila:bg-[color-mix(in_oklab,var(--muted)_50%,var(--card))]";
// Tailwind genera solo las clases que ve escritas: las dos van literales.
const FONDO_FAMILIA = "bg-[color-mix(in_oklab,var(--muted)_40%,var(--card))] group-hover/fila:bg-[color-mix(in_oklab,var(--muted)_40%,var(--card))]";
const PEGADA = `sticky left-0 z-10 bg-card transition-colors ${FONDO_HOVER}`;
/** Las tres columnas del mercado (matric., import., fact.) quedan fijas a
 *  la DERECHA: son el vínculo con el mercado que pidió Fernando y no pueden
 *  quedar detrás del scroll en una notebook. Ancho fijo para calcular el
 *  corrimiento de cada una. */
const ANCHO_MERCADO_REM = 4;
const PEGADA_DER = `sticky z-10 bg-card transition-colors ${FONDO_HOVER}`;
const derecha = (desdeElBorde: number): React.CSSProperties => ({
  right: `${desdeElBorde * ANCHO_MERCADO_REM}rem`,
  width: `${ANCHO_MERCADO_REM}rem`,
  minWidth: `${ANCHO_MERCADO_REM}rem`,
});
const FOCO = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-1";

const usd = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : formatUnidades(Math.round(n));
const num = (n: number | null | undefined, decimales = 0) =>
  n === null || n === undefined
    ? ""
    : new Intl.NumberFormat("es-PY", { maximumFractionDigits: decimales }).format(n);

function tiene(versiones: AccionVersion[], campo: keyof AccionVersion): boolean {
  return versiones.some((v) => v[campo] !== null && v[campo] !== undefined && v[campo] !== "");
}

/**
 * La planilla de acciones de UNA marca, familia por familia.
 *
 * Cada familia es un subencabezado: el nombre, su segmento y —a la
 * derecha, en columnas propias— cuánto matriculó, importó y facturó ese
 * modelo en el año (CADAM y Cars). Debajo, sus versiones tal cual las
 * escribió Fernando: ventas por mes, stock (y en viaje), precio de lista,
 * precio con descuento y cuánto se descontó, margen con descuento (solo
 * admin), bono al vendedor y mecánica. El chevron al lado del nombre abre
 * el resto de la fila del Excel (precios sin IVA, costo, soporte de
 * fábrica, precio máximo sin afectar comisión…).
 *
 * Lo vacío queda vacío: en una planilla donde la mitad de las celdas no
 * tiene dato, un «—» en cada una es lo primero que se ve y lo último que
 * importa. Solo el precio ausente se marca, porque ahí sí falta algo.
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
  const abrir = React.useCallback(
    (k: string) => setAbiertas((prev) => (prev.has(k) ? prev : new Set(prev).add(k))),
    []
  );

  const versiones = familias.flatMap((f) => f.versiones);
  const conBono = tiene(versiones, "bono") || tiene(versiones, "bono_texto");
  const conAvg = tiene(versiones, "avg_ventas");
  const conObs = tiene(versiones, "observaciones");
  const conSenia = tiene(versiones, "senia");
  // Lo que va al detalle desplegable, si la hoja lo trae.
  const conSoporte = tiene(versiones, "soporte_total") || tiene(versiones, "soporte_fob");
  const conMaxComision = tiene(versiones, "precio_max_comision");
  const conNipon = tiene(versiones, "wholesale_nipon") || tiene(versiones, "stock_final");
  const conNeto = tiene(versiones, "margen_neto") || tiene(versiones, "vme");
  const conCars = etiquetas.facturadas !== null;

  // Versión · [ventas/mes] · stock · PVP · con descuento · [margen] ·
  // [bono] · [seña] · [mecánica] — y las tres del mercado, que solo se
  // llenan en la fila de familia.
  const columnas =
    1 + (conAvg ? 1 : 0) + 1 + 2 + (esAdmin ? 1 : 0) + (conBono ? 1 : 0) + (conSenia ? 1 : 0) +
    (conObs ? 1 : 0) + 2 + (conCars ? 1 : 0);
  const antesDelMercado = columnas - 2 - (conCars ? 1 : 0);
  // Corrimiento de cada columna del mercado desde el borde derecho.
  const posMat = conCars ? 2 : 1;
  const posImp = conCars ? 1 : 0;

  return (
    <Table className="text-[13px]">
      <TableHeader>
        <TableRow>
          <TableHead className={cn(PEGADA, "min-w-[12rem]")}>Versión</TableHead>
          {conAvg && <TableHead className="text-right" nota="promedio">Vtas./mes</TableHead>}
          <TableHead className="text-right" nota="+ en viaje">Stock</TableHead>
          <TableHead className="text-right" nota="lista, US$">PVP</TableHead>
          <TableHead className="text-right" nota="y cuánto">Con dcto.</TableHead>
          {esAdmin && <TableHead className="text-right" nota="c/ dcto. máx.">Margen</TableHead>}
          {conBono && <TableHead className="text-right" nota="vendedor">Bono</TableHead>}
          {conSenia && <TableHead className="text-right" nota="US$">Seña</TableHead>}
          {conObs && <TableHead nota="cómo se aplica">Mecánica</TableHead>}
          <TableHead className={cn(PEGADA_DER, "border-l text-right")} style={derecha(posMat)} nota={etiquetas.matriculaciones}>Matric.</TableHead>
          <TableHead className={cn(PEGADA_DER, "text-right")} style={derecha(posImp)} nota={etiquetas.importaciones}>Import.</TableHead>
          {conCars && (
            <TableHead className={cn(PEGADA_DER, "text-right")} style={derecha(0)} nota={etiquetas.facturadas ?? undefined}>Fact.</TableHead>
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {familias.flatMap((f) => {
          const segmentos = [...new Set(f.versiones.map((v) => v.segmento).filter(Boolean))];
          return [
            <TableRow key={`f-${f.clave}`} className="group/fila bg-muted/40 hover:bg-muted/40">
              <TableCell className={cn(PEGADA, FONDO_FAMILIA, "py-1.5")}>
                <div className="flex items-center gap-2">
                  {/* Color de acento (pedido de Fernando, 15/09): el rótulo
                      de la familia tiene que leerse como título del modelo. */}
                  <span className="text-xs font-bold uppercase tracking-wide text-primary">{f.nombre}</span>
                  {segmentos.map((s) => (
                    <Badge key={s} variant="outline" className="h-4 px-1.5 text-[10px] font-normal text-muted-foreground">
                      {s}
                    </Badge>
                  ))}
                  <span className="text-[11px] text-muted-foreground">
                    {f.versiones.length} {f.versiones.length === 1 ? "versión" : "versiones"}
                  </span>
                </div>
              </TableCell>
              <TableCell colSpan={antesDelMercado - 1} className="py-1.5" />
              <TableCell className={cn(PEGADA_DER, FONDO_FAMILIA, "border-l py-1.5 text-right")} style={derecha(posMat)}>
                <Cruce c={f.matriculaciones} />
              </TableCell>
              <TableCell className={cn(PEGADA_DER, FONDO_FAMILIA, "py-1.5 text-right")} style={derecha(posImp)}>
                <Cruce c={f.importaciones} />
              </TableCell>
              {conCars && (
                <TableCell className={cn(PEGADA_DER, FONDO_FAMILIA, "py-1.5 text-right")} style={derecha(0)}>
                  <Cruce c={f.facturadas} />
                </TableCell>
              )}
            </TableRow>,
            ...f.versiones.flatMap((v) => {
              const k = `${f.clave}|${v.version}`;
              const abierta = abiertas.has(k);
              const dcto = v.descuento ?? 0;
              const dctoPct = v.pvp && dcto ? dcto / v.pvp : null;
              const filas = [
                <TableRow key={k} className={cn("group/fila", abierta && "border-b-0")}>
                  <TableCell className={cn(PEGADA, "font-medium")}>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => alternar(k)}
                        aria-expanded={abierta}
                        aria-label={abierta ? `Cerrar el detalle de ${v.version}` : `Ver el detalle de ${v.version}`}
                        className={cn(
                          "-ml-1 flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground",
                          FOCO
                        )}
                      >
                        <IconChevron
                          size={13}
                          className={cn("transition-transform duration-150", !abierta && "-rotate-90")}
                        />
                      </button>
                      <span className="whitespace-nowrap">{v.version}</span>
                    </div>
                    {v.pvp_texto && (
                      <div className="pl-6 text-xs text-muted-foreground">PVP: {v.pvp_texto}</div>
                    )}
                  </TableCell>
                  {conAvg && (
                    <TableCell className="text-right tabular-nums text-muted-foreground">{num(v.avg_ventas, 1)}</TableCell>
                  )}
                  <TableCell className="text-right tabular-nums">
                    {num(v.stock)}
                    {(v.en_viaje ?? 0) > 0 && (
                      <span className="block text-[11px] leading-tight text-muted-foreground">+{num(v.en_viaje)} en viaje</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{usd(v.pvp)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {dcto > 0 ? (
                      <>
                        <span className="font-semibold">{usd(v.precio_descuento)}</span>
                        <span className="block text-[11px] leading-tight text-rose-600 dark:text-rose-400">
                          −{usd(dcto)}{dctoPct !== null ? ` · ${formatPct(dctoPct)}` : ""}
                        </span>
                      </>
                    ) : v.pvp !== null ? (
                      <span className="text-muted-foreground">sin dcto.</span>
                    ) : (
                      ""
                    )}
                  </TableCell>
                  {esAdmin && (
                    <TableCell className="text-right tabular-nums">
                      <Margen valor={v.margen_descuento} pct={v.margen_descuento_pct} />
                    </TableCell>
                  )}
                  {conBono && (
                    <TableCell className="text-right tabular-nums">
                      {v.bono_texto ? (
                        <span className="block max-w-[22ch] whitespace-normal text-left text-xs leading-snug">{v.bono_texto}</span>
                      ) : (v.bono ?? 0) > 0 ? (
                        <span className="font-semibold text-emerald-700 dark:text-emerald-400">{usd(v.bono)}</span>
                      ) : (
                        ""
                      )}
                    </TableCell>
                  )}
                  {conSenia && (
                    <TableCell className="text-right tabular-nums text-muted-foreground">{v.senia !== null ? usd(v.senia) : ""}</TableCell>
                  )}
                  {conObs && (
                    <TableCell>
                      {v.observaciones && (
                        <span className="block min-w-[12ch] max-w-[26ch] whitespace-normal text-xs leading-snug text-muted-foreground">{v.observaciones}</span>
                      )}
                    </TableCell>
                  )}
                  <TableCell className={cn(PEGADA_DER, "border-l")} style={derecha(posMat)} />
                  <TableCell className={PEGADA_DER} style={derecha(posImp)} />
                  {conCars && <TableCell className={PEGADA_DER} style={derecha(0)} />}
                </TableRow>,
              ];
              // El detalle está SIEMPRE en el DOM, oculto con
              // hidden="until-found": Ctrl+F encuentra "Soporte FOB" o un
              // costo aunque la fila esté cerrada, y al encontrarlo la abre
              // (guía "search-hidden-content").
              filas.push(
                <FilaDetalle key={`${k}-detalle`} abierta={abierta} onAbrir={() => abrir(k)}>
                    <TableCell colSpan={columnas} className="py-2 pl-9">
                      <dl className="sticky left-9 grid w-fit max-w-[calc(100vw-22rem)] grid-cols-2 gap-x-6 gap-y-1.5 text-xs sm:grid-cols-3 lg:grid-cols-4">
                        <Dato rotulo="PVP s/IVA" valor={usd(v.pvp_sin_iva)} />
                        <Dato rotulo="Con dcto. s/IVA" valor={usd(v.precio_descuento_sin_iva)} />
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
                        {conNipon && <Dato rotulo="Venta wholesale Nipon" valor={num(v.wholesale_nipon) || "—"} />}
                        {conNipon && <Dato rotulo="Stock final SR" valor={num(v.stock_final) || "—"} />}
                        {v.segmento && <Dato rotulo="Segmento" valor={v.segmento} />}
                      </dl>
                    </TableCell>
                </FilaDetalle>
              );
              return filas;
            }),
          ];
        })}
        <TableRow className="group/fila bg-muted/40 font-semibold hover:bg-muted/40">
          <TableCell className={cn(PEGADA, FONDO_FAMILIA, "py-2 text-xs uppercase tracking-wide")}>
            Total marca
          </TableCell>
          <TableCell colSpan={columnas - 1} className="py-2">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs">
              <span>Stock {formatUnidades(totales.stock)}</span>
              {totales.enViaje > 0 && <span>En viaje {formatUnidades(totales.enViaje)}</span>}
              <Tooltip>
                <TooltipTrigger
                  render={<button type="button" className={cn("cursor-help rounded underline decoration-dotted underline-offset-2", FOCO)} />}
                >
                  Descuento comprometido US$&nbsp;{formatUnidades(Math.round(totales.comprometido))}
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

/**
 * Fila de detalle que se puede ENCONTRAR cerrada. `hidden="until-found"`
 * la oculta pero la deja en el índice de "buscar en la página" y de los
 * enlaces a texto; cuando el navegador la encuentra dispara `beforematch`,
 * le saca el atributo y acá se sincroniza el estado (la fila queda abierta
 * y el chevron gira). React escribe `hidden=""` en el servidor —vale como
 * oculto— y el efecto lo cambia a `until-found` al montar.
 */
function FilaDetalle({
  abierta,
  onAbrir,
  children,
}: {
  abierta: boolean;
  onAbrir: () => void;
  children: React.ReactNode;
}) {
  const ref = React.useRef<HTMLTableRowElement>(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (abierta) el.removeAttribute("hidden");
    else el.setAttribute("hidden", "until-found");
  }, [abierta]);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.addEventListener("beforematch", onAbrir);
    return () => el.removeEventListener("beforematch", onAbrir);
  }, [onAbrir]);
  return (
    <TableRow ref={ref} hidden={!abierta} className="bg-muted/20 hover:bg-muted/20">
      {children}
    </TableRow>
  );
}

function Margen({ valor, pct }: { valor: number | null; pct: number | null }) {
  if (valor === null) return null;
  const negativo = valor < 0;
  return (
    <span className={cn(negativo && "font-semibold text-rose-600 dark:text-rose-400")}>
      {usd(valor)}
      {pct !== null && (
        <span className="block text-[11px] leading-tight text-muted-foreground">{formatPct(pct)}</span>
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

/** Una cifra del mercado o de Cars en la fila de familia. Con «≈» cuando
 *  esa fuente no tiene la familia con ese nombre exacto; el tooltip (que
 *  también se abre con teclado) dice qué se sumó. */
function Cruce({ c }: { c: CruceFamilia | null }) {
  if (!c) return <span className="text-muted-foreground/60">—</span>;
  const etiqueta = c.aproximado
    ? `Esa fuente no tiene la familia con este nombre exacto; se muestra «${c.aproximado.split(" + ").map(nombreDeClave).join(" + ")}»: ${c.modelos.join(", ")}.`
    : `Suma de: ${c.modelos.join(", ")}.`;
  return (
    <Tooltip>
      <TooltipTrigger
        render={<button type="button" className={cn("cursor-help rounded tabular-nums text-xs font-semibold", FOCO)} />}
      >
        {formatUnidades(c.unidades)}
        {c.aproximado && <span className="ml-0.5 font-normal text-muted-foreground" aria-label="aproximado">≈</span>}
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{etiqueta}</TooltipContent>
    </Tooltip>
  );
}
