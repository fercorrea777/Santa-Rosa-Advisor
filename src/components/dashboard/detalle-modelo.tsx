"use client";

import { Dialog } from "@base-ui/react/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import type { DetalleModelo } from "@/lib/cadam/bandas";
import { formatPct, formatUnidades } from "@/lib/format";
import { transmisionDe } from "@/lib/informes/transmision";
import { cn } from "@/lib/utils";

/**
 * La ficha de un modelo, al tocar su burbuja.
 *
 * POR QUÉ. Un bubble chart contesta "quién está dónde" y ahí se termina: la
 * burbuja no dice contra quién compite ese modelo ni si su precio tiene
 * sentido, y el tooltip no alcanza —se va apenas movés el mouse y no existe
 * en una tablet—. Con el detalle abierto, la misma pantalla contesta la
 * pregunta que sigue a mirar el gráfico.
 *
 * Es el mismo contenido que el detalle de un casillero en «Dónde competir»,
 * centrado en un modelo en vez de en un casillero: la clase manda, y los
 * rivales son los de su clase (ver lib/cadam/clases.ts).
 */
export function DetalleModeloDialog({
  detalle,
  version,
  periodo,
  fuente = "matriculacion",
  onClose,
}: {
  detalle: DetalleModelo | null;
  /** Cuando la burbuja es una VERSIÓN nuestra y no el modelo entero: su
   *  nombre, su familia según Cars y su precio, que es el que se compara. */
  version?: { nombre: string; precio: number; unidades: number; familia?: string } | null;
  periodo: string;
  /** De qué base salen las unidades. Importación y matriculación NO miden lo
   *  mismo y la ficha no puede decir "matriculó" sobre un dato de aduana. */
  fuente?: "matriculacion" | "importacion";
  onClose: () => void;
}) {
  const importacion = fuente === "importacion";
  const d = detalle;
  // QUÉ PRECIO SE COMPARA CON QUÉ. Mecánico con mecánico y automático con
  // automático (Fernando, 07/09/2026): el "desde" de un modelo suele ser su
  // versión mecánica y el del rival la automática, y esa cuenta no es justa.
  // Para una versión, su transmisión sale de su nombre; para un modelo se
  // toma el automático (es lo que más se vende) y, si no lo hay, el
  // mecánico. Solo cuando ninguna versión dice su transmisión se cae al
  // "desde" contra "desde", y se avisa.
  const base = comparacion(d, version);
  const dif = base.nuestro && base.mediana ? base.nuestro / base.mediana - 1 : null;
  const brecha = base.nuestro && base.mediana ? Math.abs(base.nuestro - base.mediana) : null;

  return (
    <Dialog.Root open={!!d} onOpenChange={(abierto) => !abierto && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-[min(52rem,92vw)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border bg-card shadow-xl">
          {d && (
            <>
              <div className="shrink-0 border-b p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Dialog.Title className="text-lg font-semibold">
                      {version ? version.nombre : d.modelo}
                    </Dialog.Title>
                    <Dialog.Description className="text-xs text-muted-foreground">
                      {d.marca} · {d.clase}
                      {d.claseInferida ? " (clase por precio)" : ""}
                      {version?.familia ? ` · familia ${version.familia}` : ""}
                      {d.tecnologia ? ` · ${d.tecnologia}` : ""} · {periodo}
                    </Dialog.Description>
                  </div>
                  <Dialog.Close className="rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-muted">
                    Cerrar
                  </Dialog.Close>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Cifra
                    titulo={version ? "Facturó esta versión" : importacion ? "Importó" : "Matriculó"}
                    valor={formatUnidades(version ? version.unidades : d.unidades)}
                    pie={version ? "unidades del período (Cars)" : `${formatPct(d.parteClase)} de su clase`}
                  />
                  {/* Para una versión NO se muestran las unidades del modelo:
                      la familia de Cars se cruza con la de CADAM por palabras
                      y un "TANK 700" cae en el "TANK 400" del registro. La
                      clase sí es correcta, y es lo que define al rival. */}
                  <Cifra
                    titulo="Su clase en el mercado"
                    valor={formatUnidades(d.unidadesClase)}
                    pie={`${d.clase} en el período`}
                  />
                  <Cifra
                    titulo={`Precio ${base.etiqueta}`}
                    valor={base.nuestro ? `US$ ${formatUnidades(base.nuestro)}` : "—"}
                    pie={
                      version
                        ? `de esta versión (${base.etiqueta})`
                        : [
                            d.precioMT ? `MT desde ${formatUnidades(d.precioMT)}` : null,
                            d.precioAT ? `AT desde ${formatUnidades(d.precioAT)}` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ") || (d.precio ? "desde, sin transmisión en el nombre" : "sin precio")
                    }
                  />
                  <Cifra
                    titulo={`Su clase, ${base.etiqueta}`}
                    valor={base.mediana ? `US$ ${formatUnidades(Math.round(base.mediana))}` : "—"}
                    pie={
                      base.n === 0
                        ? `sin rivales con precio ${base.etiqueta}`
                        : base.n === 1
                          ? `el único rival con precio ${base.etiqueta}`
                          : `mediana de ${base.n} rivales, ${base.etiqueta}`
                    }
                  />
                </div>

                <p className="mt-4 rounded-lg border-l-4 border-l-primary/60 bg-muted/40 p-3 text-sm leading-relaxed">
                  <Lectura d={d} dif={dif} brecha={brecha} tieneVersion={!!version} base={base} />
                </p>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-5 pt-4">
                <h4 className="text-sm font-semibold">
                  Contra quién compite{" "}
                  <span className="font-normal text-muted-foreground">
                    ({formatUnidades(d.competidoresTotal)} en {d.clase}
                    {d.competidoresTotal > d.competidores.length
                      ? `, se listan los ${d.competidores.length} que más venden`
                      : ""}
                    )
                  </span>
                </h4>
                {d.competidores.length === 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Ningún otro modelo con ventas en esta clase durante el período.
                  </p>
                ) : (
                  <div className="mt-2 overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Modelo</TableHead>
                          <TableHead className="text-right" nota="las del período">Unidades</TableHead>
                          <TableHead className="text-right whitespace-nowrap" nota="su parte de la clase">% de la clase</TableHead>
                          <TableHead className="text-right" nota="la versión más barata">Desde</TableHead>
                          <TableHead className="text-right" nota="la más barata, mecánica">MT</TableHead>
                          <TableHead className="text-right" nota="la más barata, automática">AT</TableHead>
                          <TableHead>Motorización</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {d.competidores.map((c) => (
                          <TableRow key={`${c.marca}|${c.modelo}`} className={cn(c.esPropia && "bg-primary/5")}>
                            <TableCell>
                              <span className={cn("font-medium", c.esPropia && "text-primary")}>{c.modelo}</span>
                              <span className="block text-xs text-muted-foreground">
                                {c.marca}
                                {c.esPropia ? " · nuestra" : ""}
                              </span>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{formatUnidades(c.unidades)}</TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">
                              {d.unidadesClase ? formatPct(c.unidades / d.unidadesClase) : "—"}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {c.precio ? `US$ ${formatUnidades(c.precio)}` : "—"}
                            </TableCell>
                            <TableCell className={cn("text-right tabular-nums", base.etiqueta === "mecánico" && "font-medium")}>
                              {c.precioMT ? formatUnidades(c.precioMT) : "—"}
                            </TableCell>
                            <TableCell className={cn("text-right tabular-nums", base.etiqueta === "automático" && "font-medium")}>
                              {c.precioAT ? formatUnidades(c.precioAT) : "—"}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{c.tecnologia ?? "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                  La clase (SUV chico, compacto, mediano, grande; pick-up compacta, mediana…) es un
                  catálogo propio sobre los nombres del mercado: CADAM solo distingue SUV, pick-up,
                  automóvil, camión, furgón y minibús, y eso pone a una X50 al lado de una Fortuner.
                  Unidades: {importacion ? "importaciones" : "matriculaciones"} de CADAM del
                  período{importacion ? " — lo importado se matricula dos o tres meses después" : ""}.
                  Precios: los nuestros del stock de
                  Cars, los de la competencia del catálogo de Datacar — no es lista oficial, y lo que
                  no tiene precio no se adivina. <strong>MT</strong> y <strong>AT</strong> son el
                  «desde» mecánico y automático de cada familia, leídos del nombre de la versión (MT,
                  AT, CVT, DCT; un híbrido o eléctrico es automático): así se compara mecánico con
                  mecánico. Lo que no dice su transmisión queda en «—» y no entra en esa cuenta.
                </p>
              </div>
            </>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Qué decir del modelo, en una frase: cómo le va y si el precio ayuda. */
function Lectura({
  d,
  dif,
  brecha,
  tieneVersion,
  base,
}: {
  d: DetalleModelo;
  dif: number | null;
  brecha: number | null;
  tieneVersion: boolean;
  base: Comparacion;
}) {
  const lider = d.competidores[0];
  const esLider = !lider || d.unidades >= lider.unidades;
  return (
    <>
      {/* De una VERSIÓN no se afirma cuánto vende ni cuánto creció: esas son
          cifras del modelo en CADAM, y la versión es de Cars. Lo que sí vale
          para las dos es contra quién compite y a qué precio. */}
      <strong>
        {tieneVersion
          ? `Compite en ${d.clase.toLowerCase()}.`
          : esLider
            ? `Lidera ${d.clase.toLowerCase()}.`
            : `${formatPct(d.parteClase)} de ${d.clase.toLowerCase()}.`}
      </strong>{" "}
      {tieneVersion && lider ? (
        <>
          El que más vende en esa clase es <strong>{lider.marca} {lider.modelo}</strong> con{" "}
          {formatUnidades(lider.unidades)} unidades
          {lider.precio ? ` a US$ ${formatUnidades(lider.precio)}` : ""}.{" "}
        </>
      ) : lider && !esLider ? (
        <>
          El que más vende en su clase es <strong>{lider.marca} {lider.modelo}</strong> con{" "}
          {formatUnidades(lider.unidades)} unidades
          {lider.precio ? ` a US$ ${formatUnidades(lider.precio)}` : ""}.{" "}
        </>
      ) : lider ? (
        <>
          Lo sigue <strong>{lider.marca} {lider.modelo}</strong> con {formatUnidades(lider.unidades)}{" "}
          unidades
          {lider.precio ? ` a US$ ${formatUnidades(lider.precio)}` : ""}.{" "}
        </>
      ) : null}
      {!tieneVersion && d.variacion !== null && (
        <>
          Contra el mismo período del año pasado{" "}
          {d.variacion >= 0 ? "creció" : "cayó"} {formatPct(Math.abs(d.variacion))} (de{" "}
          {formatUnidades(d.unidadesAnterior)} a {formatUnidades(d.unidades)}).{" "}
        </>
      )}
      {dif === null || base.n < 2 ? (
        <>
          No hay precios suficientes {base.justa ? `en ${base.etiqueta} ` : ""}en la clase para decir
          si está caro o barato.
        </>
      ) : dif >= 0.05 ? (
        <>
          {tieneVersion ? "Esta versión está" : `En ${base.etiqueta}, está`}{" "}
          <strong>US$ {formatUnidades(Math.round(brecha ?? 0))} por encima</strong> de la mediana de su
          clase ({base.n} rivales{base.justa ? ` con ${base.etiqueta}` : ", desde contra desde"}): el
          precio juega en contra y hay que compensarlo con producto o financiación.
        </>
      ) : dif <= -0.05 ? (
        <>
          {tieneVersion ? "Esta versión está" : `En ${base.etiqueta}, está`}{" "}
          <strong>US$ {formatUnidades(Math.round(brecha ?? 0))} por debajo</strong> de la mediana de su
          clase ({base.n} rivales{base.justa ? ` con ${base.etiqueta}` : ", desde contra desde"}): el
          precio es un argumento a favor{esLider ? " y hay espacio si el stock escasea" : ", así que lo que falta es presencia o producto"}.
        </>
      ) : (
        <>
          {base.justa ? `En ${base.etiqueta}, está` : "Está"} al precio de su clase: lo que decide es
          el stock, la pauta y el seguimiento.
        </>
      )}
      {!base.justa && base.n >= 2 && (
        <>
          {" "}
          Ninguna versión con precio dice si es mecánica o automática, así que acá se comparó el
          «desde» de cada uno.
        </>
      )}
    </>
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

/** Contra qué se compara el precio: mecánico con mecánico, automático con
 *  automático; el "desde" solo si ninguna versión dice su transmisión. */
interface Comparacion {
  etiqueta: "mecánico" | "automático" | "desde";
  nuestro: number | null;
  mediana: number | null;
  n: number;
  /** true cuando la comparación es por transmisión (la justa). */
  justa: boolean;
}

function comparacion(
  d: DetalleModelo | null,
  version?: { nombre: string; precio: number } | null
): Comparacion {
  if (!d) return { etiqueta: "desde", nuestro: null, mediana: null, n: 0, justa: false };
  const mt: Comparacion = { etiqueta: "mecánico", nuestro: d.precioMT, mediana: d.medianaClaseMT, n: d.nPreciosMT, justa: true };
  const at: Comparacion = { etiqueta: "automático", nuestro: d.precioAT, mediana: d.medianaClaseAT, n: d.nPreciosAT, justa: true };
  const desde: Comparacion = { etiqueta: "desde", nuestro: d.precio, mediana: d.medianaClase, n: d.nPreciosClase, justa: false };
  if (version) {
    const t = transmisionDe(version.nombre, d.marca);
    if (t === "MT") return { ...mt, nuestro: version.precio };
    if (t === "AT") return { ...at, nuestro: version.precio };
    return { ...desde, nuestro: version.precio };
  }
  if (d.precioAT && d.nPreciosAT >= 1) return at;
  if (d.precioMT && d.nPreciosMT >= 1) return mt;
  return desde;
}
