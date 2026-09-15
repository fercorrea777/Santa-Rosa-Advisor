import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NotaDato, PageHeader } from "@/components/dashboard/page-header";
import { Pagina } from "@/components/movimiento/pagina";
import { SerieAniosChart, type SerieAnio } from "@/components/charts/serie-anios-chart";
import { SelectorAnios } from "@/components/dashboard/selector-anios";
import { SelectorFuente, type FuenteVista } from "@/components/dashboard/selector-fuente";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { getCobertura, getSerieMensual, type Fuente } from "@/lib/cadam/mercado";
import { serieAAnios, promedioMensual, proyeccionCierre } from "@/lib/serie";
import { formatPct, formatUnidades } from "@/lib/format";
import { mesCorto, type SearchParams, etiquetaCortes } from "@/lib/periodo";

export default async function EvolucionPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const cobertura = getCobertura();

  // Tres vistas (Croman, 15/09/2026: "el mismo selector en Evolución
  // mensual"). Con "Ambas", cada año lleva dos líneas: matriculación
  // llena e importación punteada, y los indicadores van en una tarjeta por
  // fuente. Por defecto dos años en vez de tres, que con seis líneas el
  // gráfico deja de leerse.
  const vista: FuenteVista =
    sp.fuente === "importacion" ? "importacion" : sp.fuente === "ambas" ? "ambas" : "matriculacion";
  const fuentes: Fuente[] = vista === "ambas" ? ["matriculacion", "importacion"] : [vista];
  const fuente: Fuente = fuentes[0];
  const disponibles = [...new Set(fuentes.flatMap((x) => cobertura[x].anios))].sort((a, b) => a - b);
  const pedidos = String(sp.anios ?? "")
    .split(",").map(Number).filter((a) => disponibles.includes(a));
  // Por defecto los ultimos 3 anios con datos (2 con las dos fuentes).
  const anios = pedidos.length ? pedidos.sort((a, b) => a - b) : disponibles.slice(vista === "ambas" ? -2 : -3);

  const ultMat = cobertura.matriculacion.ultimo;
  const ultImp = cobertura.importacion.ultimo;
  const desparejas = !!ultMat && !!ultImp && (ultMat.anio !== ultImp.anio || ultMat.mes !== ultImp.mes);
  const aclaracion = desparejas && ultMat && ultImp
    ? `Matriculaciones hasta ${mesCorto(ultMat.mes)} · importaciones hasta ${mesCorto(ultImp.mes)}: CADAM ya publicó la importación de ${mesCorto(ultImp.mes)}, la matriculación de ese mes todavía no.`
    : undefined;

  // Rango de meses: se aplica a TODOS los anios elegidos. Es lo que
  // permite comparar acumulados equivalentes (Ene-Jun de cada ano) en vez
  // de un ano parcial contra otros completos.
  const nMes = (v: string | string[] | undefined, def: number) => {
    const s = Array.isArray(v) ? v[0] : v;
    const n = Number(s);
    return Number.isFinite(n) && n >= 1 && n <= 12 ? n : def;
  };
  const mesDesde = nMes(sp.desde, 1);
  const mesHasta = Math.max(mesDesde, nMes(sp.hasta, 12));
  const anioCompleto = mesDesde === 1 && mesHasta === 12;
  const nombre: Record<Fuente, string> = { matriculacion: "matriculaciones", importacion: "importaciones" };
  const etiquetaFuente = vista === "ambas" ? "matriculaciones e importaciones" : nombre[fuente];
  const etiquetaRango = anioCompleto
    ? "año completo"
    : `${mesCorto(mesDesde)}–${mesCorto(mesHasta)}`;

  // Se recorta despues de armar las 12 posiciones: asi los meses fuera
  // del rango quedan en null (hueco), no desplazan el eje.
  const recortar = (s: SerieAnio): SerieAnio => ({
    ...s,
    valores: s.valores.map((v, i) => (i + 1 >= mesDesde && i + 1 <= mesHasta ? v : null)),
  });
  const porFuente = fuentes.map((x) => {
    const completas = serieAAnios(getSerieMensual(x, anios), anios);
    return { fuente: x, completas, series: completas.map(recortar) };
  });
  // Lo que dibuja el gráfico: con una fuente, una línea por año; con las
  // dos, la importación va punteada y rotulada para que se distinga de la
  // matriculación del mismo año.
  const seriesGrafico: SerieAnio[] =
    vista === "ambas"
      ? porFuente.flatMap((pf) =>
          pf.series.map((s) => ({
            ...s,
            anio: `${s.anio} ${pf.fuente === "importacion" ? "imp." : "mat."}`,
            punteada: pf.fuente === "importacion",
          }))
        )
      : porFuente[0].series;

  return (
    <Pagina>
      <PageHeader
        titulo="Evolución mensual"
        descripcion={`${etiquetaFuente[0].toUpperCase()}${etiquetaFuente.slice(1)} mes a mes entre años · ${etiquetaRango}. Acumulado, promedio, máximo, mínimo y proyección de cierre.`}
        fuente={`Fuente: CADAM / DNRA · ${etiquetaCortes(cobertura)}.`}
      />

      <div
        data-revelar=""
        className="-mx-1 flex flex-col gap-3 rounded-xl px-1 py-1 sm:sticky sm:top-16 sm:z-30 sm:flex-row sm:flex-wrap sm:items-start sm:bg-background/85 sm:backdrop-blur-md"
      >
        <SelectorFuente fuente={vista} porDefecto="matriculacion" conAmbas aclaracion={aclaracion} />
        <div className="min-w-0 sm:flex-1">
          <SelectorAnios
            aniosDisponibles={disponibles}
            aniosSeleccionados={anios}
            mesDesde={mesDesde}
            mesHasta={mesHasta}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {vista === "ambas"
              ? "Matriculaciones e importaciones por mes"
              : fuente === "matriculacion" ? "Matriculaciones por mes" : "Importaciones por mes"}
            {!anioCompleto && ` — ${etiquetaRango}`}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Una línea por año, mes contra mes: sirve para ver la estacionalidad
            del mercado y comparar el mismo mes entre años, no para leer el
            total.
            {vista === "ambas" ? " Matriculación en línea llena, importación punteada; el hueco entre las dos del mismo año es stock que entró y todavía no sacó chapa." : ""}
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <SerieAniosChart series={seriesGrafico} altura={340} />
          <NotaDato>
            Un mes sin información queda como <strong>hueco</strong> en la línea, no
            como cero: la línea no se une por encima del vacío.
            {fuentes.map((x) =>
              cobertura.mesesFaltantes[x].length > 0 ? (
                <span key={x}> Faltante detectado en {nombre[x]}: {cobertura.mesesFaltantes[x].join(", ")}.</span>
              ) : null
            )}
          </NotaDato>
        </CardContent>
      </Card>

      {porFuente.map(({ fuente: x, completas, series }) => (
      <Card key={x}>
        <CardHeader>
          <CardTitle>
            Indicadores por año — {nombre[x]}, {etiquetaRango}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {anioCompleto
              ? "Acumulado y promedios sobre los 12 meses de cada año."
              : `Acumulado, promedio, máximo y mínimo calculados solo sobre ${etiquetaRango} de cada año, para que la comparación sea equivalente.`}
          </p>
        </CardHeader>
        <CardContent>
          {(() => {
            // Se calcula una sola vez por fila y se reusa en las dos vistas
            // (tarjetas en mobile, tabla en desktop) — nada se duplica.
            const filas = series.map((s, i) => {
              const con = s.valores.filter((v): v is number => v !== null);
              const acum = con.reduce((a, b) => a + b, 0);
              const prom = promedioMensual(s.valores);
              const maxIdx = s.valores.indexOf(Math.max(...con));
              const minIdx = s.valores.indexOf(Math.min(...con));
              const prev = series[i - 1];
              // Comparacion YTD honesta: solo los meses que existen en
              // AMBOS anios, si no un ano parcial parece una caida.
              let varYtd: number | null = null;
              if (prev) {
                let a = 0, b = 0;
                for (let m = 0; m < 12; m++) {
                  const va = s.valores[m], vb = prev.valores[m];
                  if (va !== null && vb !== null) { a += va; b += vb; }
                }
                varYtd = b ? (a - b) / b : null;
              }
              // La proyeccion se calcula SIEMPRE sobre el ano entero, no
              // sobre el rango: proyectar el cierre de ano a partir de un
              // recorte de meses no significa nada. Con un rango parcial
              // activo directamente no se muestra.
              const proy = anioCompleto
                ? proyeccionCierre(completas[i].valores)
                : null;
              return { anio: s.anio, con, acum, prom, maxIdx, minIdx, varYtd, proy };
            });

            return (
              <>
                <div className="flex flex-col divide-y sm:hidden">
                  {filas.map((f) => (
                    <div key={f.anio} className="flex flex-col gap-1.5 py-3">
                      <div className="flex items-baseline justify-between">
                        <span className="font-medium">{f.anio}</span>
                        <span className="font-mono text-lg font-semibold tabular-nums">
                          {formatUnidades(f.acum)}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        <span>{f.con.length} meses con dato</span>
                        <span>
                          prom. {f.prom === null ? "—" : formatUnidades(Math.round(f.prom))}
                        </span>
                        {f.varYtd !== null && (
                          <span className={f.varYtd >= 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-600 dark:text-rose-400"}>
                            {formatPct(f.varYtd, { signed: true })} vs. año previo
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        {f.con.length > 0 && (
                          <>
                            <span>
                              máx. {formatUnidades(Math.max(...f.con))} ({mesCorto(f.maxIdx + 1)})
                            </span>
                            <span>
                              mín. {formatUnidades(Math.min(...f.con))} ({mesCorto(f.minIdx + 1)})
                            </span>
                          </>
                        )}
                        {f.proy && <span>proy. cierre {formatUnidades(f.proy.proyectado)}</span>}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="hidden overflow-x-auto sm:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Año</TableHead>
                        <TableHead className="text-right" nota="meses del año ya cargados">Meses con dato</TableHead>
                        <TableHead className="text-right" nota="todo lo del año, sumado">Acumulado</TableHead>
                        <TableHead className="text-right" nota="acumulado ÷ meses con dato">Promedio mensual</TableHead>
                        <TableHead className="text-right" nota="el mejor mes del año">Máximo</TableHead>
                        <TableHead className="text-right" nota="el peor mes del año">Mínimo</TableHead>
                        <TableHead className="text-right" nota="contra los mismos meses del año previo">Var. vs año previo</TableHead>
                        <TableHead className="text-right" nota="cómo cerraría el año a este ritmo">Proyección cierre</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {/* Los numeros van a 15px y con peso: son lo que Fer
                          viene a leer. El acumulado es LA cifra de la fila y
                          lleva semibold; la variacion usa el mismo par
                          esmeralda/rosa que ya usan las tarjetas moviles de
                          arriba (el signo ya viene en el texto, el color solo
                          refuerza). "Meses con dato" queda apagado a proposito:
                          es contexto, no dato. */}
                      {filas.map((f) => (
                        <TableRow key={f.anio}>
                          <TableCell className="text-[15px] font-semibold">{f.anio}</TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {f.con.length}
                          </TableCell>
                          <TableCell className="text-right text-[15px] font-semibold tabular-nums">
                            {formatUnidades(f.acum)}
                          </TableCell>
                          <TableCell className="text-right text-[15px] font-medium tabular-nums">
                            {f.prom === null ? "—" : formatUnidades(Math.round(f.prom))}
                          </TableCell>
                          <TableCell className="text-right text-[15px] font-medium tabular-nums">
                            {f.con.length ? `${formatUnidades(Math.max(...f.con))} (${mesCorto(f.maxIdx + 1)})` : "—"}
                          </TableCell>
                          <TableCell className="text-right text-[15px] font-medium tabular-nums">
                            {f.con.length ? `${formatUnidades(Math.min(...f.con))} (${mesCorto(f.minIdx + 1)})` : "—"}
                          </TableCell>
                          <TableCell
                            className={
                              "text-right text-[15px] font-medium tabular-nums " +
                              (f.varYtd === null
                                ? ""
                                : f.varYtd >= 0
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-rose-600 dark:text-rose-400")
                            }
                          >
                            {f.varYtd === null ? "—" : formatPct(f.varYtd, { signed: true })}
                          </TableCell>
                          <TableCell className="text-right text-[15px] font-medium tabular-nums">
                            {f.proy ? formatUnidades(f.proy.proyectado) : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            );
          })()}
          <div className="mt-3 flex flex-col gap-2">
            <NotaDato>
              <strong>Var. vs año previo</strong> compara solo los meses presentes en
              ambos años. Un año parcial contra uno completo daría una caída falsa.
            </NotaDato>
            <NotaDato>
              La <strong>proyección de cierre</strong> es deliberadamente simple
              (acumulado + promedio de los meses con dato × meses restantes) y{" "}
              <strong>no modela estacionalidad</strong>. El mercado paraguayo la
              tiene y es fuerte: mayo 2026 cerró en 8.219 matriculaciones y junio en
              3.812. No usarla para comprometer objetivos.
              {!anioCompleto && (
                <> Con un rango de meses aplicado no se muestra: proyectar el
                cierre del año a partir de un recorte no significa nada.</>
              )}
            </NotaDato>
          </div>
        </CardContent>
      </Card>
      ))}
    </Pagina>
  );
}
