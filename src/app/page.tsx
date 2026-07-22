import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { EmptyState } from "@/components/dashboard/empty-state";
import { NotaDato, PageHeader } from "@/components/dashboard/page-header";
import { FiltroPeriodo } from "@/components/dashboard/filtro-periodo";
import { TablaRanking } from "@/components/dashboard/tabla-ranking";
import { SerieAniosChart } from "@/components/charts/serie-anios-chart";
import { BarrasFiltroChart } from "@/components/charts/barras-filtro-chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getCobertura, getKpi, getOpcionesFiltro, getPorDimension, getRankingMarcas,
  getSerieMensual, SEGMENTO_SIN_CLASIFICAR, TECNOLOGIAS,
} from "@/lib/cadam/mercado";
import { getMarcasPropiasSet } from "@/lib/cadam/config";
import { serieAAnios } from "@/lib/serie";
import { formatPct, formatUnidades } from "@/lib/format";
import {
  etiquetaPeriodo, filtroDesdeUrl, mesCorto, type SearchParams,
} from "@/lib/periodo";

export default async function InicioPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const cobertura = getCobertura();

  if (!cobertura.snapshot) {
    return (
      <div className="p-6">
        <EmptyState
          title="Todavía no hay datos ingestados"
          description='Poné los archivos de CADAM en una subcarpeta de CADAM-DATA (ej. "JULIO 2026") y corré "python ingest.py --correcciones" dentro de CADAM/scripts.'
        />
      </div>
    );
  }

  const f = filtroDesdeUrl(sp, cobertura.matriculacion.ultimo);
  const periodo = etiquetaPeriodo(f.anio, f.mesDesde, f.mesHasta);
  const opciones = getOpcionesFiltro();
  const propias = getMarcasPropiasSet();

  // ------- KPIs
  const matric = getKpi("matriculacion", f);
  const importa = getKpi("importacion", f);
  const marcas = getRankingMarcas("matriculacion", f);
  const segmentos = getPorDimension("matriculacion", "segmento", f);
  const tecnologias = getPorDimension("matriculacion", "tecnologia", f);
  const tiposImportacion = getPorDimension("importacion", "segmento", f);

  const lider = marcas[0];
  const segLider = segmentos.find((s) => s.valor !== SEGMENTO_SIN_CLASIFICAR) ?? segmentos[0];

  // Tecnologia con mayor crecimiento: fuera de ICE y con base minima de
  // 30 u. para que el porcentaje signifique algo.
  const tecGanadora = [...tecnologias]
    .filter((t) => t.valor !== "ICE" && t.unidadesAnterior >= 30 && t.variacion !== null)
    .sort((a, b) => (b.variacion ?? 0) - (a.variacion ?? 0))[0];

  // Variacion vs. mes anterior: ultimo mes del rango contra el previo
  // (cruzando el limite de anio si hace falta).
  const cortes = { segmento: f.segmento, tecnologia: f.tecnologia, marca: f.marca, empresa: f.empresa };
  const serieCruda = getSerieMensual("matriculacion", [f.anio - 1, f.anio], cortes);
  const enRango = serieCruda.filter((p) => p.anio === f.anio && p.mes >= f.mesDesde && p.mes <= f.mesHasta);
  const ultimoPunto = enRango[enRango.length - 1];
  let varMesAnterior: { mes: string; valor: number; variacion: number | null } | null = null;
  if (ultimoPunto) {
    const prevAnio = ultimoPunto.mes === 1 ? ultimoPunto.anio - 1 : ultimoPunto.anio;
    const prevMes = ultimoPunto.mes === 1 ? 12 : ultimoPunto.mes - 1;
    const previo = serieCruda.find((p) => p.anio === prevAnio && p.mes === prevMes);
    varMesAnterior = {
      mes: mesCorto(ultimoPunto.mes),
      valor: ultimoPunto.unidades,
      variacion: previo?.unidades ? (ultimoPunto.unidades - previo.unidades) / previo.unidades : null,
    };
  }

  const propiasU = marcas.filter((m) => propias.has(m.marca)).reduce((s, m) => s + m.unidades, 0);
  const totalU = marcas.reduce((s, m) => s + m.unidades, 0) || 1;
  const diferencia = importa.valor - matric.valor;

  // ------- series (anio completo, para ver la estacionalidad)
  const aniosMat = [f.anio - 1, f.anio].filter((a) => cobertura.matriculacion.anios.includes(a));
  const aniosImp = [f.anio - 1, f.anio].filter((a) => cobertura.importacion.anios.includes(a));
  const serieMat = serieAAnios(getSerieMensual("matriculacion", aniosMat, cortes), aniosMat);
  const serieImp = serieAAnios(getSerieMensual("importacion", aniosImp, cortes), aniosImp);

  const marcasImp = getRankingMarcas("importacion", f);

  const mesMax: Record<number, number> = {};
  for (const a of cobertura.matriculacion.anios) {
    mesMax[a] = a === cobertura.matriculacion.ultimo?.anio ? cobertura.matriculacion.ultimo.mes : 12;
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        titulo="Inicio"
        descripcion={`Mercado automotor paraguayo · ${periodo} vs. mismo período ${f.anio - 1}.`}
        fuente={`Fuente: CADAM / DNRA · snapshot ${cobertura.snapshot}.`}
      />

      <FiltroPeriodo
        anios={cobertura.matriculacion.anios}
        mesMaximoPorAnio={mesMax}
        opciones={[
          { param: "segmento", label: "Segmento", valores: opciones.segmentos },
          { param: "tecnologia", label: "Tecnología", valores: [...TECNOLOGIAS] },
        ]}
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Matriculaciones acumuladas"
          value={formatUnidades(matric.valor)}
          variacion={matric.variacion}
          periodo={periodo}
          tooltip={`Contra el mismo período de ${f.anio - 1}: ${formatUnidades(matric.baseValor)} u.`}
        />
        <KpiCard
          label="Importaciones acumuladas"
          value={formatUnidades(importa.valor)}
          variacion={importa.variacion}
          periodo={`${periodo} · livianos`}
          tooltip="La base de importación de CADAM cubre vehículos livianos; camiones y ómnibus se reportan en un archivo aparte."
        />
        <KpiCard
          label="Marca líder"
          value={lider?.marca ?? "—"}
          periodo={lider ? `${formatUnidades(lider.unidades)} u. · ${formatPct(lider.participacion)}` : undefined}
          tooltip="Marca con más matriculaciones en el período filtrado."
        />
        <KpiCard
          label="Segmento líder"
          value={segLider?.valor ?? "—"}
          periodo={segLider ? `${formatUnidades(segLider.unidades)} u. · ${formatPct(segLider.participacion)}` : undefined}
          tooltip="Segmento con más matriculaciones. CADAM no clasifica el segmento antes de 2024."
        />
        <KpiCard
          label="Tecnología con mayor crecimiento"
          value={tecGanadora?.valor ?? "—"}
          variacion={tecGanadora?.variacion}
          periodo={tecGanadora ? `${formatUnidades(tecGanadora.unidades)} u.` : "sin base comparable"}
          tooltip="La tecnología (fuera de ICE) que más creció contra el año anterior, sobre una base mínima de 30 unidades."
        />
        <KpiCard
          label={varMesAnterior ? `Variación ${varMesAnterior.mes} vs. mes anterior` : "Variación vs. mes anterior"}
          value={varMesAnterior ? formatUnidades(varMesAnterior.valor) : "—"}
          variacion={varMesAnterior?.variacion}
          periodo={varMesAnterior ? `último mes del rango` : undefined}
          tooltip="Matriculaciones del último mes del rango contra el mes inmediatamente anterior."
        />
        <KpiCard
          label="Participación marcas propias"
          value={formatPct(propiasU / totalU)}
          periodo={`${formatUnidades(propiasU)} u.`}
          tooltip="JETOUR, GWM/GREAT WALL, JAC, Dongfeng, Soueast, Renault, Mitsubishi, Leapmotor, Zeekr y JMEV, sobre el total del período filtrado."
        />
        <KpiCard
          label="Diferencia import. − matric."
          value={formatUnidades(Math.abs(diferencia))}
          periodo={diferencia >= 0 ? "importación por encima" : "matriculación por encima"}
          tooltip="Señal orientativa, no stock real. El detalle está en la sección Import. vs matric."
        />
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Evolución mensual — matriculaciones</CardTitle>
          </CardHeader>
          <CardContent>
            <SerieAniosChart series={serieMat} />
            {cobertura.mesesFaltantes.matriculacion.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Meses sin dato quedan como hueco, no como cero
                {" "}(faltante en el origen: {cobertura.mesesFaltantes.matriculacion.join(", ")}).
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Evolución mensual — importaciones</CardTitle>
          </CardHeader>
          <CardContent>
            {serieImp.length ? (
              <SerieAniosChart series={serieImp} />
            ) : (
              <p className="py-16 text-center text-sm text-muted-foreground">
                Sin datos de importación para estos años con este filtro.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Matriculaciones por segmento</CardTitle>
          </CardHeader>
          <CardContent>
            <BarrasFiltroChart
              datos={segmentos.map((s) => ({ nombre: s.valor, valor: s.unidades }))}
              param="segmento"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Hacé clic en una barra para filtrar toda la página por ese segmento;
              otro clic lo quita.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Importaciones por segmento</CardTitle>
          </CardHeader>
          <CardContent>
            <BarrasFiltroChart
              datos={tiposImportacion.map((s) => ({ nombre: s.valor, valor: s.unidades }))}
              param="segmento"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Mismo filtro que el gráfico de matriculaciones: los segmentos están
              unificados entre ambas fuentes.
            </p>
          </CardContent>
        </Card>
      </div>

      {f.anio < (cobertura.primerAnioConSegmento ?? 0) && (
        <NotaDato>
          CADAM no clasifica el segmento antes de {cobertura.primerAnioConSegmento}:
          en {f.anio} el corte por segmento aparece como <em>Sin clasificar</em>.
        </NotaDato>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Ranking de marcas</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="mat">
            <TabsList>
              <TabsTrigger value="mat">Matriculación ({marcas.length})</TabsTrigger>
              <TabsTrigger value="imp">Importación ({marcasImp.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="mat" className="mt-3">
              <TablaRanking
                filas={marcas}
                nombreArchivo={`inicio-marcas-matriculacion-${f.anio}`}
                notaVariacion={`Variación contra ${periodo.replace(String(f.anio), String(f.anio - 1))}.`}
              />
            </TabsContent>
            <TabsContent value="imp" className="mt-3">
              <TablaRanking
                filas={marcasImp}
                nombreArchivo={`inicio-marcas-importacion-${f.anio}`}
                notaVariacion={`Variación contra ${periodo.replace(String(f.anio), String(f.anio - 1))}.`}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
