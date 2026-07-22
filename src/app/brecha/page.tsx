import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { NotaDato, PageHeader } from "@/components/dashboard/page-header";
import { FiltroPeriodo } from "@/components/dashboard/filtro-periodo";
import { BrechaChart } from "@/components/charts/brecha-chart";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  getBrecha, getCobertura, getMarcasMatriculacionLivianos, getRankingMarcas,
} from "@/lib/cadam/mercado";
import { getMarcasPropiasSet } from "@/lib/cadam/config";
import { formatUnidades } from "@/lib/format";
import {
  etiquetaPeriodo, filtroDesdeUrl, mesCorto, type SearchParams,
} from "@/lib/periodo";

export default async function BrechaPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const cobertura = getCobertura();
  const f = filtroDesdeUrl(sp, cobertura.matriculacion.ultimo);
  const periodo = etiquetaPeriodo(f.anio, f.mesDesde, f.mesHasta);

  const serie = getBrecha([f.anio], f.marca)
    .filter((p) => p.mes >= f.mesDesde && p.mes <= f.mesHasta);

  const totImp = serie.reduce((s, p) => s + (p.importaciones ?? 0), 0);
  const totMat = serie.reduce((s, p) => s + (p.matriculaciones ?? 0), 0);
  const ratio = totImp ? totMat / totImp : null;

  // Brecha por marca: quien importa mas de lo que matricula y viceversa.
  //
  // La matriculacion se toma SIN camiones ni omnibus para que sea
  // comparable: la base de importacion es solo de livianos. Sin este
  // recorte aparecian marcas de camiones (JMC, IVECO) con 0 importaciones
  // y cientos de matriculaciones, que no es una brecha real sino dos
  // universos distintos.
  const imp = new Map(getRankingMarcas("importacion", f).map((r) => [r.marca, r.unidades]));
  const mat = getMarcasMatriculacionLivianos(f);
  const propias = getMarcasPropiasSet();
  const marcas = [...new Set([...imp.keys(), ...mat.keys()])]
    .map((m) => {
      const i = imp.get(m) ?? 0;
      const t = mat.get(m) ?? 0;
      return {
        marca: m, importaciones: i, matriculaciones: t, diferencia: i - t,
        ratio: i ? t / i : null, esPropia: propias.has(m),
      };
    })
    .filter((r) => r.importaciones + r.matriculaciones >= 20)
    .sort((a, b) => b.diferencia - a.diferencia);

  const masImporta = marcas.slice(0, 10);
  const masMatricula = [...marcas].reverse().slice(0, 10);

  const mesMax: Record<number, number> = {};
  for (const a of cobertura.matriculacion.anios) {
    mesMax[a] = a === cobertura.matriculacion.ultimo?.anio
      ? cobertura.matriculacion.ultimo.mes : 12;
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        titulo="Importaciones vs. matriculaciones"
        descripcion={`Brecha entre lo que entra al país y lo que se patenta · ${periodo}.`}
        fuente={`Fuente: CADAM / DNRA · snapshot ${cobertura.snapshot ?? "—"}.`}
      />

      <FiltroPeriodo anios={cobertura.matriculacion.anios} mesMaximoPorAnio={mesMax} />

      <NotaDato>
        <strong>Esto es una señal de análisis, no stock real.</strong> La
        diferencia entre importar y matricular no equivale a inventario: hay
        desfasajes temporales, unidades importadas en períodos anteriores,
        exportaciones y reexportaciones, registros tardíos y diferencias de
        clasificación entre ambas fuentes. Sirve para detectar un cambio de
        ritmo, no para afirmar cuántas unidades hay en playa.
      </NotaDato>

      <NotaDato>
        Se comparan <strong>solo vehículos livianos</strong>. La base de
        importación de CADAM no incluye camiones ni ómnibus (van en un archivo
        aparte), así que la matriculación se toma sin esos segmentos. Sin este
        recorte la brecha se inflaba con 1.509 unidades de pesados y aparecían
        marcas de camiones con cero importaciones y cientos de matriculaciones.
      </NotaDato>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Importaciones" value={formatUnidades(totImp)} periodo={periodo}
          tooltip="Unidades importadas en el período filtrado." />
        <KpiCard label="Matriculaciones" value={formatUnidades(totMat)} periodo={periodo}
          tooltip="Unidades patentadas en el período filtrado." />
        <KpiCard
          label="Diferencia"
          value={formatUnidades(Math.abs(totImp - totMat))}
          periodo={totImp >= totMat ? "entró más de lo que se patentó" : "se patentó más de lo que entró"}
          tooltip="Diferencia absoluta del período. Orientativa: ver la nota de arriba."
        />
        <KpiCard
          label="Relación matric. / import."
          value={ratio === null ? "—" : ratio.toFixed(2)}
          periodo={ratio === null ? undefined
            : ratio > 1 ? "se patenta más de lo que entra" : "se patenta menos de lo que entra"}
          tooltip="Por cada unidad importada, cuántas se patentaron. Sostenido por debajo de 1 sugiere acumulación; por encima de 1, salida de inventario previo."
        />
      </section>

      <Card>
        <CardHeader><CardTitle>Evolución de la brecha — {f.anio}</CardTitle></CardHeader>
        <CardContent>
          <BrechaChart
            meses={serie.map((p) => mesCorto(p.mes))}
            importaciones={serie.map((p) => p.importaciones)}
            matriculaciones={serie.map((p) => p.matriculaciones)}
            diferencia={serie.map((p) => p.diferencia)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Detalle mensual</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mes</TableHead>
                <TableHead className="text-right">Importaciones</TableHead>
                <TableHead className="text-right">Matriculaciones</TableHead>
                <TableHead className="text-right">Diferencia</TableHead>
                <TableHead className="text-right">Matric. / import.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {serie.map((p) => (
                <TableRow key={p.mes}>
                  <TableCell className="font-medium">{mesCorto(p.mes)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {p.importaciones === null
                      ? <span className="text-muted-foreground">sin dato</span>
                      : formatUnidades(p.importaciones)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {p.matriculaciones === null
                      ? <span className="text-muted-foreground">sin dato</span>
                      : formatUnidades(p.matriculaciones)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {p.diferencia === null ? "—" :
                      `${p.diferencia > 0 ? "+" : ""}${formatUnidades(p.diferencia)}`}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {p.ratio === null ? "—" : p.ratio.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <TablaBrechaMarcas
          titulo="Importan más de lo que matriculan"
          subtitulo="Podría indicar acumulación de inventario"
          filas={masImporta}
        />
        <TablaBrechaMarcas
          titulo="Matriculan más de lo que importan"
          subtitulo="Podría indicar salida de inventario previo"
          filas={masMatricula}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        Se excluyen las marcas con menos de 20 unidades sumando ambas fuentes:
        con bases tan chicas la brecha no dice nada.
      </p>
    </div>
  );
}

function TablaBrechaMarcas({
  titulo, subtitulo, filas,
}: {
  titulo: string;
  subtitulo: string;
  filas: { marca: string; importaciones: number; matriculaciones: number; diferencia: number; ratio: number | null; esPropia: boolean }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{titulo}</CardTitle>
        <p className="text-xs text-muted-foreground">{subtitulo}</p>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Marca</TableHead>
              <TableHead className="text-right">Import.</TableHead>
              <TableHead className="text-right">Matric.</TableHead>
              <TableHead className="text-right">Dif.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filas.map((r) => (
              <TableRow key={r.marca} className={r.esPropia ? "bg-primary/5" : undefined}>
                <TableCell className="font-medium">
                  <span className="inline-flex items-center gap-2">
                    {r.marca}
                    {r.esPropia && <Badge className="h-5 px-1.5 text-[10px]">propia</Badge>}
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatUnidades(r.importaciones)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatUnidades(r.matriculaciones)}</TableCell>
                <TableCell className="text-right tabular-nums font-medium">
                  {r.diferencia > 0 ? "+" : ""}{formatUnidades(r.diferencia)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
