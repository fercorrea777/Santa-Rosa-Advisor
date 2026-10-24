import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { NotaDato, PageHeader } from "@/components/dashboard/page-header";
import { Pagina } from "@/components/movimiento/pagina";
import { FiltroPeriodo } from "@/components/dashboard/filtro-periodo";
import { SelectorFuente } from "@/components/dashboard/selector-fuente";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Seccion } from "@/components/dashboard/seccion";
import { DistribucionChart } from "@/components/charts/distribucion-chart";
import { SerieAniosChart } from "@/components/charts/serie-anios-chart";
import { StackedBarChart } from "@/components/charts/stacked-bar-chart";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  CAPITAL, getConcentracion, getCoberturaCorte, getPorCorte, getSerieCorte,
  hayCorte,
} from "@/lib/cadam/cortes";
import { getCobertura } from "@/lib/cadam/mercado";
import { serieAAnios } from "@/lib/serie";
import { getI18n } from "@/lib/i18n/servidor";
import { type SearchParams } from "@/lib/periodo";
import { cn } from "@/lib/utils";

/** Debajo de esta base, la variacion porcentual deja de significar algo:
 *  pasar de 2 a 93 unidades es +4.550% y no dice mas que "arrancó". El
 *  numero se sigue mostrando, sin el color que lo vende como noticia. */
const BASE_MINIMA = 10;

