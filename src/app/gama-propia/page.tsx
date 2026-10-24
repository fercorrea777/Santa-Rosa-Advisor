import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Marca } from "@/components/dashboard/logo-marca";
import { NotaDato, PageHeader } from "@/components/dashboard/page-header";
import { Pagina } from "@/components/movimiento/pagina";
import { FiltroPeriodo } from "@/components/dashboard/filtro-periodo";
import { SelectorFuente, type FuenteVista } from "@/components/dashboard/selector-fuente";
import { BurbujasPrecioChart } from "@/components/charts/burbujas-precio-chart";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { getCobertura, getRankingModelos, type Fuente } from "@/lib/cadam/mercado";
import {
  getGamaPropiaConPrecio, getGamaPropiaSinPrecio, getPeriodosPrecio, hayPrecios,
} from "@/lib/cadam/precios";
import { getGamaPropiaDesdeCars } from "@/lib/cadam/precios-cars";
import {
  asignarPrecios, claveModelo, fichasDeModelos, type PrecioCandidato,
} from "@/lib/cadam/bandas";
import Link from "next/link";
import { getStockPropio, getVentasPropias } from "@/lib/informes/propios";
import { getPreciosCompetencia } from "@/lib/informes/precios-competencia";
import { getAcciones, type AccionVersion } from "@/lib/informes/acciones";
import { claveCars, claveFamilia, familiaMasParecida } from "@/lib/informes/acciones-cruce";
import { tokens } from "@/lib/informes/segmento-version";
import { filtroDesdeUrl, type SearchParams } from "@/lib/periodo";
import { getI18n } from "@/lib/i18n/servidor";
import { N_ } from "@/lib/i18n/traducir";

// Se traduce donde se muestra: t(NOMBRE[fuente]).
const NOMBRE: Record<Fuente, string> = { matriculacion: N_("matriculaciones"), importacion: N_("importaciones") };

