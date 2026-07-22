import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { NotaDato, PageHeader } from "@/components/dashboard/page-header";
import { FiltroPeriodo } from "@/components/dashboard/filtro-periodo";
import { TablaRanking } from "@/components/dashboard/tabla-ranking";
import { SerieAniosChart } from "@/components/charts/serie-anios-chart";
import { DistribucionChart } from "@/components/charts/distribucion-chart";
import {
  getCobertura, getKpi, getOpcionesFiltro, getPorDimension, getRankingMarcas,
  getSerieMensual,
} from "@/lib/cadam/mercado";
import { etiquetaPeriodo, filtroDesdeUrl, type SearchParams } from "@/lib/periodo";
import { formatPct, formatUnidades } from "@/lib/format";
import { serieAAnios } from "@/lib/serie";

export default async function MercadoPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const cobertura = getCobertura();
  const f = filtroDesdeUrl(sp, cobertura.matriculacion.ultimo);
  const periodo = etiquetaPeriodo(f.anio, f.mesDesde, f.mesHasta);

  const matric = getKpi("matriculacion", f);
  const import_ = getKpi("importacion", f);

  // Los graficos respetan los mismos filtros que los KPIs (segmento,
  // tecnologia, marca), pero NO el rango de meses: muestran el ano
  // completo para que se vea la estacionalidad.
  const cortes = { segmento: f.segmento, tecnologia: f.tecnologia, marca: f.marca, empresa: f.empresa };
  const aniosMat = [f.anio - 1, f.anio].filter((a) =>
    cobertura.matriculacion.anios.includes(a)
  );
  const aniosImp = [f.anio - 1, f.anio].filter((a) =>
    cobertura.importacion.anios.includes(a)
  );
  const serieMat = serieAAnios(getSerieMensual("matriculacion", aniosMat, cortes), aniosMat);
  const serieImp = serieAAnios(getSerieMensual("importacion", aniosImp, cortes), aniosImp);

  const opciones = getOpcionesFiltro();
  const segmentos = getPorDimension("matriculacion", "segmento", f);
  const tecnologias = getPorDimension("matriculacion", "tecnologia", f);
  const marcas = getRankingMarcas("matriculacion", f);

  // Ganadores y perdedores por variacion absoluta de unidades: es lo que
  // mueve el mercado. El % solo puede ser enorme sobre bases minimas.
  const conBase = marcas.filter((m) => m.unidadesAnterior > 0);
  const ganadores = [...conBase]
    .sort((a, b) => b.unidades - b.unidadesAnterior - (a.unidades - a.unidadesAnterior))
    .slice(0, 5);
  const perdedores = [...conBase]
    .sort((a, b) => a.unidades - a.unidadesAnterior - (b.unidades - b.unidadesAnterior))
    .slice(0, 5);

  const mesMax: Record<number, number> = {};
  for (const a of cobertura.matriculacion.anios) {
    mesMax[a] = a === cobertura.matriculacion.ultimo?.anio ? cobertura.matriculacion.ultimo.mes : 12;
  }

  const diferencia = import_.valor - matric.valor;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        titulo="Resumen del mercado"
        descripcion={`Mercado automotor paraguayo · ${periodo} vs. mismo período ${f.anio - 1}.`}
        fuente={`Fuente: CADAM / DNRA · snapshot ${cobertura.snapshot ?? "—"}.`}
      />

      <FiltroPeriodo
        anios={cobertura.matriculacion.anios}
        mesMaximoPorAnio={mesMax}
        opciones={[
          { param: "segmento", label: "Segmento", valores: opciones.segmentos },
          { param: "tecnologia", label: "Tecnología", valores: ["ICE", "MHEV", "HEV", "PHEV", "REEV", "EV"] },
        ]}
      />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Matriculaciones"
          value={formatUnidades(matric.valor)}
          variacion={matric.variacion}
          periodo={periodo}
          tooltip={`Unidades matriculadas en el período. Comparación contra ${periodo.replace(String(f.anio), String(f.anio - 1))}: ${formatUnidades(matric.baseValor)} u.`}
        />
        <KpiCard
          label="Importaciones"
          value={formatUnidades(import_.valor)}
          variacion={import_.variacion}
          periodo={periodo}
          tooltip="Unidades importadas (livianos, base row-level de CADAM). No incluye camiones, que se reportan aparte."
        />
        <KpiCard
          label="Diferencia import. − matric."
          value={formatUnidades(Math.abs(diferencia))}
          periodo={diferencia >= 0 ? "importación por encima" : "matriculación por encima"}
          tooltip="Señal orientativa, NO stock real: hay desfasajes temporales, unidades importadas en períodos anteriores, reexportaciones y registros tardíos."
        />
        <KpiCard
          label="Marca líder"
          value={marcas[0]?.marca ?? "—"}
          periodo={marcas[0] ? `${formatUnidades(marcas[0].unidades)} u. · ${formatPct(marcas[0].participacion)}` : undefined}
          tooltip="Marca con más matriculaciones en el período filtrado."
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Evolución mensual — matriculaciones</CardTitle></CardHeader>
          <CardContent>
            <SerieAniosChart series={serieMat} />
            {cobertura.mesesFaltantes.matriculacion.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Los meses sin dato quedan como hueco en la línea, no como cero.
                Faltante detectado en el origen:{" "}
                {cobertura.mesesFaltantes.matriculacion.join(", ")}.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Evolución mensual — importaciones</CardTitle></CardHeader>
          <CardContent>
            {serieImp.length ? (
              <SerieAniosChart series={serieImp} />
            ) : (
              <p className="py-16 text-center text-sm text-muted-foreground">
                Sin datos de importación para estos años.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Participación por segmento</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3">
            <DistribucionChart
              datos={segmentos.map((s) => ({ nombre: s.valor, valor: s.unidades }))}
            />
            {segmentos.some((s) => s.valor === "Sin clasificar") && (
              <NotaDato>
                CADAM no clasifica el segmento antes de 2024. Las unidades sin
                segmento se muestran aparte, no se reparten entre los demás.
              </NotaDato>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Participación por tecnología</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3">
            <DistribucionChart
              datos={tecnologias.map((t) => ({ nombre: t.valor, valor: t.unidades }))}
            />
            <NotaDato>
              Cada tecnología se muestra por separado: MHEV no es HEV, PHEV no es
              HEV y REEV no es EV.
            </NotaDato>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <MoviminetoCard
          titulo="Principales ganadores"
          filas={ganadores}
          positivo
          disponible={matric.baseDisponible}
        />
        <MoviminetoCard
          titulo="Principales perdedores"
          filas={perdedores}
          positivo={false}
          disponible={matric.baseDisponible}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Ranking de marcas — matriculaciones ({marcas.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <TablaRanking
            filas={marcas}
            nombreArchivo={`ranking-marcas-matriculacion-${f.anio}`}
            notaVariacion={
              (matric.baseDisponible
                ? `Variación contra ${periodo.replace(String(f.anio), String(f.anio - 1))}.`
                : `Sin datos de ${f.anio - 1} para comparar.`) +
              (f.segmento
                ? ""
                : " Incluye livianos y pesados: filtrá por segmento para separarlos.")
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}

function MoviminetoCard({
  titulo, filas, positivo, disponible,
}: {
  titulo: string;
  filas: { marca: string; unidades: number; unidadesAnterior: number; variacion: number | null; participacion: number }[];
  positivo: boolean;
  disponible: boolean;
}) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">{titulo}</CardTitle></CardHeader>
      <CardContent>
        {!disponible ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Sin período anterior cargado para comparar.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {filas.map((m) => {
              const delta = m.unidades - m.unidadesAnterior;
              return (
                <li key={m.marca} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium">{m.marca}</span>
                  <span className="flex items-baseline gap-3 tabular-nums">
                    <span className={positivo ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                      {delta > 0 ? "+" : ""}{formatUnidades(delta)} u.
                    </span>
                    <span className="w-16 text-right text-xs text-muted-foreground">
                      {formatPct(m.variacion, { signed: true })}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
