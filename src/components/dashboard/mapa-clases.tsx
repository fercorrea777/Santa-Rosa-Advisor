"use client";

import { useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatPct, formatUnidades } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * El mapa del mercado, clase por clase, y el detalle de cada casillero al
 * hacer clic.
 *
 * POR QUÉ ES INTERACTIVO. La tabla contesta "cuánto se vende acá y cuánto es
 * nuestro". La pregunta que sigue —"¿y quién se lo lleva, a qué precio, con
 * qué motor?"— no entra en una celda de 80 píxeles, y ponerla en un tooltip
 * la deja fuera del alcance de quien mira en una tablet. Cada casillero es un
 * botón: se abre con clic o con Enter y muestra la comparativa entera.
 *
 * POR QUÉ HAY MARCAS Y NO SOLO COLOR. El tinte dice cuánto es nuestro, pero
 * un casillero claro puede ser la mayor oportunidad del año o quince unidades
 * que no le importan a nadie: se ven igual. La marca cruza cuánto PESA el
 * casillero con cuánto es NUESTRO, que es la lectura que el gerente necesita.
 */

export type AccionCasillero = "entrar" | "defender";

export interface ModeloCasillero {
  marca: string;
  modelo: string;
  unidades: number;
  precio: number | null;
  tecnologia?: string;
  esPropia: boolean;
}

export interface CeldaMapa {
  fila: string;
  columna: string;
  mercado: number;
  propias: number;
  /** Los que más venden en el casillero, ya recortados por el servidor. */
  modelos: ModeloCasillero[];
  /** Cuántos modelos hay en total (los mostrados pueden ser menos). */
  modelosTotal: number;
  /** Medianas de precio dentro del casillero, con cuántos precios las
   *  sostienen: una "mediana" de un solo precio se dice, no se disfraza. */
  precioNuestro: number | null;
  precioRival: number | null;
  nPreciosNuestros: number;
  nPreciosRivales: number;
}

export interface ColumnaMapa {
  clave: string;
  etiqueta: string;
  /** No lleva marca de acción: es un hueco de datos, no una posición. */
  sinAccion?: boolean;
}

/** 0% nada; 30% o más, el tope. La misma escala en el mapa y en la leyenda. */
export const tinte = (share: number) =>
  share > 0 ? `color-mix(in oklch, var(--primary) ${Math.min(45, Math.round(share * 150))}%, transparent)` : undefined;

/** Mismas varas que lecturaCasillero (bandas.ts). "Entrar" se mide contra el
 *  mercado; "defender", contra nuestro propio volumen: el grupo tiene ~6% del
 *  mercado y con una sola vara la mitad fuerte del mapa quedaba vacía. */
const PESO_RELEVANTE = 0.03;
const PESO_PROPIO = 0.05;
const SHARE_AUSENTE = 0.05;
const SHARE_FUERTE = 0.2;

