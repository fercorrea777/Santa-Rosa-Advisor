import Link from "next/link";
import { Marca } from "@/components/dashboard/logo-marca";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NotaDato, PageHeader } from "@/components/dashboard/page-header";
import { Pagina } from "@/components/movimiento/pagina";
import { FiltroPeriodo } from "@/components/dashboard/filtro-periodo";
import { SelectorFuente } from "@/components/dashboard/selector-fuente";
import { TablaRanking } from "@/components/dashboard/tabla-ranking";
import { SerieAniosChart } from "@/components/charts/serie-anios-chart";
import { DistribucionChart } from "@/components/charts/distribucion-chart";
import { StackedBarChart } from "@/components/charts/stacked-bar-chart";
import { Seccion } from "@/components/dashboard/seccion";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  getCobertura, getPorDimension, getRankingMarcas, getRankingModelos,
  getSerieMensual, GRUPO_TECNOLOGIA, TECNOLOGIAS, type FilaDimension, type Fuente,
} from "@/lib/cadam/mercado";
import {
  getCoberturaCorte, getMarcasPorCombustible, getPorCorte, hayCorte,
} from "@/lib/cadam/cortes";
import {
  getCombustibleImportacion, getCoberturaCombustibleImportacion, getCoberturaNev,
  getMixNevPorAnio, getRankingMarcasNev, getRankingModelosNev, getSerieMensualNev,
  getTecnologiasImportacion, recortarANev, RESTO_NEV,
} from "@/lib/cadam/nev";
import { getMarcasPropiasSet } from "@/lib/cadam/config";
import { getOpcionesFiltro } from "@/lib/cadam/mercado";
import { serieAAnios } from "@/lib/serie";
import { formatPct, formatPuntosPct, formatUnidades } from "@/lib/format";
import {
  etiquetaPeriodo, filtroDesdeUrl, mesCorto, type SearchParams, etiquetaCorte, etiquetaCortes } from "@/lib/periodo";
import { cn } from "@/lib/utils";

/** Las tecnologías que el archivo NEV de importación distingue. */
const TECNOLOGIAS_NEV = ["HEV", "PHEV", "EV"];

