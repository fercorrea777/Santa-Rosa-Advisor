import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NotaDato, PageHeader } from "@/components/dashboard/page-header";
import { Pagina } from "@/components/movimiento/pagina";
import { FiltroPeriodo } from "@/components/dashboard/filtro-periodo";
import { SelectorFuente, type FuenteVista } from "@/components/dashboard/selector-fuente";
import { TablaRanking } from "@/components/dashboard/tabla-ranking";
import { SerieAniosChart } from "@/components/charts/serie-anios-chart";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  getCobertura, getPorDimension, getRankingMarcas, getRankingModelos,
  getSerieMensual, SEGMENTO_SIN_CLASIFICAR, type FilaDimension, type Fuente,
} from "@/lib/cadam/mercado";
import { getMarcasPropiasSet } from "@/lib/cadam/config";
import { serieAAnios } from "@/lib/serie";
import { formatPct, formatPuntosPct, formatUnidades } from "@/lib/format";
import {
  etiquetaCortes, etiquetaPeriodo, filtroDesdeUrl, mesCorto, type SearchParams,
} from "@/lib/periodo";

const NOMBRE: Record<Fuente, string> = { matriculacion: "matriculaciones", importacion: "importaciones" };

export default async function SegmentosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const cobertura = getCobertura();
  // Tres vistas, como en Portafolio (Croman, 15/09/2026): la fuente
  // PRINCIPAL define el ranking, las unidades y el detalle; con "Ambas", la
  // otra va como columna al lado, cada una hasta su propio último mes.
  const vista: FuenteVista =
    sp.fuente === "importacion" ? "importacion" : sp.fuente === "matriculacion" ? "matriculacion" : "ambas";
  const principal: Fuente = vista === "importacion" ? "importacion" : "matriculacion";
  const secundaria: Fuente | null =
    vista === "ambas" ? "importacion" : vista === "importacion" ? "matriculacion" : null;

  const f = filtroDesdeUrl(sp, cobertura[principal].ultimo);
  const propias = getMarcasPropiasSet();

  const ventanaDe = (fuente: Fuente) => {
    const ult = cobertura[fuente].ultimo;
    if (!ult || f.anio !== ult.anio) return f;
    if (sp.hasta) return f.mesHasta > ult.mes ? { ...f, mesHasta: Math.max(f.mesDesde, ult.mes) } : f;
    return { ...f, mesHasta: Math.max(f.mesDesde, ult.mes) };
  };
  const fPrin = ventanaDe(principal);
  const fSec = secundaria ? ventanaDe(secundaria) : null;
  const periodo = etiquetaPeriodo(fPrin.anio, fPrin.mesDesde, fPrin.mesHasta);
  const periodoSec = fSec ? etiquetaPeriodo(fSec.anio, fSec.mesDesde, fSec.mesHasta) : "";

  const ultMat = cobertura.matriculacion.ultimo;
  const ultImp = cobertura.importacion.ultimo;
  const desparejas = !!ultMat && !!ultImp && (ultMat.anio !== ultImp.anio || ultMat.mes !== ultImp.mes);
  const aclaracion = desparejas && ultMat && ultImp
    ? `Matriculaciones hasta ${mesCorto(ultMat.mes)} · importaciones hasta ${mesCorto(ultImp.mes)}: CADAM ya publicó la importación de ${mesCorto(ultImp.mes)}, la matriculación de ese mes todavía no.`
    : undefined;

  const segmentos = getPorDimension(principal, "segmento", fPrin);
  const otros: Map<string, FilaDimension> = new Map(
    secundaria && fSec ? getPorDimension(secundaria, "segmento", fSec).map((s) => [s.valor, s]) : []
  );
  const seleccionado = f.segmento;

  // Participacion de marcas propias dentro de cada segmento (fuente principal).
  const propiasPorSegmento = new Map<string, number>();
  for (const s of segmentos) {
    const marcas = getRankingMarcas(principal, { ...fPrin, segmento: s.valor });
    const propiasU = marcas.filter((m) => propias.has(m.marca))
      .reduce((acc, m) => acc + m.unidades, 0);
    propiasPorSegmento.set(s.valor, s.unidades ? propiasU / s.unidades : 0);
  }

  const mesMax: Record<number, number> = {};
  for (const a of cobertura[principal].anios) {
    mesMax[a] = a === cobertura[principal].ultimo?.anio ? cobertura[principal].ultimo.mes : 12;
  }

  // Drill-down: al elegir un segmento se muestran sus marcas y modelos.
  const aniosSerie = [f.anio - 1, f.anio].filter((a) => cobertura[principal].anios.includes(a));
  const serie = seleccionado
    ? serieAAnios(getSerieMensual(principal, aniosSerie, { segmento: seleccionado }), aniosSerie)
    : [];
  const marcasSeg = seleccionado ? getRankingMarcas(principal, fPrin) : [];
  const modelosSeg = seleccionado ? getRankingModelos(principal, fPrin, 100) : [];

  // El enlace conserva lo que ya está en la URL y solo pone el segmento:
  // fijar acá el "hasta" recortaría la columna de la otra fuente a la
  // ventana de la principal en la vista "Ambas".
  const enlace = (segmento: string) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      const val = Array.isArray(v) ? v[0] : v;
      if (val) q.set(k, val);
    }
    q.set("segmento", segmento);
    return `/segmentos?${q.toString()}`;
  };
  const rotuloUnidades = principal === "importacion" ? "importadas en el período" : "matriculadas en el período";

  return (
    <Pagina>
      <PageHeader
        titulo="Segmentos"
        descripcion={`Participación, evolución y liderazgo por segmento sobre ${NOMBRE[principal]} · ${periodo}${secundaria ? ` · ${NOMBRE[secundaria]} ${periodoSec} al lado` : ""}.`}
        fuente={`Fuente: CADAM / DNRA · ${etiquetaCortes(cobertura)}.`}
      />

      <div
        data-revelar=""
        className="-mx-1 flex flex-col gap-3 rounded-xl px-1 py-1 sm:sticky sm:top-16 sm:z-30 sm:flex-row sm:flex-wrap sm:items-start sm:bg-background/85 sm:backdrop-blur-md"
      >
        <SelectorFuente porDefecto="ambas" fuente={vista} conAmbas aclaracion={aclaracion} />
        <div className="min-w-0 sm:flex-1">
          <FiltroPeriodo
            pegajoso={false}
            anios={cobertura[principal].anios}
            mesMaximoPorAnio={mesMax}
            opciones={[{
              param: "segmento", label: "Segmento",
              valores: segmentos.map((s) => s.valor),
            }]}
          />
        </div>
      </div>

      {cobertura.primerAnioConSegmento !== null &&
        f.anio < cobertura.primerAnioConSegmento && (
        <NotaDato>
          CADAM no clasifica el segmento antes de {cobertura.primerAnioConSegmento}:
          en {f.anio} todas las unidades vienen como <em>Sin clasificar</em>. El
          análisis por segmento arranca en {cobertura.primerAnioConSegmento}.
        </NotaDato>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            Ranking de segmentos — {NOMBRE[principal]} · {periodo}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Qué tipo de vehículo {principal === "importacion" ? "entra al país" : "compra el paraguayo"} y cuánto de cada uno es
            nuestro. Tocá un segmento y la pantalla se abre en ese: su
            evolución, sus marcas y sus modelos.
            {secundaria ? ` La columna de ${NOMBRE[secundaria]} (${periodoSec}) va al lado para comparar de un vistazo.` : ""}
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col divide-y sm:hidden">
            {segmentos.map((s, i) => (
              <Link
                key={s.valor}
                href={enlace(s.valor)}
                className={cn(
                  "flex flex-col gap-1.5 py-3",
                  s.valor === seleccionado && "-mx-3 rounded-md bg-primary/5 px-3"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {i + 1}
                    </span>
                    <span className="min-w-0 truncate font-medium">{s.valor}</span>
                    {s.valor === SEGMENTO_SIN_CLASIFICAR && (
                      <Badge variant="outline" className="h-5 shrink-0 px-1.5 text-[10px] font-normal">
                        sin dato de origen
                      </Badge>
                    )}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums">
                    {s.variacion === null ? "—" : formatPct(s.variacion, { signed: true })}
                  </span>
                </div>
                <div className="flex items-baseline justify-between pl-6">
                  <span className="font-mono text-lg font-semibold tabular-nums">
                    {formatUnidades(s.unidades)}
                  </span>
                  <span className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="tabular-nums">{formatPct(s.participacion)}</span>
                    <span className="tabular-nums">
                      Δ {s.deltaParticipacion === null ? "—" : formatPuntosPct(s.deltaParticipacion)}
                    </span>
                  </span>
                </div>
                <div className="pl-6 text-xs text-muted-foreground">
                  Marcas propias: {formatPct(propiasPorSegmento.get(s.valor) ?? 0)}
                  {secundaria && (
                    <>
                      {" · "}{NOMBRE[secundaria]} {periodoSec}:{" "}
                      {otros.has(s.valor)
                        ? `${formatUnidades(otros.get(s.valor)!.unidades)} (${formatPct(otros.get(s.valor)!.participacion)})`
                        : "—"}
                    </>
                  )}
                </div>
              </Link>
            ))}
          </div>
          <div className="hidden overflow-x-auto sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Segmento</TableHead>
                  <TableHead className="text-right" nota={rotuloUnidades}>Unidades</TableHead>
                  <TableHead className="text-right" nota="su parte del mercado">Participación</TableHead>
                  <TableHead className="text-right" nota="cuánto creció o cayó el segmento">Var. vs {f.anio - 1}</TableHead>
                  <TableHead className="text-right" nota="puntos que ganó o perdió">Δ participación</TableHead>
                  {secundaria && (
                    <>
                      <TableHead className="text-right" nota={`${NOMBRE[secundaria]} · ${periodoSec}`}>
                        {secundaria === "importacion" ? "Import." : "Matric."}
                      </TableHead>
                      <TableHead className="text-right" nota={`su parte en ${NOMBRE[secundaria]}`}>Part.</TableHead>
                    </>
                  )}
                  <TableHead className="text-right" nota="cuánto de ese segmento es nuestro">Marcas propias</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {segmentos.map((s, i) => {
                  const o = otros.get(s.valor);
                  return (
                    <TableRow key={s.valor} className={s.valor === seleccionado ? "bg-primary/5" : undefined}>
                      <TableCell className="tabular-nums text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium">
                        <Link href={enlace(s.valor)} className="hover:underline">
                          {s.valor}
                        </Link>
                        {s.valor === SEGMENTO_SIN_CLASIFICAR && (
                          <Badge variant="outline" className="ml-2 h-5 px-1.5 text-[10px] font-normal">
                            sin dato de origen
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatUnidades(s.unidades)}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {formatPct(s.participacion)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {s.variacion === null ? "—" : formatPct(s.variacion, { signed: true })}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {s.deltaParticipacion === null ? "—" : formatPuntosPct(s.deltaParticipacion)}
                      </TableCell>
                      {secundaria && (
                        <>
                          <TableCell className="text-right tabular-nums">
                            {o ? formatUnidades(o.unidades) : "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {o ? formatPct(o.participacion) : "—"}
                          </TableCell>
                        </>
                      )}
                      <TableCell className="text-right tabular-nums">
                        {formatPct(propiasPorSegmento.get(s.valor) ?? 0)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Hacé clic en un segmento para ver su evolución, marcas y modelos.
            <strong> Δ participación</strong> en puntos porcentuales: un segmento
            puede crecer en unidades y perder participación.
          </p>
        </CardContent>
      </Card>

      {seleccionado && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>
                Evolución mensual — {seleccionado}, {NOMBRE[principal]}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Una línea por año: dice si el segmento está creciendo o si solo
                se movió con el mercado.
              </p>
            </CardHeader>
            <CardContent><SerieAniosChart series={serie} /></CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Marcas líderes en {seleccionado} · {NOMBRE[principal]}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Contra quién se compite en ese segmento. Las marcas propias van
                  resaltadas.
                </p>
              </CardHeader>
              <CardContent>
                <TablaRanking filas={marcasSeg} nombreArchivo={`segmento-${seleccionado}-marcas-${principal}`} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Modelos líderes en {seleccionado} · {NOMBRE[principal]}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Los modelos concretos que se llevan el segmento: es el nivel al
                  que el cliente elige.
                </p>
              </CardHeader>
              <CardContent>
                <TablaRanking filas={modelosSeg} mostrarModelo
                  fuente={principal}
                  nombreArchivo={`segmento-${seleccionado}-modelos-${principal}`} />
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </Pagina>
  );
}