export default async function LocalidadesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const { t, tr, fmt } = await getI18n();
  const { formatPct, formatPuntosPct, formatUnidades, etiquetaPeriodo, mesCorto, etiquetaCortes } = fmt;
  const cobertura = getCobertura();

  if (!hayCorte("localidad")) {
    return (
      <Pagina>
        <PageHeader
          titulo={t("Localidades")}
          descripcion={t("Dónde se matriculan los vehículos del país.")}
        />
        <EmptyState
          title={t("Todavía no hay corte por localidad")}
          description={t("Este corte llega en un archivo aparte de CADAM. Cargalo desde «Carga de archivos» y la pantalla se arma sola.")}
        />
      </Pagina>
    );
  }

  // Cobertura PROPIA del corte, no la de matriculacion: el archivo de
  // localidad arranca en 2024 y la fuente principal en 2022. Ofrecer 2022
  // en el selector daria una pantalla vacia sin explicar por que.
  const cob = getCoberturaCorte("localidad");
  const anios = cob.anios;
  const ultimo = cob.ultimo;

  const anioPedido = Number(sp.anio);
  const anio = anios.includes(anioPedido) ? anioPedido : (ultimo?.anio ?? anios.at(-1)!);
  const topeMes = ultimo && anio === ultimo.anio ? ultimo.mes : 12;
  const mesDesde = Math.min(Math.max(Number(sp.desde) || 1, 1), 12);
  const mesHasta = Math.min(Math.max(Number(sp.hasta) || topeMes, mesDesde), 12);
  const rango = { anio, mesDesde, mesHasta };
  const periodo = etiquetaPeriodo(anio, mesDesde, mesHasta);
  const ventana =
    mesDesde === 1 && mesHasta === 12
      ? t("el año completo")
      : `${mesCorto(mesDesde)}–${mesCorto(mesHasta)}`;

  const seleccionada = typeof sp.localidad === "string" ? sp.localidad : undefined;

  const { filas, total, baseDisponible } = getPorCorte("localidad", rango);
  const capital = filas.find((f) => f.valor === CAPITAL);
  const pctCapital = capital ? capital.participacion : 0;

  // La serie mensual compara este año con el anterior; si hay una localidad
  // elegida, la serie es SOLO de esa localidad.
  const aniosSerie = [anio - 1, anio].filter((a) => anios.includes(a));
  const serie = serieAAnios(
    getSerieCorte("localidad", aniosSerie, seleccionada),
    aniosSerie
  );

  // Concentracion capital/interior: SIEMPRE sobre la misma ventana de meses
  // en todos los años. Comparar doce meses de 2025 contra siete de 2026
  // dibujaria un derrumbe que no existe.
  const concentracion = getConcentracion(anios, mesDesde, mesHasta);
  const capasConcentracion = [
    { nombre: CAPITAL, datos: concentracion.map((c) => c.capital) },
    { nombre: t("Interior"), datos: concentracion.map((c) => c.interior) },
  ];
  const primera = concentracion[0];
  const ultima = concentracion.at(-1);
  const deltaCapital =
    primera && ultima && primera.anio !== ultima.anio
      ? ultima.pctCapital - primera.pctCapital
      : null;

  return (
    <Pagina>
      <PageHeader
        titulo={t("Localidades")}
        descripcion={t("Dónde se matriculan los vehículos del país · {periodo}.", { periodo })}
        fuente={t("Fuente: CADAM / DNRA · {cortes}.", { cortes: etiquetaCortes(cobertura) })}
      />

      {/* Mismo selector que el resto de las pantallas (Croman, 15/09/2026),
          con Importaciones apagada y el porqué: el corte por localidad
          existe solo en matriculación. La base de importación de CADAM
          dice qué entró, no adónde fue. Apagada y no escondida: que esta
          pantalla no lo tenga es un dato, y así nadie lo busca. */}
      <div
        data-revelar=""
        className="-mx-1 flex flex-col gap-3 rounded-xl px-1 py-1 sm:sticky sm:top-16 sm:z-30 sm:flex-row sm:flex-wrap sm:items-start sm:bg-background/85 sm:backdrop-blur-md"
      >
        <SelectorFuente
          fuente="matriculacion"
          porDefecto="matriculacion"
          deshabilitadas={{
            importacion: t("La base de importación de CADAM no dice a qué localidad va el vehículo: este corte solo existe en matriculación."),
          }}
          aclaracion={`${t("Solo matriculaciones: la importación no tiene localidad (CADAM dice qué entró, no adónde fue).")}${ultimo ? ` ${t("Datos hasta {mes} {anio}.", { mes: mesCorto(ultimo.mes), anio: ultimo.anio })}` : ""}`}
        />
        <div className="min-w-0 sm:flex-1">
          <FiltroPeriodo
            pegajoso={false}
            anios={anios}
            mesMaximoPorAnio={Object.fromEntries(
              anios.map((a) => [a, ultimo && a === ultimo.anio ? ultimo.mes : 12])
            )}
          />
        </div>
      </div>

      <NotaDato>
        {tr("CADAM no documenta si «localidad» es el domicilio del comprador o la oficina donde se procesó el registro. {capital} concentra ~8 de cada 10 unidades, muy por encima de su peso poblacional, así que el corte probablemente refleje <b>dónde se tramitó la matrícula</b> — habitualmente la plaza del concesionario— y no dónde vive quien compró. Confirmalo con CADAM antes de leerlo como demanda por ciudad.", { capital: CAPITAL })}
      </NotaDato>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard
          label={t("Matriculaciones del período")}
          value={formatUnidades(total)}
          valorAnimado={total}
          formato="unidades"
          periodo={periodo}
          tono="azul"
        />
        <KpiCard
          label={t("Concentración en {capital}", { capital: CAPITAL })}
          value={formatPct(pctCapital)}
          valorAnimado={pctCapital}
          formato="porcentaje"
          periodo={periodo}
          // Sin `variacion`: el KPI la renderiza como % y acá el cambio se
          // mide en PUNTOS de participación, que no es lo mismo. Va en el
          // tooltip, con su unidad correcta.
          tooltip={
            t("{n} de {total} unidades.", { n: formatUnidades(capital?.unidades ?? 0), total: formatUnidades(total) }) +
            (capital?.deltaParticipacion != null
              ? ` ${t("{pp} contra {ventana} de {anio}.", { pp: formatPuntosPct(capital.deltaParticipacion), ventana, anio: anio - 1 })}`
              : "")
          }
          tono="tinta"
        />
        <KpiCard
          label={t("Localidades con registros")}
          value={String(filas.length)}
          periodo={periodo}
          tooltip={t("Municipios con al menos una matriculación en el período.")}
          chipIcono="segmentos"
          chipTono="mint"
        />
      </div>

      <Seccion titulo={t("Dónde se matricula")}
        nota={t("En qué ciudades se pone la chapa. Dice dónde hay mercado que la casa todavía no atiende con un local.")}>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("Ranking del interior — {periodo}", { periodo })}</CardTitle>
            <p className="text-xs text-muted-foreground">
              {/* Sin la capital a proposito. Con {formatPct(pctCapital)} del
                  total, su barra deja a TODAS las demas en el minimo de 3px:
                  el grafico pasaba a decir una sola cosa, la que ya cuentan
                  el KPI y la tarjeta de concentracion. Ninguna localidad
                  desaparece: estan todas en la tabla de abajo. */}
              {t("{capital} queda afuera de este gráfico: con {pct} del total dejaba al resto en una línea. Está en el KPI de arriba, en la comparación de abajo y en la tabla. Hacé clic en una barra para aislar esa localidad en la evolución mensual.", { capital: CAPITAL, pct: formatPct(pctCapital) })}
            </p>
          </CardHeader>
          <CardContent>
            <DistribucionChart
              datos={filas
                .filter((f) => f.valor !== CAPITAL)
                .map((f) => ({ nombre: f.valor, valor: f.unidades }))}
              param="localidad"
              maximo={10}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {t("Evolución mensual")}{seleccionada ? ` — ${seleccionada}` : ""}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {seleccionada
                ? t("Solo {localidad}. Quitá el filtro para ver el país entero.", { localidad: seleccionada })
                : t("Todo el país. Elegí una localidad en el ranking para aislarla.")}
            </p>
          </CardHeader>
          <CardContent>
            {serie.length ? (
              <SerieAniosChart series={serie} />
            ) : (
              <p className="py-16 text-center text-sm text-muted-foreground">
                {t("Sin datos para este filtro.")}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      </Seccion>

      {concentracion.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>
              {t("{capital} vs. interior — {ventana} de cada año", { capital: CAPITAL, ventana })}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {tr("Todos los años se miden sobre la <b>misma ventana de meses</b> ({ventana}), porque el último está a medias: apilar doce meses al lado de {n} dibujaría una caída que no existe.", { ventana, n: mesHasta - mesDesde + 1 })}
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <StackedBarChart
              categorias={concentracion.map((c) => String(c.anio))}
              series={capasConcentracion}
              altura={240}
            />
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
              {concentracion.map((c) => (
                <span key={c.anio}>
                  {tr("<y>{anio}</y>: {pct} {capital} · {n} localidades", {
                    anio: c.anio, pct: formatPct(c.pctCapital), capital: CAPITAL, n: c.localidades,
                  }, { y: (h) => <strong className="text-foreground">{h}</strong> })}
                </span>
              ))}
            </div>
            {deltaCapital !== null && (
              <p className="text-xs text-muted-foreground">
                {deltaCapital < 0
                  ? t("El interior gana terreno: {capital} cede {pp} de participación entre {desde} y {hasta}.", { capital: CAPITAL, pp: formatPuntosPct(deltaCapital), desde: primera!.anio, hasta: ultima!.anio })
                  : t("{capital} se concentra todavía más: {pp} entre {desde} y {hasta}.", { capital: CAPITAL, pp: formatPuntosPct(deltaCapital), desde: primera!.anio, hasta: ultima!.anio })}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Seccion titulo={t("Detalle")}>
      <Card>
        <CardHeader>
          <CardTitle>{t("Detalle por localidad — {periodo}", { periodo })}</CardTitle>
          <p className="text-xs text-muted-foreground">
            {baseDisponible
              ? t("Comparado contra {ventana} de {anio}, la misma ventana de meses.", { ventana, anio: anio - 1 })
              : t("{anio} no tiene esta ventana cargada, así que no hay contra qué comparar.", { anio: anio - 1 })}
          </p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("Localidad")}</TableHead>
                <TableHead className="text-right" nota={t("matriculadas ahí en el período")}>{t("Unidades")}</TableHead>
                <TableHead className="text-right" nota={t("su parte del total del país")}>{t("Participación")}</TableHead>
                <TableHead className="text-right" nota={t("el mismo período del año pasado")}>{anio - 1}</TableHead>
                <TableHead className="text-right" nota={t("cuánto creció o cayó")}>{t("Variación")}</TableHead>
                <TableHead className="text-right" nota={t("puntos que ganó o perdió")}>{t("Δ participación")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((f) => (
                <TableRow
                  key={f.valor}
                  className={cn(f.valor === seleccionada && "bg-primary/5")}
                >
                  <TableCell className="font-medium">{f.valor}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatUnidades(f.unidades)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatPct(f.participacion)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {baseDisponible ? formatUnidades(f.unidadesAnterior) : "—"}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right tabular-nums",
                      // El color solo cuando la base da para leer el
                      // porcentaje. PARAGUARI paso de 2 a 93 unidades:
                      // +4.550% es aritmeticamente cierto y practicamente
                      // ruido, y pintarlo de verde lo vende como un exito.
                      // El dato queda; el enfasis no.
                      f.variacion !== null &&
                        (f.unidadesAnterior < BASE_MINIMA
                          ? "text-muted-foreground"
                          : f.variacion > 0
                            ? "text-emerald-700 dark:text-emerald-400"
                            : "text-rose-700 dark:text-rose-400")
                    )}
                    title={
                      f.variacion !== null && f.unidadesAnterior < BASE_MINIMA
                        ? t("Base chica ({n} u. en {anio}): el porcentaje se dispara con cualquier movimiento. Mirá la Δ participación.", { n: f.unidadesAnterior, anio: anio - 1 })
                        : undefined
                    }
                  >
                    {/* null = entrante o sin base. No es 0% ni un +∞
                        disfrazado de porcentaje gigante. */}
                    {f.variacion === null
                      ? baseDisponible && f.unidadesAnterior === 0
                        ? t("nueva")
                        : "—"
                      : formatPct(f.variacion, { signed: true })}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right tabular-nums",
                      f.deltaParticipacion !== null &&
                        (f.deltaParticipacion > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400")
                    )}
                  >
                    {f.deltaParticipacion === null
                      ? "—"
                      : formatPuntosPct(f.deltaParticipacion)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      </Seccion>

      <NotaDato>
        {tr("Este corte llega en un archivo propio de CADAM y <b>no se suma</b> a las matriculaciones del resto del tablero: es la misma matriculación cortada por municipio. Verificado mes a mes contra la fuente principal.")}
        {" "}
        {ultimo
          ? t("Cobertura: {desde}–{hasta}, último mes cargado {mes}.", { desde: anios[0], hasta: anios.at(-1)!, mes: `${mesCorto(ultimo.mes)} ${ultimo.anio}` })
          : t("Cobertura: {desde}–{hasta}.", { desde: anios[0], hasta: anios.at(-1)! })}
      </NotaDato>
    </Pagina>
  );
}
