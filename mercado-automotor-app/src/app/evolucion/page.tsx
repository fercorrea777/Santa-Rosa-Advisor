import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NotaDato, PageHeader } from "@/components/dashboard/page-header";
import { SerieAniosChart } from "@/components/charts/serie-anios-chart";
import { SelectorAnios } from "@/components/dashboard/selector-anios";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { getCobertura, getSerieMensual, type Fuente } from "@/lib/cadam/mercado";
import { serieAAnios, promedioMensual, proyeccionCierre } from "@/lib/serie";
import { formatPct, formatUnidades } from "@/lib/format";
import { mesCorto, type SearchParams } from "@/lib/periodo";

export default async function EvolucionPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const cobertura = getCobertura();

  const fuente: Fuente = sp.fuente === "importacion" ? "importacion" : "matriculacion";
  const disponibles = cobertura[fuente].anios;
  const pedidos = String(sp.anios ?? "")
    .split(",").map(Number).filter((a) => disponibles.includes(a));
  // Por defecto los ultimos 3 anios con datos.
  const anios = pedidos.length ? pedidos.sort((a, b) => a - b) : disponibles.slice(-3);

  const series = serieAAnios(getSerieMensual(fuente, anios), anios);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        titulo="Evolución mensual"
        descripcion="Comparación mes a mes entre años, con acumulado, promedio, máximo, mínimo y proyección de cierre."
        fuente={`Fuente: CADAM / DNRA · snapshot ${cobertura.snapshot ?? "—"}.`}
      />

      <SelectorAnios
        aniosDisponibles={disponibles}
        aniosSeleccionados={anios}
        fuente={fuente}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            {fuente === "matriculacion" ? "Matriculaciones" : "Importaciones"} por mes
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <SerieAniosChart series={series} altura={340} />
          <NotaDato>
            Un mes sin información queda como <strong>hueco</strong> en la línea, no
            como cero: la línea no se une por encima del vacío.
            {cobertura.mesesFaltantes[fuente].length > 0 && (
              <> Faltante detectado en el origen: {cobertura.mesesFaltantes[fuente].join(", ")}.</>
            )}
          </NotaDato>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Indicadores por año</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Año</TableHead>
                <TableHead className="text-right">Meses con dato</TableHead>
                <TableHead className="text-right">Acumulado</TableHead>
                <TableHead className="text-right">Promedio mensual</TableHead>
                <TableHead className="text-right">Máximo</TableHead>
                <TableHead className="text-right">Mínimo</TableHead>
                <TableHead className="text-right">Var. vs año previo</TableHead>
                <TableHead className="text-right">Proyección cierre</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {series.map((s, i) => {
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
                const proy = proyeccionCierre(s.valores);
                return (
                  <TableRow key={s.anio}>
                    <TableCell className="font-medium">{s.anio}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {con.length}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatUnidades(acum)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {prom === null ? "—" : formatUnidades(Math.round(prom))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {con.length ? `${formatUnidades(Math.max(...con))} (${mesCorto(maxIdx + 1)})` : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {con.length ? `${formatUnidades(Math.min(...con))} (${mesCorto(minIdx + 1)})` : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {varYtd === null ? "—" : formatPct(varYtd, { signed: true })}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {proy ? formatUnidades(proy.proyectado) : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
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
            </NotaDato>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
