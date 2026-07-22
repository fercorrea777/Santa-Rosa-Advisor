import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NotaDato, PageHeader } from "@/components/dashboard/page-header";
import { FiltroPeriodo } from "@/components/dashboard/filtro-periodo";
import { TablaRanking } from "@/components/dashboard/tabla-ranking";
import { SerieAniosChart } from "@/components/charts/serie-anios-chart";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  getCobertura, getPorDimension, getRankingMarcas, getRankingModelos,
  getSerieMensual, SEGMENTO_SIN_CLASIFICAR,
} from "@/lib/cadam/mercado";
import { getMarcasPropiasSet } from "@/lib/cadam/config";
import { serieAAnios } from "@/lib/serie";
import { formatPct, formatPuntosPct, formatUnidades } from "@/lib/format";
import { etiquetaPeriodo, filtroDesdeUrl, type SearchParams } from "@/lib/periodo";

export default async function SegmentosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const cobertura = getCobertura();
  const f = filtroDesdeUrl(sp, cobertura.matriculacion.ultimo);
  const periodo = etiquetaPeriodo(f.anio, f.mesDesde, f.mesHasta);
  const propias = getMarcasPropiasSet();

  const segmentos = getPorDimension("matriculacion", "segmento", f);
  const seleccionado = f.segmento;

  // Participacion de marcas propias dentro de cada segmento.
  const propiasPorSegmento = new Map<string, number>();
  for (const s of segmentos) {
    const marcas = getRankingMarcas("matriculacion", { ...f, segmento: s.valor });
    const propiasU = marcas.filter((m) => propias.has(m.marca))
      .reduce((acc, m) => acc + m.unidades, 0);
    propiasPorSegmento.set(s.valor, s.unidades ? propiasU / s.unidades : 0);
  }

  const mesMax: Record<number, number> = {};
  for (const a of cobertura.matriculacion.anios) {
    mesMax[a] = a === cobertura.matriculacion.ultimo?.anio ? cobertura.matriculacion.ultimo.mes : 12;
  }

  // Drill-down: al elegir un segmento se muestran sus marcas y modelos.
  const aniosSerie = [f.anio - 1, f.anio].filter((a) => cobertura.matriculacion.anios.includes(a));
  const serie = seleccionado
    ? serieAAnios(getSerieMensual("matriculacion", aniosSerie, { segmento: seleccionado }), aniosSerie)
    : [];
  const marcasSeg = seleccionado ? getRankingMarcas("matriculacion", f) : [];
  const modelosSeg = seleccionado ? getRankingModelos("matriculacion", f, 100) : [];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        titulo="Segmentos"
        descripcion={`Participación, evolución y liderazgo por segmento · ${periodo}.`}
        fuente={`Fuente: CADAM / DNRA · snapshot ${cobertura.snapshot ?? "—"}.`}
      />

      <FiltroPeriodo
        anios={cobertura.matriculacion.anios}
        mesMaximoPorAnio={mesMax}
        opciones={[{
          param: "segmento", label: "Segmento",
          valores: segmentos.map((s) => s.valor),
        }]}
      />

      {cobertura.primerAnioConSegmento !== null &&
        f.anio < cobertura.primerAnioConSegmento && (
        <NotaDato>
          CADAM no clasifica el segmento antes de {cobertura.primerAnioConSegmento}:
          en {f.anio} todas las unidades vienen como <em>Sin clasificar</em>. El
          análisis por segmento arranca en {cobertura.primerAnioConSegmento}.
        </NotaDato>
      )}

      <Card>
        <CardHeader><CardTitle className="text-sm">Ranking de segmentos</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Segmento</TableHead>
                <TableHead className="text-right">Unidades</TableHead>
                <TableHead className="text-right">Participación</TableHead>
                <TableHead className="text-right">Var. vs {f.anio - 1}</TableHead>
                <TableHead className="text-right">Δ participación</TableHead>
                <TableHead className="text-right">Marcas propias</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {segmentos.map((s, i) => (
                <TableRow key={s.valor} className={s.valor === seleccionado ? "bg-primary/5" : undefined}>
                  <TableCell className="tabular-nums text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="font-medium">
                    <Link
                      href={`/segmentos?anio=${f.anio}&desde=${f.mesDesde}&hasta=${f.mesHasta}&segmento=${encodeURIComponent(s.valor)}`}
                      className="hover:underline"
                    >
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
                  <TableCell className="text-right tabular-nums">
                    {formatPct(propiasPorSegmento.get(s.valor) ?? 0)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
              <CardTitle className="text-sm">Evolución mensual — {seleccionado}</CardTitle>
            </CardHeader>
            <CardContent><SerieAniosChart series={serie} /></CardContent>
          </Card>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Marcas líderes en {seleccionado}</CardTitle>
              </CardHeader>
              <CardContent>
                <TablaRanking filas={marcasSeg} nombreArchivo={`segmento-${seleccionado}-marcas`} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Modelos líderes en {seleccionado}</CardTitle>
              </CardHeader>
              <CardContent>
                <TablaRanking filas={modelosSeg} mostrarModelo
                  nombreArchivo={`segmento-${seleccionado}-modelos`} />
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
