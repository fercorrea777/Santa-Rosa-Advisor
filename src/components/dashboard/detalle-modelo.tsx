"use client";

import { Dialog } from "@base-ui/react/dialog";
import { LogoMarca } from "@/components/dashboard/logo-marca";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import type { DetalleModelo } from "@/lib/cadam/bandas";
import type { I18n } from "@/lib/i18n/crear";
import { useI18n } from "@/lib/i18n/cliente";
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
  const i18n = useI18n();
  const { t, tr, fmt } = i18n;
  const { formatPct, formatUnidades } = fmt;
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
  /** Elige la frase según con qué caja se compara. Cada una se traduce entera:
   *  «Precio mecánico» y «manual price» no tienen el mismo orden de palabras. */
  const porCaja = (mecanico: string, automatico: string, desde: string) =>
    base.etiqueta === "mecánico" ? mecanico : base.etiqueta === "automático" ? automatico : desde;

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
                    <Dialog.Description className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <LogoMarca marca={d.marca} />
                      {d.marca} · {t(d.clase)}
                      {d.claseInferida ? ` ${t("(clase por precio)")}` : ""}
                      {version?.familia ? ` · ${t("familia {familia}", { familia: version.familia })}` : ""}
                      {d.tecnologia ? ` · ${d.tecnologia}` : ""} · {periodo}
                    </Dialog.Description>
                  </div>
                  <Dialog.Close className="rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-muted">
                    {t("Cerrar")}
                  </Dialog.Close>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Cifra
                    titulo={version ? t("Facturó esta versión") : importacion ? t("Importó") : t("Matriculó")}
                    valor={formatUnidades(version ? version.unidades : d.unidades)}
                    pie={version ? t("unidades del período (Cars)") : t("{pct} de su clase", { pct: formatPct(d.parteClase) })}
                  />
                  {/* Para una versión NO se muestran las unidades del modelo:
                      la familia de Cars se cruza con la de CADAM por palabras
                      y un "TANK 700" cae en el "TANK 400" del registro. La
                      clase sí es correcta, y es lo que define al rival. */}
                  <Cifra
                    titulo={t("Su clase en el mercado")}
                    valor={formatUnidades(d.unidadesClase)}
                    pie={t("{clase} en el período", { clase: t(d.clase) })}
                  />
                  <Cifra
                    titulo={porCaja(t("Precio mecánico"), t("Precio automático"), t("Precio desde"))}
                    valor={base.nuestro ? `US$ ${formatUnidades(base.nuestro)}` : "—"}
                    pie={
                      version
                        ? porCaja(t("de esta versión (mecánico)"), t("de esta versión (automático)"), t("de esta versión (desde)"))
                        : [
                            d.precioMT ? t("MT desde {precio}", { precio: formatUnidades(d.precioMT) }) : null,
                            d.precioAT ? t("AT desde {precio}", { precio: formatUnidades(d.precioAT) }) : null,
                          ]
                            .filter(Boolean)
                            .join(" · ") || (d.precio ? t("desde, sin transmisión en el nombre") : t("sin precio"))
                    }
                  />
                  <Cifra
                    titulo={porCaja(t("Su clase, mecánico"), t("Su clase, automático"), t("Su clase, desde"))}
                    valor={base.mediana ? `US$ ${formatUnidades(Math.round(base.mediana))}` : "—"}
                    pie={
                      base.n === 0
                        ? porCaja(t("sin rivales con precio mecánico"), t("sin rivales con precio automático"), t("sin rivales con precio desde"))
                        : base.n === 1
                          ? porCaja(t("el único rival con precio mecánico"), t("el único rival con precio automático"), t("el único rival con precio desde"))
                          : porCaja(
                              t("mediana de {n} rivales, mecánico", { n: base.n }),
                              t("mediana de {n} rivales, automático", { n: base.n }),
                              t("mediana de {n} rivales, desde", { n: base.n })
                            )
                    }
                  />
                </div>

                <p className="mt-4 rounded-lg border-l-4 border-l-primary/60 bg-muted/40 p-3 text-sm leading-relaxed">
                  <Lectura d={d} dif={dif} brecha={brecha} tieneVersion={!!version} base={base} i18n={i18n} />
                </p>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-5 pt-4">
                <h4 className="text-sm font-semibold">
                  {t("Contra quién compite")}{" "}
                  <span className="font-normal text-muted-foreground">
                    ({t("{n} en {clase}", { n: formatUnidades(d.competidoresTotal), clase: t(d.clase) })}
                    {d.competidoresTotal > d.competidores.length
                      ? `, ${t("se listan los {n} que más venden", { n: d.competidores.length })}`
                      : ""}
                    )
                  </span>
                </h4>
                {d.competidores.length === 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    {t("Ningún otro modelo con ventas en esta clase durante el período.")}
                  </p>
                ) : (
                  <div className="mt-2 overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("Modelo")}</TableHead>
                          <TableHead className="text-right" nota={t("las del período")}>{t("Unidades")}</TableHead>
                          <TableHead className="text-right whitespace-nowrap" nota={t("su parte de la clase")}>{t("% de la clase")}</TableHead>
                          <TableHead className="text-right" nota={t("la versión más barata")}>{t("Desde")}</TableHead>
                          <TableHead className="text-right" nota={t("la más barata, mecánica")}>MT</TableHead>
                          <TableHead className="text-right" nota={t("la más barata, automática")}>AT</TableHead>
                          <TableHead>{t("Motorización")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {d.competidores.map((c) => (
                          <TableRow key={`${c.marca}|${c.modelo}`} className={cn(c.esPropia && "bg-primary/5")}>
                            <TableCell>
                              <span className={cn("font-medium", c.esPropia && "text-primary")}>{c.modelo}</span>
                              <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                                <LogoMarca marca={c.marca} />
                                {c.marca}
                                {c.esPropia ? ` · ${t("nuestra")}` : ""}
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
                  {t("La clase (SUV chico, compacto, mediano, grande; pick-up compacta, mediana…) es un catálogo propio sobre los nombres del mercado: CADAM solo distingue SUV, pick-up, automóvil, camión, furgón y minibús, y eso pone a una X50 al lado de una Fortuner.")}{" "}
                  {importacion
                    ? t("Unidades: importaciones de CADAM del período — lo importado se matricula dos o tres meses después.")
                    : t("Unidades: matriculaciones de CADAM del período.")}{" "}
                  {tr("Precios: los nuestros del stock de Cars, los de la competencia del catálogo de Datacar — no es lista oficial, y lo que no tiene precio no se adivina. <b>MT</b> y <b>AT</b> son el «desde» mecánico y automático de cada familia, leídos del nombre de la versión (MT, AT, CVT, DCT; un híbrido o eléctrico es automático): así se compara mecánico con mecánico. Lo que no dice su transmisión queda en «—» y no entra en esa cuenta.")}
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
  i18n,
}: {
  d: DetalleModelo;
  dif: number | null;
  brecha: number | null;
  tieneVersion: boolean;
  base: Comparacion;
  i18n: I18n;
}) {
  const { t, tr, fmt, idioma } = i18n;
  const { formatPct, formatUnidades } = fmt;
  const lider = d.competidores[0];
  const esLider = !lider || d.unidades >= lider.unidades;
  // La clase en medio de la frase. En castellano, en minúsculas enteras, como
  // siempre («Lidera suv grande.»); en inglés, con la primera letra en
  // minúscula y las siglas intactas («small SUV»).
  const clase = idioma === "es" ? d.clase.toLowerCase() : minusculaInicial(t(d.clase));
  const precioLider = lider?.precio ? ` ${t("a US$ {precio}", { precio: formatUnidades(lider.precio) })}` : "";
  const datosLider: Record<string, string> = lider
    ? { marca: lider.marca, modelo: lider.modelo, n: formatUnidades(lider.unidades), precio: precioLider }
    : {};
  const enEstaCaja = base.etiqueta === "mecánico" ? t("En mecánico, está") : base.etiqueta === "automático" ? t("En automático, está") : t("En desde, está");
  const sujeto = tieneVersion ? t("Esta versión está") : enEstaCaja;
  const contraRivales = base.justa
    ? ` ${base.etiqueta === "mecánico" ? t("con mecánico") : t("con automático")}`
    : t(", desde contra desde");
  const vars = { brecha: formatUnidades(Math.round(brecha ?? 0)), n: base.n, sujeto, rivales: contraRivales };
  return (
    <>
      {/* De una VERSIÓN no se afirma cuánto vende ni cuánto creció: esas son
          cifras del modelo en CADAM, y la versión es de Cars. Lo que sí vale
          para las dos es contra quién compite y a qué precio. */}
      <strong>
        {tieneVersion
          ? t("Compite en {clase}.", { clase })
          : esLider
            ? t("Lidera {clase}.", { clase })
            : t("{pct} de {clase}.", { pct: formatPct(d.parteClase), clase })}
      </strong>{" "}
      {tieneVersion && lider ? (
        <>
          {tr("El que más vende en esa clase es <b>{marca} {modelo}</b> con {n} unidades{precio}.", datosLider)}{" "}
        </>
      ) : lider && !esLider ? (
        <>
          {tr("El que más vende en su clase es <b>{marca} {modelo}</b> con {n} unidades{precio}.", datosLider)}{" "}
        </>
      ) : lider ? (
        <>
          {tr("Lo sigue <b>{marca} {modelo}</b> con {n} unidades{precio}.", datosLider)}{" "}
        </>
      ) : null}
      {!tieneVersion && d.variacion !== null && (
        <>
          {d.variacion >= 0
            ? t("Contra el mismo período del año pasado creció {pct} (de {antes} a {ahora}).", {
                pct: formatPct(Math.abs(d.variacion)), antes: formatUnidades(d.unidadesAnterior), ahora: formatUnidades(d.unidades),
              })
            : t("Contra el mismo período del año pasado cayó {pct} (de {antes} a {ahora}).", {
                pct: formatPct(Math.abs(d.variacion)), antes: formatUnidades(d.unidadesAnterior), ahora: formatUnidades(d.unidades),
              })}{" "}
        </>
      )}
      {dif === null || base.n < 2 ? (
        <>
          {base.justa
            ? base.etiqueta === "mecánico"
              ? t("No hay precios suficientes en mecánico en la clase para decir si está caro o barato.")
              : t("No hay precios suficientes en automático en la clase para decir si está caro o barato.")
            : t("No hay precios suficientes en la clase para decir si está caro o barato.")}
        </>
      ) : dif >= 0.05 ? (
        <>
          {tr("{sujeto} <b>US$ {brecha} por encima</b> de la mediana de su clase ({n} rivales{rivales}): el precio juega en contra y hay que compensarlo con producto o financiación.", vars)}
        </>
      ) : dif <= -0.05 ? (
        <>
          {tr("{sujeto} <b>US$ {brecha} por debajo</b> de la mediana de su clase ({n} rivales{rivales}): el precio es un argumento a favor{cierre}.", {
            ...vars,
            cierre: esLider ? ` ${t("y hay espacio si el stock escasea")}` : t(", así que lo que falta es presencia o producto"),
          })}
        </>
      ) : (
        <>
          {t("{sujeto} al precio de su clase: lo que decide es el stock, la pauta y el seguimiento.", {
            sujeto: base.justa ? enEstaCaja : t("Está"),
          })}
        </>
      )}
      {!base.justa && base.n >= 2 && (
        <>
          {" "}
          {t("Ninguna versión con precio dice si es mecánica o automática, así que acá se comparó el «desde» de cada uno.")}
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

/** «Small SUV» → «small SUV»: baja la primera letra solo si la segunda ya está
 *  en minúscula, así una sigla como «SUV» o «MPV» queda como está. */
function minusculaInicial(texto: string): string {
  return /^[A-Z][a-z]/.test(texto) ? texto[0].toLowerCase() + texto.slice(1) : texto;
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
  // i18n-ignore-start (`etiqueta` es la clave de la comparación, no un texto: la pantalla dice cada caso con su propia frase, ver porCaja)
  const mt: Comparacion = { etiqueta: "mecánico", nuestro: d.precioMT, mediana: d.medianaClaseMT, n: d.nPreciosMT, justa: true };
  const at: Comparacion = { etiqueta: "automático", nuestro: d.precioAT, mediana: d.medianaClaseAT, n: d.nPreciosAT, justa: true };
  // i18n-ignore-end
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