export function MapaClases({
  filas,
  columnas,
  celdas,
  /** Cómo se llama una columna al explicarla: "banda de precio" o "motorización". */
  nombreColumna,
  /** Para la frase del detalle: "Ene–Jul 2026". */
  periodo,
}: {
  filas: string[];
  columnas: ColumnaMapa[];
  celdas: CeldaMapa[];
  nombreColumna: string;
  periodo: string;
}) {
  const [abierto, setAbierto] = useState<CeldaMapa | null>(null);

  const porClave = new Map(celdas.map((c) => [`${c.fila}|${c.columna}`, c]));
  const celda = (f: string, c: string) => porClave.get(`${f}|${c}`);
  const totalMapa = celdas.reduce((s, c) => s + c.mercado, 0);
  const totalPropias = celdas.reduce((s, c) => s + c.propias, 0);

  const accionDe = (x: CeldaMapa, col: ColumnaMapa): AccionCasillero | null => {
    if (col.sinAccion) return null;
    const peso = totalMapa ? x.mercado / totalMapa : 0;
    const pesoPropio = totalPropias ? x.propias / totalPropias : 0;
    const share = x.mercado ? x.propias / x.mercado : 0;
    if (peso >= PESO_RELEVANTE && share < SHARE_AUSENTE) return "entrar";
    if (pesoPropio >= PESO_PROPIO && share >= SHARE_FUERTE) return "defender";
    return null;
  };

  const totalColumna = new Map<string, { mercado: number; propias: number }>();
  for (const c of celdas) {
    const t = totalColumna.get(c.columna) ?? { mercado: 0, propias: 0 };
    t.mercado += c.mercado;
    t.propias += c.propias;
    totalColumna.set(c.columna, t);
  }

  return (
    <div>
      <Leyenda />
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Clase</TableHead>
              {columnas.map((c) => (
                <TableHead key={c.clave} className="text-right whitespace-nowrap">{c.etiqueta}</TableHead>
              ))}
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filas.map((fila) => {
              const total = columnas.reduce(
                (t, c) => {
                  const x = celda(fila, c.clave);
                  return { mercado: t.mercado + (x?.mercado ?? 0), propias: t.propias + (x?.propias ?? 0) };
                },
                { mercado: 0, propias: 0 }
              );
              return (
                <TableRow key={fila}>
                  <TableCell className="font-medium whitespace-nowrap">{fila}</TableCell>
                  {columnas.map((col) => {
                    const x = celda(fila, col.clave);
                    const share = x && x.mercado ? x.propias / x.mercado : 0;
                    const accion = x ? accionDe(x, col) : null;
                    return (
                      <TableCell
                        key={col.clave}
                        className={cn(
                          "p-0 text-right align-top",
                          accion === "entrar" && "ring-2 ring-amber-500 ring-inset",
                          accion === "defender" && "ring-2 ring-emerald-600 ring-inset"
                        )}
                        style={{ backgroundColor: tinte(share) }}
                      >
                        {x ? (
                          <button
                            type="button"
                            onClick={() => setAbierto(x)}
                            title={`Ver el detalle de ${fila} · ${col.etiqueta}`}
                            className="w-full cursor-pointer px-2 py-2 text-right transition-colors hover:bg-foreground/5 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
                          >
                            <span className="block tabular-nums font-semibold">{formatUnidades(x.mercado)}</span>
                            <span className="block text-[11px] tabular-nums text-muted-foreground">
                              {x.propias ? `${formatUnidades(x.propias)} nuestras · ${formatPct(share)}` : "—"}
                            </span>
                            {accion && (
                              <span
                                className={cn(
                                  "mt-0.5 block text-[10px] font-semibold uppercase tracking-wide",
                                  accion === "entrar"
                                    ? "text-amber-600 dark:text-amber-500"
                                    : "text-emerald-700 dark:text-emerald-400"
                                )}
                              >
                                {accion}
                              </span>
                            )}
                          </button>
                        ) : (
                          <span className="block px-2 py-2 text-muted-foreground">·</span>
                        )}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-right align-top">
                    <span className="block tabular-nums font-semibold">{formatUnidades(total.mercado)}</span>
                    <span className="block text-[11px] tabular-nums text-muted-foreground">
                      {total.propias ? `${formatUnidades(total.propias)} · ${formatPct(total.propias / total.mercado)}` : "—"}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
            <TableRow className="font-medium">
              <TableCell>Total</TableCell>
              {columnas.map((c) => {
                const t = totalColumna.get(c.clave);
                return (
                  <TableCell key={c.clave} className="text-right align-top">
                    <span className="block tabular-nums">{t ? formatUnidades(t.mercado) : "·"}</span>
                    <span className="block text-[11px] tabular-nums text-muted-foreground">
                      {t?.propias ? `${formatUnidades(t.propias)} · ${formatPct(t.propias / t.mercado)}` : "—"}
                    </span>
                  </TableCell>
                );
              })}
              <TableCell className="text-right" />
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <DetalleCasillero
        celda={abierto}
        columna={columnas.find((c) => c.clave === abierto?.columna)}
        accion={abierto ? accionDe(abierto, columnas.find((c) => c.clave === abierto.columna) ?? { clave: "", etiqueta: "" }) : null}
        peso={abierto && totalMapa ? abierto.mercado / totalMapa : 0}
        pesoPropio={abierto && totalPropias ? abierto.propias / totalPropias : 0}
        nombreColumna={nombreColumna}
        periodo={periodo}
        onClose={() => setAbierto(null)}
      />
    </div>
  );
}

function Leyenda() {
  const pasos = [0, 0.05, 0.1, 0.2, 0.3];
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] text-muted-foreground">
      <span className="flex items-center gap-2">
        Cuánto del casillero es nuestro:
        <span className="flex overflow-hidden rounded border">
          {pasos.map((s) => (
            <span key={s} className="h-4 w-7" style={{ backgroundColor: tinte(s) ?? "transparent" }} />
          ))}
        </span>
        0 % → 30 % o más
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-4 w-4 rounded-sm ring-2 ring-amber-500 ring-inset" />
        <strong className="font-medium text-foreground">Entrar</strong>: el mercado compra ahí y casi no estamos
      </span>
      <span className="flex items-center gap-1.5">
        <span
          className="inline-block h-4 w-4 rounded-sm ring-2 ring-emerald-600 ring-inset"
          style={{ backgroundColor: tinte(0.3) }}
        />
        <strong className="font-medium text-foreground">Defender</strong>: pesa y mandamos nosotros
      </span>
      <span className="text-muted-foreground/80">Tocá cualquier casillero para ver el detalle.</span>
    </div>
  );
}

/** El casillero abierto: qué pasa ahí, en una frase, y la comparativa entera. */
function DetalleCasillero({
  celda,
  columna,
  accion,
  peso,
  pesoPropio,
  nombreColumna,
  periodo,
  onClose,
}: {
  celda: CeldaMapa | null;
  columna: ColumnaMapa | undefined;
  accion: AccionCasillero | null;
  peso: number;
  pesoPropio: number;
  nombreColumna: string;
  periodo: string;
  onClose: () => void;
}) {
  const share = celda && celda.mercado ? celda.propias / celda.mercado : 0;
  const propios = celda?.modelos.filter((m) => m.esPropia) ?? [];
  const rivales = celda?.modelos.filter((m) => !m.esPropia) ?? [];
  const dif =
    celda?.precioNuestro && celda?.precioRival ? celda.precioNuestro / celda.precioRival - 1 : null;
  const brecha =
    celda?.precioNuestro && celda?.precioRival ? Math.abs(celda.precioNuestro - celda.precioRival) : null;

  return (
    <Dialog.Root open={!!celda} onOpenChange={(abierto) => !abierto && onClose()}>
      <Dialog.Portal>
        {/* Sin backdrop-filter: en un tablero de 1 MB el blur cuesta cada
            repintado y no aporta nada que un fondo oscuro no dé. */}
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-[min(56rem,92vw)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border bg-card shadow-xl">
          {celda && (
            <>
              {/* Encabezado fijo: el título, las cifras y qué significan. La
                  comparativa larga scrollea aparte, así el gerente no pierde
                  de vista de qué casillero está hablando. */}
              <div className="shrink-0 border-b p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Dialog.Title className="text-lg font-semibold">
                    {celda.fila} · {columna?.etiqueta}
                  </Dialog.Title>
                  <Dialog.Description className="text-xs text-muted-foreground">
                    {celda.fila} en {nombreColumna === "banda de precio" ? "la banda" : "la motorización"}{" "}
                    {columna?.etiqueta} · {periodo}
                  </Dialog.Description>
                </div>
                <Dialog.Close className="rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-muted">
                  Cerrar
                </Dialog.Close>
              </div>

              {/* Las tres cifras que definen el casillero. */}
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Cifra titulo="Vendió el mercado" valor={formatUnidades(celda.mercado)} pie={`${formatPct(peso)} del mapa`} />
                <Cifra titulo="Vendimos nosotros" valor={formatUnidades(celda.propias)} pie={`${formatPct(share)} del casillero`} />
                <Cifra
                  titulo="Precio de los rivales"
                  valor={celda.precioRival ? `US$ ${formatUnidades(Math.round(celda.precioRival))}` : "—"}
                  pie={
                    celda.nPreciosRivales === 0
                      ? "ninguno con precio cargado"
                      : celda.nPreciosRivales === 1
                        ? "el único rival con precio"
                        : `mediana de ${celda.nPreciosRivales} precios`
                  }
                />
                <Cifra
                  titulo="Nuestro precio"
                  valor={celda.precioNuestro ? `US$ ${formatUnidades(Math.round(celda.precioNuestro))}` : "—"}
                  pie={
                    dif === null
                      ? celda.nPreciosNuestros === 0
                        ? "no tenemos modelo con precio acá"
                        : "sin rivales con precio para comparar"
                      : `${dif > 0 ? "+" : ""}${(dif * 100).toFixed(0).replace("-", "−")} % contra los rivales`
                  }
                />
              </div>

              {/* Qué significa, en palabras de negocio. */}
              <p
                className={cn(
                  "mt-4 rounded-lg border-l-4 bg-muted/40 p-3 text-sm leading-relaxed",
                  accion === "entrar" ? "border-l-amber-500" : accion === "defender" ? "border-l-emerald-600" : "border-l-muted-foreground/40"
                )}
              >
                {accion === "entrar" ? (
                  <>
                    <strong>Acá hay que entrar.</strong> Es uno de los casilleros grandes del mercado
                    ({formatPct(peso)} de todo lo que se vendió en el mapa) y nosotros tenemos{" "}
                    {formatPct(share)}.{" "}
                    {celda.precioRival && celda.nPreciosRivales >= 2 ? (
                      <>
                        El comprador de este casillero paga alrededor de{" "}
                        <strong>US$ {formatUnidades(Math.round(celda.precioRival))}</strong>: entrar significa
                        traer un modelo a ese precio, o acercar el nuestro. Un modelo bueno al precio
                        equivocado no compite acá.
                      </>
                    ) : celda.precioRival ? (
                      <>
                        El único rival con precio cargado está en{" "}
                        <strong>US$ {formatUnidades(Math.round(celda.precioRival))}</strong>: alcanza como
                        referencia, no como el precio del casillero.
                      </>
                    ) : (
                      <>No hay precios de rivales cargados en este casillero, así que no se puede decir a qué precio se compra.</>
                    )}
                  </>
                ) : accion === "defender" ? (
                  <>
                    <strong>Acá mandamos y hay que defenderlo.</strong> De este casillero sale el{" "}
                    {formatPct(pesoPropio)} de todo lo que vendemos en el mapa, y tenemos{" "}
                    {formatPct(share)} de él. Lo que se cuida es el stock —quedarse sin unidades acá es
                    regalar participación— y el precio.{" "}
                    {dif !== null && celda.nPreciosRivales < 2 ? (
                      <>
                        Hay un solo rival con precio cargado en el casillero: no alcanza para decir si
                        estamos caros o baratos.
                      </>
                    ) : dif !== null && brecha !== null && dif <= -0.05 ? (
                      <>
                        Estamos <strong>US$ {formatUnidades(Math.round(brecha))} por debajo</strong> de la
                        mediana del casillero y aun así lideramos: hay espacio de precio, sobre todo si el
                        stock escasea.
                      </>
                    ) : dif !== null && brecha !== null && dif >= 0.05 ? (
                      <>
                        Estamos <strong>US$ {formatUnidades(Math.round(brecha))} por encima</strong> de la
                        mediana y lideramos igual: el precio no es la barrera, no hace falta resignarlo.
                      </>
                    ) : dif !== null ? (
                      <>Estamos al precio del casillero: lo que decide es el stock y el seguimiento.</>
                    ) : (
                      <>No hay precios suficientes para comparar dentro del casillero.</>
                    )}
                  </>
                ) : (
                  <>
                    <strong>Casillero para mirar, no para actuar todavía.</strong> Pesa {formatPct(peso)} del
                    mercado del mapa, de acá sale el {formatPct(pesoPropio)} de lo que vendemos y tenemos{" "}
                    {formatPct(share)} de él: ni es lo bastante grande como para justificar entrar, ni
                    concentra tanto de nuestro volumen como para llamarlo fortaleza. La comparativa está
                    abajo igual.
                  </>
                )}
              </p>

              </div>

              {/* La comparativa entera. */}
              <div className="min-h-0 flex-1 overflow-y-auto p-5 pt-4">
              <h4 className="text-sm font-semibold">
                Todos los modelos del casillero{" "}
                <span className="font-normal text-muted-foreground">
                  ({formatUnidades(celda.modelosTotal)}
                  {celda.modelosTotal > celda.modelos.length ? `, se listan los ${celda.modelos.length} que más venden` : ""})
                </span>
              </h4>
              <div className="mt-2 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Modelo</TableHead>
                      <TableHead className="text-right" nota="las del período">Unidades</TableHead>
                      <TableHead className="text-right whitespace-nowrap" nota="su parte de este casillero">% del casillero</TableHead>
                      <TableHead className="text-right" nota="el más barato de la gama">Precio</TableHead>
                      <TableHead>Motorización</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {celda.modelos.map((m) => (
                      <TableRow key={`${m.marca}|${m.modelo}`} className={cn(m.esPropia && "bg-primary/5")}>
                        <TableCell>
                          <span className={cn("font-medium", m.esPropia && "text-primary")}>{m.modelo}</span>
                          <span className="block text-xs text-muted-foreground">
                            {m.marca}
                            {m.esPropia ? " · nuestra" : ""}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatUnidades(m.unidades)}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {celda.mercado ? formatPct(m.unidades / celda.mercado) : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {m.precio ? `US$ ${formatUnidades(m.precio)}` : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{m.tecnologia ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                {propios.length === 0
                  ? "No tenemos ningún modelo con ventas en este casillero."
                  : `Nuestros modelos acá: ${propios.map((m) => m.modelo).join(", ")}.`}{" "}
                {rivales.length} {rivales.length === 1 ? "rival" : "rivales"} con ventas. Unidades:
                matriculaciones de CADAM del período. Precios: los nuestros del stock de Cars, los de la
                competencia del catálogo de Datacar — no es lista oficial, y lo que no tiene precio no se
                adivina.
              </p>
              </div>
            </>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Cifra({ titulo, valor, pie }: { titulo: string; valor: string; pie: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2">
      <span className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{titulo}</span>
      <span className="block text-lg font-semibold tabular-nums">{valor}</span>
      <span className="block text-[11px] text-muted-foreground">{pie}</span>
    </div>
  );
}
