import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { NotaDato, PageHeader } from "@/components/dashboard/page-header";
import { FiltroPeriodo } from "@/components/dashboard/filtro-periodo";
import { TablaRanking } from "@/components/dashboard/tabla-ranking";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SerieAniosChart } from "@/components/charts/serie-anios-chart";
import { DistribucionChart } from "@/components/charts/distribucion-chart";
import { SelectorFuente } from "@/components/dashboard/selector-fuente";
import {
  getCobertura, getKpi, getOpcionesFiltro, getPorDimension, getRankingMarcas,
  getRankingModelos, getRankingVersiones, getSerieMensual, type Fuente,
} from "@/lib/cadam/mercado";
import { getParametros } from "@/lib/cadam/config";
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

  // Fuente activa: manda sobre los cortes por dimension y el ranking.
  // Los KPIs de arriba siguen mostrando las dos, porque son el titular.
  const fuente: Fuente = sp.fuente === "importacion" ? "importacion" : "matriculacion";
  const esImportacion = fuente === "importacion";
  const etiquetaFuente = esImportacion ? "importaciones" : "matriculaciones";

  const opciones = getOpcionesFiltro();
  const segmentos = getPorDimension(fuente, "segmento", f);
  // La base de importacion no trae columna de tecnologia: ese corte solo
  // existe del lado de matriculacion (ver CADAM/DATOS.md).
  const tecnologias = esImportacion ? [] : getPorDimension("matriculacion", "tecnologia", f);
  const marcas = getRankingMarcas(fuente, f);
  const modelos = getRankingModelos(fuente, f);
  // Version solo existe en matriculacion: la base de importacion llega
  // hasta el modelo.
  const versiones = esImportacion ? [] : getRankingVersiones(f);

  const notaVar =
    ((esImportacion ? import_ : matric).baseDisponible
      ? `Variación contra ${periodo.replace(String(f.anio), String(f.anio - 1))}.`
      : `Sin datos de ${f.anio - 1} para comparar.`) +
    (f.segmento ? "" : " Incluye livianos y pesados: filtrá por segmento para separarlos.");

  // Ganadores y perdedores por variacion absoluta de unidades: es lo que
  // mueve el mercado. El % solo puede ser enorme sobre bases minimas.
  const conBase = marcas.filter((m) => m.unidadesAnterior > 0);
  // Participación de las marcas del grupo sobre el total del período. Sale de
  // `esPropia`, que ya viene en cada fila del ranking, así que sigue sola el
  // toggle matriculación/importación y todos los filtros de la página.
  const totalU = marcas.reduce((s, m) => s + m.unidades, 0);
  const propiasU = marcas.filter((m) => m.esPropia).reduce((s, m) => s + m.unidades, 0);
  // Sin datos en el filtro, totalU es 0: la división daría NaN.
  const participacionPropias = totalU > 0 ? propiasU / totalU : null;
  // La lista sale de parametros.json, no escrita a mano: el tooltip que había
  // en la home enumeraba 10 marcas y se había quedado sin HAVAL.
  const nombresPropias = getParametros()
    .marcas_propias.map((m) => m.marca_cadam)
    .join(", ");

  // Hasta 10 por panel, pero filtrando por signo: con tope 5 todas las marcas
  // listadas eran perdedoras de verdad; al subir a 10 la lista se rellenaba
  // con las menos-positivas y aparecían marcas EN ALZA bajo el título
  // "Principales perdedores" (DODGE +66.7%). Si hay menos de 10 con variación
  // real, el panel muestra menos filas — mejor corto que falso.
  const TOPE_PANEL = 10;
  const delta = (m: (typeof conBase)[number]) => m.unidades - m.unidadesAnterior;
  const ganadores = conBase
    .filter((m) => delta(m) > 0)
    .sort((a, b) => delta(b) - delta(a))
    .slice(0, TOPE_PANEL);
  const perdedores = conBase
    .filter((m) => delta(m) < 0)
    .sort((a, b) => delta(a) - delta(b))
    .slice(0, TOPE_PANEL);

  const mesMax: Record<number, number> = {};
  for (const a of cobertura.matriculacion.anios) {
    mesMax[a] = a === cobertura.matriculacion.ultimo?.anio ? cobertura.matriculacion.ultimo.mes : 12;
  }

  const diferencia = import_.valor - matric.valor;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        titulo="Resumen del mercado"
        descripcion={`Analizando ${etiquetaFuente} · ${periodo} vs. mismo período ${f.anio - 1}.`}
        fuente={`Fuente: CADAM / DNRA · snapshot ${cobertura.snapshot ?? "—"}.`}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <SelectorFuente fuente={fuente} />
        <div className="min-w-0 sm:flex-1">
          <FiltroPeriodo
            anios={cobertura.matriculacion.anios}
            mesMaximoPorAnio={mesMax}
            opciones={[
              { param: "segmento", label: "Segmento", valores: opciones.segmentos },
              ...(esImportacion
                ? []
                : [{
                    param: "tecnologia",
                    label: "Tecnología",
                    valores: ["ICE", "MHEV", "HEV", "PHEV", "REEV", "EV"],
                  }]),
            ]}
          />
        </div>
      </div>

      {/* 5 columnas en lg (era 4): con la tarjeta de marcas propias, un
          grid de 4 dejaba la quinta sola en una segunda fila. */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
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
          label={`Marca líder — ${etiquetaFuente}`}
          value={marcas[0]?.marca ?? "—"}
          periodo={marcas[0] ? `${formatUnidades(marcas[0].unidades)} u. · ${formatPct(marcas[0].participacion)}` : undefined}
          tooltip={`Marca con más ${etiquetaFuente} en el período filtrado.`}
        />
        <KpiCard
          label="Participación marcas propias"
          value={participacionPropias === null ? "—" : formatPct(participacionPropias)}
          periodo={participacionPropias === null ? undefined : `${formatUnidades(propiasU)} u.`}
          tooltip={`${nombresPropias}, sobre el total de ${etiquetaFuente} del período filtrado.`}
        />
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Evolución mensual — matriculaciones</CardTitle></CardHeader>
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
          <CardHeader><CardTitle>Evolución mensual — importaciones</CardTitle></CardHeader>
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
          <CardHeader>
            <CardTitle>
              Participación por segmento — {etiquetaFuente}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <DistribucionChart
              datos={segmentos.map((s) => ({ nombre: s.valor, valor: s.unidades }))}
              param="segmento"
            />
            <p className="text-xs text-muted-foreground">
              Hacé clic en una porción para filtrar toda la página por ese
              segmento; otro clic lo quita.
            </p>
            {segmentos.some((s) => s.valor === "Sin clasificar") && (
              <NotaDato>
                CADAM no clasifica el segmento antes de 2024. Las unidades sin
                segmento se muestran aparte, no se reparten entre los demás.
              </NotaDato>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {/* La tecnologia solo existe en matriculacion, asi que el
                  titulo la nombra siempre: aclara de donde sale el dato
                  aunque arriba este elegida la otra fuente. */}
              Participación por tecnología — matriculaciones
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {esImportacion ? (
              <>
                <p className="py-16 text-center text-sm text-muted-foreground">
                  Sin corte por tecnología para importaciones.
                </p>
                <NotaDato>
                  La base de importación de CADAM no trae columna de tecnología.
                  El detalle ICE/MHEV/HEV/PHEV/REEV/EV solo existe del lado de
                  matriculación.
                </NotaDato>
              </>
            ) : (
              <>
                <DistribucionChart
                  datos={tecnologias.map((t) => ({ nombre: t.valor, valor: t.unidades }))}
                  param="tecnologia"
                />
                <p className="text-xs text-muted-foreground">
                  Hacé clic en una porción para filtrar por esa tecnología.
                </p>
                <NotaDato>
                  Cada tecnología se muestra por separado: MHEV no es HEV, PHEV no es
                  HEV y REEV no es EV.
                </NotaDato>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MoviminetoCard
          titulo={`Principales ganadores — ${etiquetaFuente}`}
          filas={ganadores}
          positivo
          disponible={(esImportacion ? import_ : matric).baseDisponible}
        />
        <MoviminetoCard
          titulo={`Principales perdedores — ${etiquetaFuente}`}
          filas={perdedores}
          positivo={false}
          disponible={(esImportacion ? import_ : matric).baseDisponible}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Rankings — {etiquetaFuente}</CardTitle>
          <p className="text-xs text-muted-foreground">
            Hacé clic en una marca, modelo o versión para filtrar toda la
            página; otro clic lo quita. Los filtros se acumulan entre sí y con
            los de arriba.
          </p>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="marcas">
            <TabsList className="flex-wrap">
              <TabsTrigger value="marcas">Marcas ({marcas.length})</TabsTrigger>
              <TabsTrigger value="modelos">Modelos ({modelos.length})</TabsTrigger>
              <TabsTrigger value="versiones">
                Versiones {esImportacion ? "" : `(${versiones.length})`}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="marcas" className="mt-3">
              <TablaRanking
                filas={marcas}
                filtrarPor={{ marca: "marca" }}
                nombreArchivo={`ranking-marcas-${fuente}-${f.anio}`}
                notaVariacion={notaVar}
              />
            </TabsContent>

            <TabsContent value="modelos" className="mt-3">
              <TablaRanking
                filas={modelos}
                mostrarModelo
                mostrarSegmento
                etiquetaModelo="Modelo"
                filtrarPor={{ marca: "marca", detalle: "modelo" }}
                nombreArchivo={`ranking-modelos-${fuente}-${f.anio}`}
                notaVariacion={notaVar}
              />
            </TabsContent>

            <TabsContent value="versiones" className="mt-3">
              {esImportacion ? (
                <NotaDato>
                  La base de importación de CADAM llega hasta el modelo
                  (<code>HILUX</code>), no hasta la versión. El detalle por
                  versión solo existe del lado de matriculación.
                </NotaDato>
              ) : (
                <>
                  <TablaRanking
                    filas={versiones}
                    mostrarModelo
                    mostrarSegmento
                    etiquetaModelo="Versión"
                    filtrarPor={{ marca: "marca", detalle: "version" }}
                    nombreArchivo={`ranking-versiones-${f.anio}`}
                    notaVariacion={notaVar}
                  />
                  <div className="mt-3">
                    <NotaDato>
                      CADAM no publica un campo de versión: esto es el nombre tal
                      como lo carga la DNRA, que en la práctica incluye el
                      acabado y a veces el motor (<code>HILUX D/C 4X4 SRV AUT</code>).
                      No hay motor, transmisión ni tracción como campos aparte.
                    </NotaDato>
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>
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
      <CardHeader><CardTitle>{titulo}</CardTitle></CardHeader>
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