export default async function GamaPropiaPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const { t, tr, fmt, idioma } = await getI18n();
  const { formatFechaHora, formatPct, formatUnidades, etiquetaPeriodo, etiquetaCortes, aclaracionCortes } = fmt;
  // «2026-09» → «Septiembre 2026» | «September 2026» (acciones.ts:nombreMes es solo castellano).
  const nombreMes = (mes: string) => {
    const [a, m] = mes.split("-").map(Number);
    return m >= 1 && m <= 12 ? etiquetaPeriodo(a, m, m) : mes;
  };
  const cobertura = getCobertura();
  // Tres vistas (Croman, 15/09/2026: "el mismo selector en Gama propia"):
  // la fuente principal define las unidades de cada burbuja; con "Ambas",
  // la otra va como columna en la tabla de abajo, cada una hasta su propio
  // último mes. El precio es el mismo (Cars) en las tres.
  const vista: FuenteVista =
    sp.fuente === "importacion" ? "importacion" : sp.fuente === "matriculacion" ? "matriculacion" : "ambas";
  const principal: Fuente = vista === "importacion" ? "importacion" : "matriculacion";
  const secundaria: Fuente | null =
    vista === "ambas" ? "importacion" : vista === "importacion" ? "matriculacion" : null;
  const f0 = filtroDesdeUrl(sp, cobertura[principal].ultimo);
  const ventanaDe = (fuente: Fuente) => {
    const ult = cobertura[fuente].ultimo;
    if (!ult || f0.anio !== ult.anio) return f0;
    if (sp.hasta) return f0.mesHasta > ult.mes ? { ...f0, mesHasta: Math.max(f0.mesDesde, ult.mes) } : f0;
    return { ...f0, mesHasta: Math.max(f0.mesDesde, ult.mes) };
  };
  const f = ventanaDe(principal);
  const fSec = secundaria ? ventanaDe(secundaria) : null;
  const periodo = etiquetaPeriodo(f.anio, f.mesDesde, f.mesHasta);
  const periodoSec = fSec ? etiquetaPeriodo(fSec.anio, fSec.mesDesde, fSec.mesHasta) : "";

  const aclaracion = aclaracionCortes(cobertura);

  const mesMax: Record<number, number> = {};
  for (const a of cobertura[principal].anios) {
    mesMax[a] = a === cobertura[principal].ultimo?.anio
      ? cobertura[principal].ultimo.mes : 12;
  }

  // DOS FUENTES DE PRECIO, con prioridad explicita:
  //
  //  1. La lista cargada a mano (`precio_modelo`), si existe. Alguien la subio
  //     a proposito para un periodo: eso gana.
  //  2. El stock de Cars, que se sincroniza solo cada 4 horas.
  //
  // Antes solo existia la primera, y como nadie la subio nunca la pantalla
  // llevaba meses mostrando un instructivo en vez de datos — pidiendo a mano
  // un dato que el sistema ya tenia. Ver lib/cadam/precios-cars.ts.
  const listaManual = hayPrecios();
  const periodosLista = getPeriodosPrecio();
  const cars = listaManual ? null : await getGamaPropiaDesdeCars(f, principal);

  const conPrecio = listaManual ? getGamaPropiaConPrecio(f, principal) : (cars?.conPrecio ?? []);
  const sinPrecio = listaManual ? getGamaPropiaSinPrecio(f, principal) : (cars?.sinPrecio ?? []);
  const tienePrecios = conPrecio.length > 0;
  const fuentePrecio = listaManual ? t("lista propia cargada") : t("stock de Cars");

  // La otra fuente, por marca y modelo, cruzada por las mismas palabras
  // (las dos bases escriben distinto: "NUEVO KWID ZEN 1.0" contra "KWID").
  const otras = new Map<string, number>();
  if (secundaria && fSec) {
    let g: { marca: string; modelo: string; unidades: number }[];
    if (listaManual) {
      g = [...getGamaPropiaConPrecio(fSec, secundaria), ...getGamaPropiaSinPrecio(fSec, secundaria)];
    } else {
      const r = await getGamaPropiaDesdeCars(fSec, secundaria);
      g = [...r.conPrecio, ...r.sinPrecio];
    }
    for (const m of g) {
      const k = `${m.marca}|${tokens(m.modelo).join(" ")}`;
      otras.set(k, (otras.get(k) ?? 0) + m.unidades);
    }
  }
  const otrasDe = (marca: string, modelo: string) => otras.get(`${marca}|${tokens(modelo).join(" ")}`) ?? null;

  const uConPrecio = conPrecio.reduce((s, d) => s + d.unidades, 0);
  const uSinPrecio = sinPrecio.reduce((s, d) => s + d.unidades, 0);
  const uTotal = uConPrecio + uSinPrecio;

  // --- lo nuestro, al lado de cada modelo (Fernando, 15/09/2026: "gama
  // propia vinculada con las acciones comerciales y con importaciones,
  // matriculaciones y ventas") ----------------------------------------------
  // Facturación propia (Cars) en la misma ventana que las unidades de
  // CADAM, y la acción comercial del mes por familia. Las dos se cruzan
  // por FAMILIA (ver acciones-cruce.ts): las fuentes escriben la versión
  // distinto y la familia es lo que se lee igual en todas.
  const periodoCars = `${f.anio}-${String(f.mesDesde).padStart(2, "0")}`;
  const periodoCarsHasta = `${f.anio}-${String(f.mesHasta).padStart(2, "0")}`;
  let ventasCars: { marca: string; modelo: string; version: string; unidades: number }[] = [];
  let hayCars = false;
  try {
    ventasCars = (await getVentasPropias()).filter((v) => v.periodo >= periodoCars && v.periodo <= periodoCarsHasta);
    hayCars = true;
  } catch {
    ventasCars = [];
  }
  const carsPorMarca = new Map<string, { clave: string; valor: number }[]>();
  for (const v of ventasCars) {
    const lista = carsPorMarca.get(v.marca) ?? [];
    lista.push({ clave: claveCars(v.marca, v), valor: v.unidades });
    carsPorMarca.set(v.marca, lista);
  }
  const facturadasDe = (marca: string, modelo: string): number | null => {
    const r = familiaMasParecida(claveFamilia(marca, modelo), carsPorMarca.get(marca) ?? []);
    return r ? r.valores.reduce((s, u) => s + u, 0) : null;
  };

  const acciones = getAcciones();
  const accionesPorMarca = new Map<string, { clave: string; valor: AccionVersion }[]>();
  for (const h of acciones?.hojas ?? []) {
    accionesPorMarca.set(h.marca, h.versiones.map((v) => ({ clave: claveFamilia(h.marca, v.version), valor: v })));
  }
  const accionDe = (marca: string, modelo: string) => {
    const r = familiaMasParecida(claveFamilia(marca, modelo), accionesPorMarca.get(marca) ?? []);
    if (!r) return null;
    const vs = r.valores;
    const descuento = Math.max(0, ...vs.map((v) => v.descuento ?? 0));
    return {
      descuento,
      conBono: vs.some((v) => (v.bono ?? 0) > 0 || !!v.bono_texto),
      conMecanica: vs.some((v) => !!v.observaciones),
      versiones: vs.length,
      aproximado: r.aproximado,
    };
  };
  const mesAcciones = acciones ? nombreMes(acciones.mes) : null;

  // --- ficha de cada burbuja: contra quién compite ese modelo -------------
  // Esta pantalla es de la gama PROPIA y lo dice: no compara contra la
  // competencia. Pero la pregunta que sigue a ver un precio es contra quién
  // juega, y eso ya está calculado en otra parte del tablero (clases.ts +
  // precios de Datacar). Se abre al tocar la burbuja, sin cambiar la vista.
  let preciosPropios: PrecioCandidato[] = [];
  try {
    preciosPropios = (await getStockPropio())
      .filter((s) => s.precio_usd)
      .map((s) => ({ marca: s.marca, nombre: s.version, precio: s.precio_usd as number }));
  } catch {
    preciosPropios = [];
  }
  const preciosRivales: PrecioCandidato[] = (await getPreciosCompetencia())
    .map((p) => ({ marca: p.marca, nombre: p.version, precio: p.precio_usd }));
  const universo = asignarPrecios(getRankingModelos(principal, f, 3000), [
    { fuente: "cars", lista: preciosPropios },
    { fuente: "datacar", lista: preciosRivales },
  ]);
  const fichas = fichasDeModelos(universo);
  const hayDetalles = fichas.length > 0;

  return (
    <Pagina>
      <PageHeader
        titulo={t("Gama propia")}
        descripcion={
          secundaria
            ? t("Posicionamiento por precio de los modelos del grupo · {fuente} {periodo} · {fuente2} {periodo2} en la tabla.", { fuente: t(NOMBRE[principal]), periodo, fuente2: t(NOMBRE[secundaria]), periodo2: periodoSec })
            : t("Posicionamiento por precio de los modelos del grupo · {fuente} {periodo}.", { fuente: t(NOMBRE[principal]), periodo })
        }
        fuente={
          cars?.sincronizado
            ? t("Fuente: CADAM / DNRA · {cortes} · precios: {precios} (sinc. {fecha}).", { cortes: etiquetaCortes(cobertura), precios: fuentePrecio, fecha: formatFechaHora(cars.sincronizado) })
            : t("Fuente: CADAM / DNRA · {cortes} · precios: {precios}.", { cortes: etiquetaCortes(cobertura), precios: fuentePrecio })
        }
      />

      <div
        data-revelar=""
        className="-mx-1 flex flex-col gap-3 rounded-xl px-1 py-1 sm:sticky sm:top-16 sm:z-30 sm:flex-row sm:flex-wrap sm:items-start sm:bg-background/85 sm:backdrop-blur-md"
      >
        <SelectorFuente porDefecto="ambas" fuente={vista} conAmbas aclaracion={aclaracion} />
        <div className="min-w-0 sm:flex-1">
          <FiltroPeriodo pegajoso={false} anios={cobertura[principal].anios} mesMaximoPorAnio={mesMax} />
        </div>
      </div>

      {!tienePrecios ? (
        // Estado vacío con la instrucción, no una pantalla en blanco: lo que
        // falta es un dato que alguien tiene que cargar, y acá se dice cómo.
        <Card>
          <CardHeader>
            <CardTitle>
              {cars?.error ? t("No se pudo leer el stock de Cars") : t("Sin precios para este período")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <p className="text-muted-foreground">
              {cars?.error
                ? tr(
                    "Los precios salen del stock de Cars y la base no respondió: <code>{error}</code>. No es que no tengamos precios — es que no se pudieron leer ahora. El resto del tablero no depende de esto.",
                    { error: cars.error },
                    { code: (h) => <code className="rounded bg-muted px-1 py-0.5">{h}</code> }
                  )
                : t("Esta vista cruza las unidades de CADAM con el precio de lista. CADAM no trae importes, así que sin precio no hay eje que mostrar. Normalmente el precio sale solo del stock de Cars; si acá no aparece nada, o el período filtrado no tiene ventas del grupo, o el stock todavía no sincronizó.")}
            </p>
            <p className="text-muted-foreground">
              {t("También se puede cargar una lista a mano, que tiene prioridad sobre Cars:")}
            </p>
            <div className="flex flex-col gap-1 rounded-md bg-muted/50 p-2 font-mono text-xs">
              {/* i18n-ignore-start: comandos de consola, no son texto de pantalla */}
              <span>cd CADAM/scripts</span>
              <span>python3 ingest_precios.py lista.xlsx --periodo {`${f.anio}-${String(f.mesHasta).padStart(2, "0")}`} --dry-run</span>
              {/* i18n-ignore-end */}
              <span className="text-muted-foreground">{t("# revisar lo que detectó, y sin --dry-run para cargar")}</span>
            </div>
            <p className="text-muted-foreground">
              {tr(
                "El archivo puede ser .xlsx, .xls o .csv, con columnas de marca, modelo y precio — los títulos se detectan por alias. Hay una plantilla en <code>CADAM/plantilla-precios.csv</code>.",
                undefined,
                { code: (h) => <code className="rounded bg-muted px-1 py-0.5">{h}</code> }
              )}
            </p>
            {sinPrecio.length > 0 && (
              <p className="text-muted-foreground">
                {/* Con un solo modelo el inglés concuerda («1 model»); el castellano no cambia nunca («1 modelos»). */}
                {idioma === "en" && sinPrecio.length === 1
                  ? tr("Mientras tanto, el grupo tiene <b>{n} modelo</b> con ventas en el período ({u} u.) esperando precio.", { n: sinPrecio.length, u: formatUnidades(uSinPrecio) })
                  : tr("Mientras tanto, el grupo tiene <b>{n} modelos</b> con ventas en el período ({u} u.) esperando precio.", { n: sinPrecio.length, u: formatUnidades(uSinPrecio) })}
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <NotaDato>
            {listaManual
              ? tr(
                  "Precios de la <b>lista cargada a mano</b>. Se usa la más reciente que no supere el período filtrado{cargadas}.",
                  { cargadas: periodosLista.length > 0 ? ` ${t("(cargadas: {periodos})", { periodos: periodosLista.join(", ") })}` : "" }
                )
              : tr("Precios del <b>stock de Cars</b>, nuestro DMS — el mismo precio de lista que ve un vendedor, sin subir nada a mano. Cuando un modelo tiene varias versiones se toma la más barata: es el «desde» de esa gama.")}{" "}
            {tr("Esta vista solo cubre las marcas del grupo — <b>no compara contra la competencia</b>, porque CADAM no trae precios de terceros.")}
            {uTotal > 0 && (
              <>
                {" "}{principal === "importacion"
                  ? tr("Con precio: <b>{u} u.</b> ({pct} de lo que el grupo importó en el período).", { u: formatUnidades(uConPrecio), pct: formatPct(uConPrecio / uTotal) })
                  : tr("Con precio: <b>{u} u.</b> ({pct} de lo que el grupo vendió en el período).", { u: formatUnidades(uConPrecio), pct: formatPct(uConPrecio / uTotal) })}
              </>
            )}
          </NotaDato>

          <Card>
            <CardHeader>
              <CardTitle>{t("Precio vs. volumen — gama propia · {fuente} {periodo}", { fuente: t(NOMBRE[principal]), periodo })}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="pb-3 text-xs text-muted-foreground">
                {tr("Cada burbuja es un modelo, en la columna de su marca · eje Y = precio de lista · tamaño = {fuente} del período. La línea punteada es el precio <b>ponderado por unidades</b>, no el promedio simple: un modelo que vendió 3 no puede pesar lo mismo que uno que vendió 300.", { fuente: t(NOMBRE[principal]) })}
                {hayDetalles && (
                  <>
                    {" "}{tr("<b>Tocá una burbuja</b> y se abre contra quién compite ese modelo: su clase de vehículo, los rivales que más venden ahí con su precio, y si estamos caros o baratos.")}
                  </>
                )}
              </p>
              <BurbujasPrecioChart
                datos={conPrecio.map((d) => ({
                  ...d,
                  claveDetalle: claveModelo(d.marca, d.modelo),
                }))}
                columna="marca"
                fichas={hayDetalles ? fichas : undefined}
                periodo={periodo}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("La gama, modelo por modelo")}</CardTitle>
              <p className="text-xs text-muted-foreground">
                {t("Los mismos modelos del gráfico, en números: precio de lista y unidades de {fuente} ({periodo})", { fuente: t(NOMBRE[principal]), periodo })}
                {secundaria ? t(", con las {fuente} ({periodo}) al lado", { fuente: t(NOMBRE[secundaria]), periodo: periodoSec }) : ""}
                {hayCars ? t(", lo que facturamos nosotros según Cars en el mismo período") : ""}
                {mesAcciones ? (
                  <>
                    {" "}{tr(
                      "y la <a>acción comercial</a> de {mes}: el descuento máximo de la familia, si tiene bono al vendedor y si hay una mecánica especial",
                      { mes: mesAcciones },
                      { a: (h) => <Link href="/acciones-comerciales" className="text-primary underline underline-offset-2 hover:text-foreground">{h}</Link> }
                    )}
                  </>
                ) : ""}.
              </p>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("Marca")}</TableHead>
                    <TableHead>{t("Modelo")}</TableHead>
                    <TableHead nota={t("según CADAM")}>{t("Tecnología")}</TableHead>
                    <TableHead className="text-right" nota={t("lista, la versión más barata")}>{t("Precio US$")}</TableHead>
                    <TableHead className="text-right" nota={`${t(NOMBRE[principal])} · ${periodo}`}>
                      {principal === "importacion" ? t("Import.") : t("Matric.")}
                    </TableHead>
                    {secundaria && (
                      <TableHead className="text-right" nota={`${t(NOMBRE[secundaria])} · ${periodoSec}`}>
                        {secundaria === "importacion" ? t("Import.") : t("Matric.")}
                      </TableHead>
                    )}
                    {hayCars && (
                      <TableHead className="text-right" nota={t("facturado por nosotros · {periodo}", { periodo })}>{t("Fact. Cars")}</TableHead>
                    )}
                    {mesAcciones && (
                      <TableHead nota={t("descuento máximo de la familia")}>{t("Acción {mes}", { mes: mesAcciones.split(" ")[0] })}</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...conPrecio].sort((a, b) => b.unidades - a.unidades).map((d) => {
                    const o = otrasDe(d.marca, d.modelo);
                    const fact = hayCars ? facturadasDe(d.marca, d.modelo) : null;
                    const acc = mesAcciones ? accionDe(d.marca, d.modelo) : null;
                    return (
                      <TableRow key={`${d.marca}-${d.modelo}`}>
                        <TableCell><Marca marca={d.marca} /></TableCell>
                        <TableCell className="font-medium">{d.modelo}</TableCell>
                        <TableCell className="text-muted-foreground">{d.tecnologia ?? "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatUnidades(d.precio)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatUnidades(d.unidades)}</TableCell>
                        {secundaria && (
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {o === null ? "—" : formatUnidades(o)}
                          </TableCell>
                        )}
                        {hayCars && (
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {fact === null ? "—" : formatUnidades(fact)}
                          </TableCell>
                        )}
                        {mesAcciones && (
                          <TableCell className="text-xs">
                            {acc ? (
                              <Link
                                href={`/acciones-comerciales?vista=${encodeURIComponent(d.marca)}`}
                                className="inline-flex flex-wrap items-center gap-1.5 underline-offset-2 hover:underline"
                                title={`${acc.versiones === 1 ? t("1 versión en la planilla") : t("{n} versiones en la planilla", { n: acc.versiones })}${acc.aproximado ? ` ${t("(familia {familia})", { familia: acc.aproximado })}` : ""}`}
                              >
                                {acc.descuento > 0 ? (
                                  <span className="font-semibold text-rose-700 dark:text-rose-400">−US$ {formatUnidades(acc.descuento)}</span>
                                ) : (
                                  <span className="text-muted-foreground">{t("sin descuento")}</span>
                                )}
                                {acc.conBono && <span className="rounded bg-emerald-500/12 px-1 text-[10px] text-emerald-700 dark:text-emerald-400">{t("bono")}</span>}
                                {acc.conMecanica && <span className="rounded bg-muted px-1 text-[10px] text-muted-foreground">{t("mecánica")}</span>}
                              </Link>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {sinPrecio.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t("Modelos con {fuente} y sin precio", { fuente: t(NOMBRE[principal]) })}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="pb-3 text-xs text-muted-foreground">
                  {t("Vendieron en el período pero no tienen precio en la fuente. Se muestran acá en vez de desaparecer del gráfico: es un dato que falta, no un modelo que no existe.")}{" "}
                  {!listaManual && (
                    <>{tr("Son casi todos <b>camiones</b> (Fuso, Canter, chasis JAC): Cars no les pone precio de lista porque se cotizan uno por uno.")}</>
                  )}
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("Marca")}</TableHead>
                      <TableHead>{t("Modelo")}</TableHead>
                      <TableHead className="text-right" nota={t("{fuente} del período, sin precio de lista", { fuente: t(NOMBRE[principal]) })}>{t("Unidades")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sinPrecio.slice(0, 30).map((d) => (
                      <TableRow key={`${d.marca}-${d.modelo}`}>
                        <TableCell><Marca marca={d.marca} /></TableCell>
                        <TableCell>{d.modelo}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatUnidades(d.unidades)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </Pagina>
  );
}
