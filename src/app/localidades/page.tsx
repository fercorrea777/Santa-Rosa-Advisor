import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { NotaDato, PageHeader } from "@/components/dashboard/page-header";
import { FiltroPeriodo } from "@/components/dashboard/filtro-periodo";
import { EmptyState } from "@/components/dashboard/empty-state";
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
import { formatPct, formatPuntosPct, formatUnidades } from "@/lib/format";
import { etiquetaPeriodo, mesCorto, type SearchParams } from "@/lib/periodo";
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
  const cobertura = getCobertura();

  if (!hayCorte("localidad")) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader
          titulo="Localidades"
          descripcion="Dónde se matriculan los vehículos del país."
        />
        <EmptyState
          title="Todavía no hay corte por localidad"
          description="Este corte llega en un archivo aparte de CADAM. Cargalo desde «Carga de archivos» y la pantalla se arma sola."
        />
      </div>
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
      ? "el año completo"
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
    { nombre: "Interior", datos: concentracion.map((c) => c.interior) },
  ];
  const primera = concentracion[0];
  const ultima = concentracion.at(-1);
  const deltaCapital =
    primera && ultima && primera.anio !== ultima.anio
      ? ultima.pctCapital - primera.pctCapital
      : null;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        titulo="Localidades"
        descripcion={`Dónde se matriculan los vehículos del país · ${periodo}.`}
        fuente={`Fuente: CADAM / DNRA · snapshot ${cobertura.snapshot ?? "—"}.`}
      />

      <FiltroPeriodo
        anios={anios}
        mesMaximoPorAnio={Object.fromEntries(
          anios.map((a) => [a, ultimo && a === ultimo.anio ? ultimo.mes : 12])
        )}
      />

      <NotaDato>
        CADAM no documenta si «localidad» es el domicilio del comprador o la
        oficina donde se procesó el registro. {CAPITAL} concentra ~8 de cada 10
        unidades, muy por encima de su peso poblacional, así que el corte
        probablemente refleje <strong>dónde se tramitó la matrícula</strong> —
        habitualmente la plaza del concesionario— y no dónde vive quien compró.
        Confirmalo con CADAM antes de leerlo como demanda por ciudad.
      </NotaDato>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard
          label="Matriculaciones del período"
          value={formatUnidades(total)}
          valorAnimado={total}
          formato="unidades"
          periodo={periodo}
          tono="azul"
        />
        <KpiCard
          label={`Concentración en ${CAPITAL}`}
          value={formatPct(pctCapital)}
          valorAnimado={pctCapital}
          formato="porcentaje"
          periodo={periodo}
          // Sin `variacion`: el KPI la renderiza como % y acá el cambio se
          // mide en PUNTOS de participación, que no es lo mismo. Va en el
          // tooltip, con su unidad correcta.
          tooltip={
            `${formatUnidades(capital?.unidades ?? 0)} de ${formatUnidades(total)} unidades.` +
            (capital?.deltaParticipacion != null
              ? ` ${formatPuntosPct(capital.deltaParticipacion)} contra ${ventana} de ${anio - 1}.`
              : "")
          }
          tono="tinta"
        />
        <KpiCard
          label="Localidades con registros"
          value={String(filas.length)}
          periodo={periodo}
          tooltip="Municipios con al menos una matriculación en el período."
          chipIcono="segmentos"
          chipTono="mint"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Ranking del interior — {periodo}</CardTitle>
            <p className="text-xs text-muted-foreground">
              {/* Sin la capital a proposito. Con {formatPct(pctCapital)} del
                  total, su barra deja a TODAS las demas en el minimo de 3px:
                  el grafico pasaba a decir una sola cosa, la que ya cuentan
                  el KPI y la tarjeta de concentracion. Ninguna localidad
                  desaparece: estan todas en la tabla de abajo. */}
              {CAPITAL} queda afuera de este gráfico: con {formatPct(pctCapital)}{" "}
              del total dejaba al resto en una línea. Está en el KPI de arriba,
              en la comparación de abajo y en la tabla. Hacé clic en una barra
              para aislar esa localidad en la evolución mensual.
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
              Evolución mensual{seleccionada ? ` — ${seleccionada}` : ""}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {seleccionada
                ? `Solo ${seleccionada}. Quitá el filtro para ver el país entero.`
                : "Todo el país. Elegí una localidad en el ranking para aislarla."}
            </p>
          </CardHeader>
          <CardContent>
            {serie.length ? (
              <SerieAniosChart series={serie} />
            ) : (
              <p className="py-16 text-center text-sm text-muted-foreground">
                Sin datos para este filtro.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {concentracion.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>
              {CAPITAL} vs. interior — {ventana} de cada año
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Todos los años se miden sobre la <strong>misma ventana de
              meses</strong> ({ventana}), porque el último está a medias:
              apilar doce meses al lado de {mesHasta - mesDesde + 1} dibujaría
              una caída que no existe.
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
                  <strong className="text-foreground">{c.anio}</strong>:{" "}
                  {formatPct(c.pctCapital)} {CAPITAL} ·{" "}
                  {c.localidades} localidades
                </span>
              ))}
            </div>
            {deltaCapital !== null && (
              <p className="text-xs text-muted-foreground">
                {deltaCapital < 0
                  ? `El interior gana terreno: ${CAPITAL} cede ${formatPuntosPct(deltaCapital)} de participación entre ${primera!.anio} y ${ultima!.anio}.`
                  : `${CAPITAL} se concentra todavía más: ${formatPuntosPct(deltaCapital)} entre ${primera!.anio} y ${ultima!.anio}.`}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Detalle por localidad — {periodo}</CardTitle>
          <p className="text-xs text-muted-foreground">
            {baseDisponible
              ? `Comparado contra ${ventana} de ${anio - 1}, la misma ventana de meses.`
              : `${anio - 1} no tiene esta ventana cargada, así que no hay contra qué comparar.`}
          </p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Localidad</TableHead>
                <TableHead className="text-right">Unidades</TableHead>
                <TableHead className="text-right">Participación</TableHead>
                <TableHead className="text-right">{anio - 1}</TableHead>
                <TableHead className="text-right">Variación</TableHead>
                <TableHead className="text-right">Δ participación</TableHead>
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
                            ? "text-emerald-600 dark:text-emerald-500"
                            : "text-rose-600 dark:text-rose-500")
                    )}
                    title={
                      f.variacion !== null && f.unidadesAnterior < BASE_MINIMA
                        ? `Base chica (${f.unidadesAnterior} u. en ${anio - 1}): el porcentaje se dispara con cualquier movimiento. Mirá la Δ participación.`
                        : undefined
                    }
                  >
                    {/* null = entrante o sin base. No es 0% ni un +∞
                        disfrazado de porcentaje gigante. */}
                    {f.variacion === null
                      ? baseDisponible && f.unidadesAnterior === 0
                        ? "nueva"
                        : "—"
                      : formatPct(f.variacion, { signed: true })}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right tabular-nums",
                      f.deltaParticipacion !== null &&
                        (f.deltaParticipacion > 0 ? "text-emerald-600 dark:text-emerald-500" : "text-rose-600 dark:text-rose-500")
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

      <NotaDato>
        Este corte llega en un archivo propio de CADAM y <strong>no se suma</strong>{" "}
        a las matriculaciones del resto del tablero: es la misma matriculación
        cortada por municipio. Verificado mes a mes contra la fuente principal.
        Cobertura: {anios[0]}–{anios.at(-1)}
        {ultimo ? `, último mes cargado ${mesCorto(ultimo.mes)} ${ultimo.anio}` : ""}.
      </NotaDato>
    </div>
  );
}