export default async function CombustiblesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const cobertura = getCobertura();
  // Dos fuentes (pedido de Fernando, 15/09/2026: "que se pueda ver
  // importaciones también"). Matriculación trae la tecnología de cada
  // unidad; importación no, y se arma desde el archivo NEV (EV/HEV/PHEV)
  // y el informe estadístico (combustible). Ver lib/cadam/nev.ts.
  const fuente: Fuente = sp.fuente === "importacion" ? "importacion" : "matriculacion";
  const esImportacion = fuente === "importacion";
  const etiquetaFuente = esImportacion ? "importaciones" : "matriculaciones";
  const f = filtroDesdeUrl(sp, cobertura[fuente].ultimo);
  const periodo = etiquetaPeriodo(f.anio, f.mesDesde, f.mesHasta);
  const propias = getMarcasPropiasSet();

  // En importación, todo lo que sea tecnología se mide hasta donde llega el
  // archivo NEV (suele venir un mes atrás del informe de importación).
  const cobNev = getCoberturaNev();
  const fNev = esImportacion ? recortarANev(f) : { ...f, recortado: false };
  const periodoTec = etiquetaPeriodo(fNev.anio, fNev.mesDesde, fNev.mesHasta);

  const tecnologias: FilaDimension[] = esImportacion
    ? getTecnologiasImportacion(fNev)
    : getPorDimension("matriculacion", "tecnologia", f);
  // Orden fijo de la app (ICE -> MHEV -> ... -> EV); el resto por
  // diferencia, al final.
  const orden = new Map(TECNOLOGIAS.map((t, i) => [t as string, i]));
  tecnologias.sort((a, b) => (orden.get(a.valor) ?? 99) - (orden.get(b.valor) ?? 99));

  // Una tecnología se puede abrir (evolución, marcas, modelos) si la fuente
  // la distingue por unidad: en matriculación todas; en importación solo
  // las del archivo NEV — el resto es una resta, no tiene marcas.
  const abrible = (tec: string) => !esImportacion || TECNOLOGIAS_NEV.includes(tec);

  const propiasPorTec = new Map<string, number | null>();
  for (const t of tecnologias) {
    if (!abrible(t.valor)) {
      propiasPorTec.set(t.valor, null);
      continue;
    }
    const marcas = esImportacion
      ? getRankingMarcasNev({ ...fNev, tecnologia: t.valor, marca: undefined })
      : getRankingMarcas("matriculacion", { ...f, tecnologia: t.valor, marca: undefined });
    const u = marcas.filter((m) => propias.has(m.marca)).reduce((a, m) => a + m.unidades, 0);
    const total = marcas.reduce((a, m) => a + m.unidades, 0);
    propiasPorTec.set(t.valor, total ? u / total : 0);
  }

  // Serie historica de cada tecnologia: un anio por serie no sirve aca,
  // lo interesante es ver la adopcion a lo largo de los anios.
  const anios = cobertura[fuente].anios;
  const aniosSerie = esImportacion ? cobNev.anios : anios;
  const seleccionada = f.tecnologia && abrible(f.tecnologia) ? f.tecnologia : undefined;
  const serie = seleccionada
    ? serieAAnios(
        esImportacion
          ? getSerieMensualNev(aniosSerie, { tecnologia: seleccionada, marca: f.marca })
          : getSerieMensual("matriculacion", aniosSerie, { tecnologia: seleccionada, marca: f.marca }),
        aniosSerie
      )
    : [];
  // Marcas líderes SIN el filtro de marca: al tocar una marca, la tabla de
  // marcas sigue entera (con la elegida resaltada) y la de modelos pasa a
  // ser la composición de esa marca. Pedido de Fernando: "al tildar en las
  // marcas me tire cuál es la composición de los modelos".
  const fTec = { ...fNev, tecnologia: seleccionada };
  const marcasTec = seleccionada
    ? esImportacion
      ? getRankingMarcasNev({ ...fTec, marca: undefined })
      : getRankingMarcas("matriculacion", { ...f, marca: undefined })
    : [];
  const modelosTec = seleccionada
    ? esImportacion
      ? getRankingModelosNev(fTec, 100)
      : getRankingModelos("matriculacion", f, 100)
    : [];

  // Agrupacion opcional, sin perder el detalle.
  const grupos = new Map<string, number>();
  for (const t of tecnologias) {
    const g = t.valor === RESTO_NEV ? "Combustión" : GRUPO_TECNOLOGIA[t.valor] ?? "Otras";
    grupos.set(g, (grupos.get(g) ?? 0) + t.unidades);
  }

  // Mix de tecnología por AÑO (año completo): la electrificación en el
  // tiempo. La columna de tecnología existe para todas las filas de
  // matriculación (todo lo no-NEV cae en ICE), así que el apilado por año
  // suma el total real de ese año, no un subconjunto. Antes de 2024
  // prácticamente todo es Combustión; los híbridos/eléctricos emergen
  // después — que es justo la historia que cuenta el gráfico. En
  // importación el archivo NEV arranca en 2024 y Combustión sale por resta.
  const GRUPOS_ORDEN = ["Combustión", "Híbridos", "Eléctricos"] as const;
  const mixPorAnio = esImportacion
    ? getMixNevPorAnio(aniosSerie)
    : aniosSerie.map((y) => {
        const techs = getPorDimension("matriculacion", "tecnologia", { anio: y, mesDesde: 1, mesHasta: 12 });
        const porGrupo: Record<string, number> = {};
        for (const t of techs) {
          const g = GRUPO_TECNOLOGIA[t.valor] ?? "Otras";
          porGrupo[g] = (porGrupo[g] ?? 0) + t.unidades;
        }
        return porGrupo;
      });
  const capasMix = GRUPOS_ORDEN.map((g) => ({
    nombre: g,
    datos: mixPorAnio.map((m) => m[g] ?? 0),
  }));

  const mesMax: Record<number, number> = {};
  for (const a of anios) {
    mesMax[a] = a === cobertura[fuente].ultimo?.anio ? cobertura[fuente].ultimo.mes : 12;
  }

  // COMBUSTIBLE: otro archivo de CADAM y otra taxonomia que `tecnologia`.
  // En matriculación arranca en 2025, mientras que la fuente principal
  // llega hasta 2022, asi que la seccion se apaga sola en los años que el
  // archivo no cubre en vez de mostrar una tarjeta vacia. En importación
  // sale del informe estadístico (Cuadro 10): totales por mes, sin marca
  // y sin año anterior.
  const cobComb = esImportacion ? getCoberturaCombustibleImportacion() : getCoberturaCorte("combustible");
  const combDisponible = esImportacion
    ? cobComb.anios.includes(f.anio)
    : hayCorte("combustible") && cobComb.anios.includes(f.anio);
  const combImp = esImportacion && combDisponible ? getCombustibleImportacion(f) : null;
  const comb = combImp
    ? { filas: combImp.filas, total: combImp.total, totalAnterior: 0, baseDisponible: false }
    : !esImportacion && combDisponible
      ? getPorCorte("combustible", f)
      : { filas: [], total: 0, totalAnterior: 0, baseDisponible: false };
  // Solo se abre el detalle de marcas de los combustibles con peso real: la
  // cola (BIODIESEL con 1 unidad, NO DEFINIDO con 13) daria tarjetas de una
  // marca sola que no dicen nada. Siguen contadas en el grafico y la tabla.
  // (Solo matriculación: el informe de importación no baja a marca.)
  const combConMarcas = esImportacion
    ? []
    : comb.filas
        .filter((c) => c.participacion >= 0.01)
        .map((c) => ({
          combustible: c.valor,
          unidades: c.unidades,
          marcas: getMarcasPorCombustible(c.valor, f, 5),
        }));

  // Los dos archivos NO coinciden en que es un electrico, y la diferencia se
  // ve a simple vista entre dos tarjetas de esta misma pantalla. Se calcula
  // en vivo para nombrarla con los numeros del periodo que se este mirando,
  // en vez de dejar que parezca que una de las dos tarjetas esta rota.
  const electricoComb = comb.filas.find((c) => c.valor === "ELECTRICO")?.unidades ?? 0;
  const electricoTec = tecnologias
    .filter((t) => GRUPO_TECNOLOGIA[t.valor] === "Eléctricos")
    .reduce((s, t) => s + t.unidades, 0);
  const enchufablesTec = tecnologias
    .filter((t) => t.valor === "PHEV")
    .reduce((s, t) => s + t.unidades, 0);

  const opciones = getOpcionesFiltro();

  return (
    <Pagina>
      <PageHeader
        titulo="Combustibles y tecnologías"
        descripcion={`Adopción por tecnología de propulsión sobre ${etiquetaFuente} · ${periodo}.`}
        fuente={`Fuente: CADAM / DNRA · ${etiquetaCortes(cobertura)}.`}
      />

      {/* Misma fila pegajosa que Resumen del mercado: el selector de fuente
          al lado del filtro, con fondo propio. */}
      <div
        data-revelar=""
        className="-mx-1 flex flex-col gap-3 rounded-xl px-1 py-1 sm:sticky sm:top-16 sm:z-30 sm:flex-row sm:flex-wrap sm:items-end sm:bg-background/85 sm:backdrop-blur-md"
      >
        <SelectorFuente fuente={fuente} tecnologiasImportacion={TECNOLOGIAS_NEV} />
        <div className="min-w-0 sm:flex-1">
          <FiltroPeriodo
            pegajoso={false}
            anios={anios}
            mesMaximoPorAnio={mesMax}
            opciones={[
              { param: "marca", label: "Marca", valores: opciones.marcas },
              { param: "segmento", label: "Segmento", valores: opciones.segmentos },
              {
                param: "tecnologia",
                label: "Tecnología",
                valores: esImportacion ? TECNOLOGIAS_NEV : [...TECNOLOGIAS],
              },
            ]}
          />
        </div>
      </div>

      <NotaDato>
        Cada tecnología se muestra por separado y nunca se mezclan categorías
        incompatibles: <strong>MHEV no es HEV</strong>,{" "}
        <strong>PHEV no es HEV</strong> y <strong>REEV no es EV</strong>. La
        agrupación de abajo es solo una vista opcional; el detalle original no se
        pierde.
      </NotaDato>

      {esImportacion && (
        <NotaDato>
          <strong>Cómo se arma la importación.</strong> La base de importación de
          CADAM no dice si el vehículo es híbrido o eléctrico. EV, HEV y PHEV salen
          del archivo de vehículos de energía nueva (desde 2024), que es un
          subconjunto de la misma importación; el resto —«{RESTO_NEV}»— es la
          importación total menos esos tres, y junta combustión con los MHEV, que
          ese archivo no separa.
          {fNev.recortado && cobNev.ultimo ? (
            <>
              {" "}El archivo NEV llega hasta <strong>{mesCorto(cobNev.ultimo.mes)}</strong>,
              así que las tecnologías se miden en {periodoTec}; el combustible, que
              sale del informe estadístico, sí llega a {mesCorto(f.mesHasta)}.
            </>
          ) : null}
          {f.tecnologia && !seleccionada ? (
            <>
              {" "}La tecnología <strong>{f.tecnologia}</strong> no existe en el archivo
              NEV: solo se puede abrir HEV, PHEV o EV.
            </>
          ) : null}
        </NotaDato>
      )}

      {/* ---------------------------------------------------- COMBUSTIBLE --
          Va primero porque es la primera palabra del título de la pantalla, y
          hasta ahora la página prometía "combustibles" y sólo mostraba
          tecnologías. Son ejes distintos: lo que el auto QUEMA vs. su tren
          motriz. Un híbrido nafta es 'HIBRIDO' acá y 'HEV' abajo. */}
      {combDisponible ? (
        <Seccion titulo="Por combustible">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Por combustible — {periodo}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {esImportacion
                    ? `Lo que el vehículo quema, según el informe estadístico de CADAM${combImp?.informe ? ` (${etiquetaCorte(combImp.informe)})` : ""}.`
                    : "Lo que el vehículo quema, según el registro de la DNRA."}
                </p>
              </CardHeader>
              <CardContent>
                <DistribucionChart
                  datos={comb.filas.map((c) => ({ nombre: c.valor, valor: c.unidades }))}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>
                  {esImportacion ? `Unidades por combustible — ${periodo}` : `Contra el mismo período de ${f.anio - 1}`}
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  {esImportacion
                    ? "El informe estadístico solo trae el año en curso: no hay año anterior contra el que comparar."
                    : comb.baseDisponible
                      ? `Misma ventana de meses en los dos años (${periodo} vs. ${f.anio - 1}), no un año entero contra medio.`
                      : `${f.anio - 1} no tiene esta ventana cargada: no hay contra qué comparar.`}
                </p>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Combustible</TableHead>
                      <TableHead className="text-right" nota={`${esImportacion ? "importadas" : "matriculadas"} en el período`}>Unidades</TableHead>
                      <TableHead className="text-right" nota="su parte del mercado">Part.</TableHead>
                      {!esImportacion && (
                        <>
                          <TableHead className="text-right" nota="contra el año pasado">Var.</TableHead>
                          <TableHead className="text-right" nota="puntos que ganó o perdió">Δ part.</TableHead>
                        </>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {comb.filas.map((c) => (
                      <TableRow key={c.valor}>
                        <TableCell className="font-medium">{c.valor}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatUnidades(c.unidades)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatPct(c.participacion)}
                        </TableCell>
                        {!esImportacion && (
                          <>
                            <TableCell
                              className={cn(
                                "text-right tabular-nums",
                                c.variacion !== null &&
                                  (c.variacion > 0
                                    ? "text-emerald-600 dark:text-emerald-500"
                                    : "text-rose-600 dark:text-rose-500")
                              )}
                            >
                              {/* null = entrante o sin base: nunca 0% ni un
                                  porcentaje gigante que en realidad es ∞. */}
                              {c.variacion === null
                                ? comb.baseDisponible && c.unidadesAnterior === 0
                                  ? "nuevo"
                                  : "—"
                                : formatPct(c.variacion, { signed: true })}
                            </TableCell>
                            <TableCell
                              className={cn(
                                "text-right tabular-nums",
                                c.deltaParticipacion !== null &&
                                  (c.deltaParticipacion > 0
                                    ? "text-emerald-600 dark:text-emerald-500"
                                    : "text-rose-600 dark:text-rose-500")
                              )}
                            >
                              {c.deltaParticipacion === null
                                ? "—"
                                : formatPuntosPct(c.deltaParticipacion)}
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {combConMarcas.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Marcas líderes de cada combustible — {periodo}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Top 5 por combustible; la participación es sobre ese combustible,
                  no sobre el mercado. Se omiten los que no llegan al 1% del
                  período (siguen contados arriba).
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 xl:grid-cols-3">
                  {combConMarcas.map((c) => (
                    <div key={c.combustible} className="flex flex-col gap-1.5">
                      <div className="flex items-baseline justify-between gap-2 border-b pb-1.5">
                        <span className="text-sm font-semibold">{c.combustible}</span>
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          {formatUnidades(c.unidades)} u.
                        </span>
                      </div>
                      {c.marcas.map((m, i) => (
                        <div
                          key={m.marca}
                          className="flex items-baseline justify-between gap-2 text-sm"
                        >
                          <span className="flex min-w-0 items-baseline gap-2">
                            <span className="w-3 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                              {i + 1}
                            </span>
                            <span
                              className={cn(
                                "min-w-0 truncate",
                                propias.has(m.marca) && "font-semibold text-primary"
                              )}
                            >
                              <Marca marca={m.marca} />
                            </span>
                          </span>
                          <span className="shrink-0 tabular-nums text-muted-foreground">
                            {formatUnidades(m.unidades)} · {formatPct(m.participacion)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <NotaDato>
            <strong>Combustible no es tecnología, y los dos archivos no
            coinciden.</strong> Arriba se clasifica lo que el vehículo quema
            (nafta, gasoil, flex, híbrido, eléctrico); abajo, su tren motriz
            (ICE, MHEV, HEV, PHEV, REEV, EV). Un híbrido nafta cuenta como
            «HIBRIDO» arriba y como «HEV» abajo: son dos ejes del mismo
            vehículo, no dos nombres de lo mismo, y no se suman.
            {electricoComb > 0 && electricoTec > 0 && (
              <>
                {" "}Por eso este período muestra{" "}
                <strong>{formatUnidades(electricoComb)}</strong> «ELECTRICO» por
                combustible y sólo{" "}
                <strong>{formatUnidades(electricoTec)}</strong> entre EV y REEV
                por tecnología: ninguna de las dos cifras está mal, cuentan cosas
                distintas. La brecha se explica en buena parte por los{" "}
                {formatUnidades(enchufablesTec)} PHEV, que enchufan pero también
                queman combustible. <strong>Sin confirmar con CADAM:</strong> no
                documentan el criterio, y al cruzar los dos archivos aparecen
                casos que no cierran (unidades marcadas «ELECTRICO» que del otro
                lado figuran como ICE). Para contar eléctricos puros, la cifra
                buena es la de tecnología.
              </>
            )}
            {esImportacion ? (
              <>
                {" "}En importación el combustible es un total del informe estadístico:
                los filtros de marca, segmento y tecnología no lo tocan y no se
                abre por marca.
              </>
            ) : f.tecnologia ? (
              <>
                {" "}El filtro de tecnología <strong>{f.tecnologia}</strong> no se
                aplica a esta sección: el archivo de combustible no trae columna
                de tecnología, así que los dos cortes no se pueden cruzar fila a
                fila.
              </>
            ) : null}{" "}
            Cobertura del corte: {cobComb.anios[0]}–{cobComb.anios.at(-1)}.
          </NotaDato>
        </Seccion>
      ) : (
        <NotaDato>
          El corte por combustible sólo está cargado para{" "}
          {cobComb.anios.length
            ? `${cobComb.anios[0]}–${cobComb.anios.at(-1)}`
            : "ningún año todavía"}
          , y estás viendo {f.anio}.{" "}
          {esImportacion
            ? "Sale del informe estadístico de CADAM, que solo trae el año en curso."
            : "Viene en un archivo aparte de CADAM, más corto que la serie principal."}{" "}
          Lo de abajo —el corte por tecnología— cubre{" "}
          {esImportacion ? `${aniosSerie[0]}–${aniosSerie.at(-1)}` : "todos los años igual"}.
        </NotaDato>
      )}

      <Seccion titulo="Por tecnología">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Por grupo — {periodoTec}</CardTitle>
            <p className="text-xs text-muted-foreground">
              Combustión, híbridos y eléctricos del período, sin perder el
              detalle de cada tecnología (tabla de abajo).
            </p>
          </CardHeader>
          <CardContent>
            {/* `paleta`: los tres grupos se repiten en el apilado por año de
                al lado, asi que cada uno conserva SU color. `grupos` se
                arma recorriendo TECNOLOGIAS (ICE -> MHEV -> ... -> EV), asi
                que el orden de insercion ya es Combustion/Hibridos/
                Electricos, el mismo GRUPOS_ORDEN que usa el apilado. */}
            <DistribucionChart
              datos={GRUPOS_ORDEN.filter((g) => grupos.has(g)).map((g) => ({ nombre: g, valor: grupos.get(g) ?? 0 }))}
              paleta
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mix por año — {etiquetaFuente}</CardTitle>
            <p className="text-xs text-muted-foreground">
              La composición de cada año completo: cómo se mueve la
              electrificación en el tiempo.
              {esImportacion ? " Desde 2024, que es cuando arranca el archivo NEV." : ""}
            </p>
          </CardHeader>
          <CardContent>
            <StackedBarChart categorias={aniosSerie.map(String)} series={capasMix} altura={260} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            Ranking por tecnología — {etiquetaFuente}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Hacé clic en una tecnología para filtrar toda la página; abajo
            aparecen su evolución y sus marcas y modelos líderes. Otro clic lo
            quita.
            {esImportacion ? ` «${RESTO_NEV}» no se abre: es una resta, no tiene marcas.` : ""}
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col divide-y sm:hidden">
            {tecnologias.map((t) => (
              <Link
                key={t.valor}
                href={abrible(t.valor) ? hrefToggleTec(sp, t.valor) : hrefToggleTec(sp, "")}
                scroll={false}
                className={cn(
                  "flex flex-col gap-1.5 py-3 transition-colors hover:bg-muted/30",
                  t.valor === seleccionada && "-mx-3 rounded-md bg-primary/5 px-3"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="min-w-0 truncate font-medium">{t.valor}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      · {grupoDe(t.valor)}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs tabular-nums">
                    {t.variacion === null ? "—" : formatPct(t.variacion, { signed: true })}
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-lg font-semibold tabular-nums">
                    {formatUnidades(t.unidades)}
                  </span>
                  <span className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="tabular-nums">{formatPct(t.participacion)}</span>
                    <span className="tabular-nums">
                      Δ {t.deltaParticipacion === null ? "—" : formatPuntosPct(t.deltaParticipacion)}
                    </span>
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Marcas propias: {pctPropias(propiasPorTec.get(t.valor))}
                </div>
              </Link>
            ))}
          </div>
          <div className="hidden overflow-x-auto sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tecnología</TableHead>
                  <TableHead nota="combustión, híbrido o eléctrico">Grupo</TableHead>
                  <TableHead className="text-right" nota={`${esImportacion ? "importadas" : "matriculadas"} en el período`}>Unidades</TableHead>
                  <TableHead className="text-right" nota="su parte del mercado">Participación</TableHead>
                  <TableHead className="text-right" nota="cuánto creció o cayó la tecnología">Var. vs {f.anio - 1}</TableHead>
                  <TableHead className="text-right" nota="puntos que ganó o perdió">Δ participación</TableHead>
                  <TableHead className="text-right" nota="cuánto de esa tecnología es nuestro">Marcas propias</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tecnologias.map((t) => (
                  <TableRow
                    key={t.valor}
                    className={cn(
                      "transition-colors hover:bg-muted/30",
                      t.valor === seleccionada && "bg-primary/5"
                    )}
                  >
                    <TableCell className="font-medium">
                      {abrible(t.valor) ? (
                        <Link
                          href={hrefToggleTec(sp, t.valor)}
                          scroll={false}
                          className={cn(
                            "underline-offset-4 hover:underline",
                            t.valor === seleccionada ? "text-primary underline" : "text-foreground"
                          )}
                        >
                          {t.valor}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">{t.valor}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {grupoDe(t.valor)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatUnidades(t.unidades)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatPct(t.participacion)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {t.variacion === null ? "—" : formatPct(t.variacion, { signed: true })}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {t.deltaParticipacion === null ? "—" : formatPuntosPct(t.deltaParticipacion)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {pctPropias(propiasPorTec.get(t.valor))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {seleccionada ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>
                Evolución histórica — {seleccionada} en {etiquetaFuente} (
                {aniosSerie[0]}–{aniosSerie[aniosSerie.length - 1]})
                {f.marca ? ` · ${f.marca}` : ""}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Una línea por año: dice si esa tecnología está creciendo de
                verdad o si solo creció el mercado entero.
              </p>
            </CardHeader>
            <CardContent><SerieAniosChart series={serie} altura={320} /></CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Marcas líderes en {seleccionada}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Quién se está quedando con esa tecnología. Las marcas propias
                  van resaltadas. Tocá una marca y al lado aparece la composición
                  de sus modelos; tocala de nuevo y se quita.
                </p>
              </CardHeader>
              <CardContent>
                <TablaRanking
                  filas={marcasTec}
                  filtrarPor={{ marca: "marca" }}
                  nombreArchivo={`tecnologia-${seleccionada}-marcas`}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>
                  {f.marca ? `Modelos de ${f.marca} en ${seleccionada}` : `Modelos líderes en ${seleccionada}`}
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  {f.marca
                    ? `La composición de ${f.marca} en esa tecnología: qué modelos, y cuánto pesa cada uno dentro de la marca.`
                    : "Los modelos concretos que se venden con esa tecnología: es el nivel al que se arma una respuesta de producto."}
                </p>
              </CardHeader>
              <CardContent>
                <TablaRanking filas={modelosTec} mostrarModelo mostrarSegmento={!esImportacion}
                  filtrarPor={{ marca: "marca" }}
                  nombreArchivo={`tecnologia-${seleccionada}-modelos${f.marca ? `-${f.marca}` : ""}`} />
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          Hacé clic en una tecnología de la tabla (o usá el filtro de arriba) para ver su evolución histórica y sus
          marcas y modelos líderes.
        </p>
      )}

      <NotaDato>
        {esImportacion ? (
          <>
            Estos cortes salen del archivo de vehículos de energía nueva de
            CADAM, que cubre EV, HEV y PHEV desde 2024 y es un{" "}
            <strong>subconjunto</strong> de la importación (no se suma). No
            distingue MHEV ni REEV, y tampoco trae segmento: por eso las
            tablas de modelos no lo muestran y con un segmento elegido el
            resto por diferencia no se calcula.
          </>
        ) : (
          <>
            Estos cortes salen de la matriculación, que es la única fuente con el
            detalle de tecnología por unidad. La base de importación no trae esa
            columna, y el archivo de vehículos de energía nueva es un{" "}
            <strong>subconjunto</strong> de ella (no se suma) y solo cubre EV/HEV/PHEV
            desde 2024. Tampoco se puede separar nafta de diésel: ambas van como ICE.
          </>
        )}
      </NotaDato>
      </Seccion>
    </Pagina>
  );
}

function grupoDe(tecnologia: string): string {
  if (tecnologia === RESTO_NEV) return "Combustión";
  return GRUPO_TECNOLOGIA[tecnologia] ?? "—";
}

/** null = no se puede saber (el resto por diferencia no tiene marcas). */
function pctPropias(v: number | null | undefined): string {
  return v === null || v === undefined ? "—" : formatPct(v);
}

/** URL que activa/desactiva el filtro de tecnología conservando el resto de
 *  los parámetros. Clic en una tecnología ya elegida = la quita; valor
 *  vacío = la quita también. */
function hrefToggleTec(sp: SearchParams, valor: string): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    const val = Array.isArray(v) ? v[0] : v;
    if (val) q.set(k, val);
  }
  if (!valor || q.get("tecnologia") === valor) q.delete("tecnologia");
  else q.set("tecnologia", valor);
  const qs = q.toString();
  return qs ? `/combustibles?${qs}` : "/combustibles";
}
