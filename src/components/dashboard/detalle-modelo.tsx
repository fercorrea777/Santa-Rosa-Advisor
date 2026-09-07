"use client";

import { Dialog } from "@base-ui/react/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import type { DetalleModelo } from "@/lib/cadam/bandas";
import { formatPct, formatUnidades } from "@/lib/format";
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
  // El precio que se compara: el de la versión tocada si la hay, si no el
  // del modelo. Una familia con versiones de 20k y 35k no tiene "un" precio.
  const precio = version?.precio ?? d?.precio ?? null;
  const dif = precio && d?.medianaClase ? precio / d.medianaClase - 1 : null;
  const brecha = precio && d?.medianaClase ? Math.abs(precio - d.medianaClase) : null;

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
                    titulo="Precio de lista"
                    valor={precio ? `US$ ${formatUnidades(precio)}` : "—"}
                    pie={version ? "de esta versión" : "del modelo"}
                  />
                  <Cifra
                    titulo="Precio de su clase"
                    valor={d.medianaClase ? `US$ ${formatUnidades(Math.round(d.medianaClase))}` : "—"}
                    pie={
                      d.nPreciosClase === 0
                        ? "sin rivales con precio"
                        : d.nPreciosClase === 1
                          ? "el único rival con precio"
                          : `mediana de ${d.nPreciosClase} rivales`
                    }
                  />
                </div>

                <p className="mt-4 rounded-lg border-l-4 border-l-primary/60 bg-muted/40 p-3 text-sm leading-relaxed">
                  <Lectura d={d} dif={dif} brecha={brecha} tieneVersion={!!version} />
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
                          <TableHead className="text-right">Unidades</TableHead>
                          <TableHead className="text-right whitespace-nowrap">% de la clase</TableHead>
                          <TableHead className="text-right">Precio</TableHead>
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
                  no tiene precio no se adivina.
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
}: {
  d: DetalleModelo;
  dif: number | null;
  brecha: number | null;
  tieneVersion: boolean;
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
      {dif === null || d.nPreciosClase < 2 ? (
        <>No hay precios suficientes en la clase para decir si está caro o barato.</>
      ) : dif >= 0.05 ? (
        <>
          {tieneVersion ? "Esta versión está" : "Está"}{" "}
          <strong>US$ {formatUnidades(Math.round(brecha ?? 0))} por encima</strong> de la mediana de su
          clase: el precio juega en contra y hay que compensarlo con producto o financiación.
        </>
      ) : dif <= -0.05 ? (
        <>
          {tieneVersion ? "Esta versión está" : "Está"}{" "}
          <strong>US$ {formatUnidades(Math.round(brecha ?? 0))} por debajo</strong> de la mediana de su
          clase: el precio es un argumento a favor{esLider ? " y hay espacio si el stock escasea" : ", así que lo que falta es presencia o producto"}.
        </>
      ) : (
        <>Está al precio de su clase: lo que decide es el stock, la pauta y el seguimiento.</>
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
