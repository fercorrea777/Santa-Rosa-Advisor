import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NotaDato, PageHeader } from "@/components/dashboard/page-header";
import { FiltroPeriodo } from "@/components/dashboard/filtro-periodo";
import { TablaRanking } from "@/components/dashboard/tabla-ranking";
import { SerieAniosChart } from "@/components/charts/serie-anios-chart";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  getCobertura, getPorDimension, getRankingMarcas, getRankingModelos,
  getSerieMensual, GRUPO_TECNOLOGIA, TECNOLOGIAS,
} from "@/lib/cadam/mercado";
import { getMarcasPropiasSet } from "@/lib/cadam/config";
import { serieAAnios } from "@/lib/serie";
import { formatPct, formatPuntosPct, formatUnidades } from "@/lib/format";
import { etiquetaPeriodo, filtroDesdeUrl, type SearchParams } from "@/lib/periodo";

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
  const totalTec = tecnologias.reduce((s, t) => s + t.unidades, 0) || 1;

  const mesMax: Record<number, number> = {};
  for (const a of anios) {
    mesMax[a] = a === cobertura.matriculacion.ultimo?.anio ? cobertura.matriculacion.ultimo.mes : 12;
  }

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

      <Card>
        <CardHeader>
          <CardTitle>
            Ranking por tecnología — matriculaciones
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
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
                <TableRow key={t.valor} className={t.valor === seleccionada ? "bg-primary/5" : undefined}>
                  <TableCell className="font-medium">{t.valor}</TableCell>
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

          <div className="mt-4 flex flex-wrap gap-2">
            {[...grupos.entries()].map(([g, u]) => (
              <span key={g} className="rounded-md border px-2.5 py-1 text-xs">
                <span className="font-medium">{g}</span>{" "}
                <span className="tabular-nums text-muted-foreground">
                  {formatUnidades(u)} u. · {formatPct(u / totalTec)}
                </span>
              </span>
            ))}
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

          <div className="grid gap-4 xl:grid-cols-2">
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
          Elegí una tecnología en el filtro para ver su evolución histórica y sus
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
    </div>
  );
}
