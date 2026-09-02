import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NotaDato, PageHeader } from "@/components/dashboard/page-header";
import { FiltroPeriodo } from "@/components/dashboard/filtro-periodo";
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
  getSerieMensual, GRUPO_TECNOLOGIA, TECNOLOGIAS,
} from "@/lib/cadam/mercado";
import {
  getCoberturaCorte, getMarcasPorCombustible, getPorCorte, hayCorte,
} from "@/lib/cadam/cortes";
import { getMarcasPropiasSet } from "@/lib/cadam/config";
import { serieAAnios } from "@/lib/serie";
import { formatPct, formatPuntosPct, formatUnidades } from "@/lib/format";
import { etiquetaPeriodo, filtroDesdeUrl, type SearchParams } from "@/lib/periodo";
import { cn } from "@/lib/utils";

export default async function CombustiblesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const cobertura = getCobertura();
  const f = filtroDesdeUrl(sp, cobertura.matriculacion.ultimo);
  const periodo = etiquetaPeriodo(f.anio, f.mesDesde, f.mesHasta);
  const propias = getMarcasPropiasSet();

  const tecnologias = getPorDimension("matriculacion", "tecnologia", f);
  const orden = new Map(TECNOLOGIAS.map((t, i) => [t as string, i]));
  tecnologias.sort((a, b) => (orden.get(a.valor) ?? 99) - (orden.get(b.valor) ?? 99));

  const propiasPorTec = new Map<string, number>();
  for (const t of tecnologias) {
    const marcas = getRankingMarcas("matriculacion", { ...f, tecnologia: t.valor });
    const u = marcas.filter((m) => propias.has(m.marca)).reduce((a, m) => a + m.unidades, 0);
    propiasPorTec.set(t.valor, t.unidades ? u / t.unidades : 0);
  }

  // Serie historica de cada tecnologia: un anio por serie no sirve aca,
  // lo interesante es ver la adopcion a lo largo de los anios.
  const anios = cobertura.matriculacion.anios;
  const seleccionada = f.tecnologia;
  const serie = seleccionada
    ? serieAAnios(getSerieMensual("matriculacion", anios, { tecnologia: seleccionada }), anios)
    : [];
  const marcasTec = seleccionada ? getRankingMarcas("matriculacion", f) : [];
  const modelosTec = seleccionada ? getRankingModelos("matriculacion", f, 100) : [];

  // Agrupacion opcional, sin perder el detalle.
  const grupos = new Map<string, number>();
  for (const t of tecnologias) {
    const g = GRUPO_TECNOLOGIA[t.valor] ?? "Otras";
    grupos.set(g, (grupos.get(g) ?? 0) + t.unidades);
  }

  // Mix de tecnología por AÑO (año completo): la electrificación en el
  // tiempo. La columna de tecnología existe para todas las filas de
  // matriculación (todo lo no-NEV cae en ICE), así que el apilado por año
  // suma el total real de ese año, no un subconjunto. Antes de 2024
  // prácticamente todo es Combustión; los híbridos/eléctricos emergen
  // después — que es justo la historia que cuenta el gráfico.
  const GRUPOS_ORDEN = ["Combustión", "Híbridos", "Eléctricos"] as const;
  const mixPorAnio = anios.map((y) => {
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
    mesMax[a] = a === cobertura.matriculacion.ultimo?.anio ? cobertura.matriculacion.ultimo.mes : 12;
  }

  // COMBUSTIBLE: otro archivo de CADAM y otra taxonomia que `tecnologia`.
  // Arranca en 2025, mientras que la fuente principal llega hasta 2022, asi
  // que la seccion se apaga sola en los años que el archivo no cubre en vez
  // de mostrar una tarjeta vacia.
  const cobComb = getCoberturaCorte("combustible");
  const combDisponible = hayCorte("combustible") && cobComb.anios.includes(f.anio);
  const comb = combDisponible
    ? getPorCorte("combustible", f)
    : { filas: [], total: 0, totalAnterior: 0, baseDisponible: false };
  // Solo se abre el detalle de marcas de los combustibles con peso real: la
  // cola (BIODIESEL con 1 unidad, NO DEFINIDO con 13) daria tarjetas de una
  // marca sola que no dicen nada. Siguen contadas en el grafico y la tabla.
  const combConMarcas = comb.filas
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

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        titulo="Combustibles y tecnologías"
        descripcion={`Adopción por tecnología de propulsión sobre matriculaciones · ${periodo}.`}
        fuente={`Fuente: CADAM / DNRA · snapshot ${cobertura.snapshot ?? "—"}.`}
      />

      <FiltroPeriodo
        anios={anios}
        mesMaximoPorAnio={mesMax}
        opciones={[{ param: "tecnologia", label: "Tecnología", valores: [...TECNOLOGIAS] }]}
      />

      <NotaDato>
        Cada tecnología se muestra por separado y nunca se mezclan categorías
        incompatibles: <strong>MHEV no es HEV</strong>,{" "}
        <strong>PHEV no es HEV</strong> y <strong>REEV no es EV</strong>. La
        agrupación de abajo es solo una vista opcional; el detalle original no se
        pierde.
      </NotaDato>

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
                  Lo que el vehículo quema, según el registro de la DNRA.
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
                  Contra el mismo período de {f.anio - 1}
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  {comb.baseDisponible
                    ? `Misma ventana de meses en los dos años (${periodo} vs. ${f.anio - 1}), no un año entero contra medio.`
                    : `${f.anio - 1} no tiene esta ventana cargada: no hay contra qué comparar.`}
                </p>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Combustible</TableHead>
                      <TableHead className="text-right">Unidades</TableHead>
                      <TableHead className="text-right">Part.</TableHead>
                      <TableHead className="text-right">Var.</TableHead>
                      <TableHead className="text-right">Δ part.</TableHead>
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
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

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
                            {m.marca}
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
            {f.tecnologia ? (
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
          , y estás viendo {f.anio}. Viene en un archivo aparte de CADAM, más
          corto que la serie principal. Lo de abajo —el corte por tecnología—
          cubre todos los años igual.
        </NotaDato>
      )}

      <Seccion titulo="Por tecnología">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Por grupo — {periodo}</CardTitle>
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
              datos={[...grupos.entries()].map(([nombre, valor]) => ({ nombre, valor }))}
              paleta
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mix por año — matriculaciones</CardTitle>
            <p className="text-xs text-muted-foreground">
              La composición de cada año completo: cómo se mueve la
              electrificación en el tiempo.
            </p>
          </CardHeader>
          <CardContent>
            <StackedBarChart categorias={anios.map(String)} series={capasMix} altura={260} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            Ranking por tecnología — matriculaciones
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Hacé clic en una tecnología para filtrar toda la página; abajo
            aparecen su evolución y sus marcas y modelos líderes. Otro clic lo
            quita.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col divide-y sm:hidden">
            {tecnologias.map((t) => (
              <Link
                key={t.valor}
                href={hrefToggleTec(sp, t.valor)}
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
                      · {GRUPO_TECNOLOGIA[t.valor] ?? "—"}
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
                  Marcas propias: {formatPct(propiasPorTec.get(t.valor) ?? 0)}
                </div>
              </Link>
            ))}
          </div>
          <div className="hidden overflow-x-auto sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tecnología</TableHead>
                  <TableHead>Grupo</TableHead>
                  <TableHead className="text-right">Unidades</TableHead>
                  <TableHead className="text-right">Participación</TableHead>
                  <TableHead className="text-right">Var. vs {f.anio - 1}</TableHead>
                  <TableHead className="text-right">Δ participación</TableHead>
                  <TableHead className="text-right">Marcas propias</TableHead>
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
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {GRUPO_TECNOLOGIA[t.valor] ?? "—"}
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
                      {formatPct(propiasPorTec.get(t.valor) ?? 0)}
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
                Evolución histórica — {seleccionada} en matriculaciones (
                {anios[0]}–{anios[anios.length - 1]})
              </CardTitle>
            </CardHeader>
            <CardContent><SerieAniosChart series={serie} altura={320} /></CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Marcas líderes en {seleccionada}</CardTitle></CardHeader>
              <CardContent>
                <TablaRanking filas={marcasTec} nombreArchivo={`tecnologia-${seleccionada}-marcas`} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Modelos líderes en {seleccionada}</CardTitle></CardHeader>
              <CardContent>
                <TablaRanking filas={modelosTec} mostrarModelo mostrarSegmento
                  nombreArchivo={`tecnologia-${seleccionada}-modelos`} />
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
        Estos cortes salen de la matriculación, que es la única fuente con el
        detalle de tecnología por unidad. La base de importación no trae esa
        columna, y el archivo de vehículos de energía nueva es un{" "}
        <strong>subconjunto</strong> de ella (no se suma) y solo cubre EV/HEV/PHEV
        desde 2024. Tampoco se puede separar nafta de diésel: ambas van como ICE.
      </NotaDato>
      </Seccion>
    </div>
  );
}

/** URL que activa/desactiva el filtro de tecnología conservando el resto de
 *  los parámetros. Clic en una tecnología ya elegida = la quita. */
function hrefToggleTec(sp: SearchParams, valor: string): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    const val = Array.isArray(v) ? v[0] : v;
    if (val) q.set(k, val);
  }
  if (q.get("tecnologia") === valor) q.delete("tecnologia");
  else q.set("tecnologia", valor);
  const qs = q.toString();
  return qs ? `/combustibles?${qs}` : "/combustibles";
}
