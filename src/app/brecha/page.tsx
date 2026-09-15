import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Seccion } from "@/components/dashboard/seccion";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { NotaDato, PageHeader } from "@/components/dashboard/page-header";
import { Pagina } from "@/components/movimiento/pagina";
import { FiltroPeriodo } from "@/components/dashboard/filtro-periodo";
import { SelectorFuente, type FuenteVista } from "@/components/dashboard/selector-fuente";
import { TablaRanking } from "@/components/dashboard/tabla-ranking";
import { BrechaChart } from "@/components/charts/brecha-chart";
import { SerieAniosChart } from "@/components/charts/serie-anios-chart";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { LogoMarca } from "@/components/dashboard/logo-marca";
import { cn } from "@/lib/utils";
import {
  getBrecha, getCobertura, getKpi, getMarcasMatriculacionLivianos, getRankingMarcas,
  getSerieMensual, type Fuente,
} from "@/lib/cadam/mercado";
import { getMarcasPropiasSet } from "@/lib/cadam/config";
import { serieAAnios } from "@/lib/serie";
import { formatUnidades } from "@/lib/format";
import {
  etiquetaCortes, etiquetaPeriodo, filtroDesdeUrl, mesCorto, type SearchParams,
} from "@/lib/periodo";

const NOMBRE: Record<Fuente, string> = { matriculacion: "matriculaciones", importacion: "importaciones" };

export default async function BrechaPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const cobertura = getCobertura();
  // Tres vistas (Croman, 15/09/2026: "el mismo selector en Segmentos y
  // Brecha"). "Ambas" es la brecha de siempre: las dos fuentes sobre la
  // ventana común, y el mes que la importación ya tiene y la matriculación
  // no, se ve en el gráfico y la tabla con la matriculación "sin dato".
  // "Importaciones" o "Matriculaciones" es una sola fuente hasta su propio
  // último mes: total, evolución y ranking por marca.
  const vista: FuenteVista =
    sp.fuente === "importacion" ? "importacion" : sp.fuente === "matriculacion" ? "matriculacion" : "ambas";
  const ultMat = cobertura.matriculacion.ultimo;
  const ultImp = cobertura.importacion.ultimo;
  const desparejas = !!ultMat && !!ultImp && (ultMat.anio !== ultImp.anio || ultMat.mes !== ultImp.mes);
  const aclaracion = desparejas && ultMat && ultImp
    ? `Matriculaciones hasta ${mesCorto(ultMat.mes)} · importaciones hasta ${mesCorto(ultImp.mes)}: CADAM ya publicó la importación de ${mesCorto(ultImp.mes)}, la matriculación de ese mes todavía no.`
    : undefined;

  if (vista !== "ambas") {
    return <UnaFuente sp={sp} fuente={vista} cobertura={cobertura} aclaracion={aclaracion} />;
  }

  const f = filtroDesdeUrl(sp, ultMat);
  const periodo = etiquetaPeriodo(f.anio, f.mesDesde, f.mesHasta);

  // La serie del gráfico y la tabla llegan hasta el último mes que tenga
  // CUALQUIERA de las dos fuentes (si la URL no fija el "hasta"): agosto
  // aparece con su importación y la matriculación "sin dato", en vez de
  // quedar escondido. Los KPIs y la brecha por marca siguen sobre la
  // ventana común: restar un mes que una fuente todavía no tiene sería
  // inventar stock.
  const hastaSerie =
    !sp.hasta && ultImp && f.anio === ultImp.anio ? Math.max(f.mesHasta, ultImp.mes) : f.mesHasta;
  const serie = getBrecha([f.anio], f.marca)
    .filter((p) => p.mes >= f.mesDesde && p.mes <= hastaSerie);
  const comun = serie.filter((p) => p.mes <= f.mesHasta);

  const totImp = comun.reduce((s, p) => s + (p.importaciones ?? 0), 0);
  const totMat = comun.reduce((s, p) => s + (p.matriculaciones ?? 0), 0);
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

  // El mes que ya entró y todavía no tiene chapa posible se dice aparte,
  // con sus marcas: es justamente lo que está por salir a la calle.
  const mesesExtra = hastaSerie > f.mesHasta ? { desde: f.mesHasta + 1, hasta: hastaSerie } : null;
  const extraImp = mesesExtra
    ? getRankingMarcas("importacion", { ...f, mesDesde: mesesExtra.desde, mesHasta: mesesExtra.hasta })
    : [];
  const extraTotal = extraImp.reduce((s, r) => s + r.unidades, 0);

  const mesMax: Record<number, number> = {};
  for (const a of cobertura.matriculacion.anios) {
    mesMax[a] = a === cobertura.matriculacion.ultimo?.anio
      ? cobertura.matriculacion.ultimo.mes : 12;
  }

  return (
    <Pagina>
      <PageHeader
        titulo="Importaciones vs. matriculaciones"
        descripcion={`Brecha entre lo que entra al país y lo que se patenta · ${periodo}${mesesExtra ? ` (importación hasta ${mesCorto(mesesExtra.hasta)})` : ""}.`}
        fuente={`Fuente: CADAM / DNRA · ${etiquetaCortes(cobertura)}.`}
      />

      <div
        data-revelar=""
        className="-mx-1 flex flex-col gap-3 rounded-xl px-1 py-1 sm:sticky sm:top-16 sm:z-30 sm:flex-row sm:flex-wrap sm:items-start sm:bg-background/85 sm:backdrop-blur-md"
      >
        <SelectorFuente porDefecto="ambas" fuente="ambas" conAmbas aclaracion={aclaracion} />
        <div className="min-w-0 sm:flex-1">
          <FiltroPeriodo pegajoso={false} anios={cobertura.matriculacion.anios} mesMaximoPorAnio={mesMax} />
        </div>
      </div>

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

      {mesesExtra && extraTotal > 0 && (
        <NotaDato>
          <strong>
            {mesesExtra.desde === mesesExtra.hasta
              ? `En ${mesCorto(mesesExtra.hasta)} entraron ${formatUnidades(extraTotal)} unidades más`
              : `Entre ${mesCorto(mesesExtra.desde)} y ${mesCorto(mesesExtra.hasta)} entraron ${formatUnidades(extraTotal)} unidades más`}
          </strong>{" "}
          que no entran en los totales ni en la brecha por marca: CADAM ya publicó
          esa importación pero todavía no la matriculación de ese mes, así que
          compararlas sería contar stock que no tuvo tiempo de sacar chapa. En el
          gráfico y la tabla de abajo ese mes aparece con la matriculación «sin
          dato». Las que más trajeron:{" "}
          {extraImp.slice(0, 6).map((r) => `${r.marca} ${formatUnidades(r.unidades)}`).join(" · ")}.
        </NotaDato>
      )}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Importaciones" value={formatUnidades(totImp)} periodo={periodo}
          tooltip="Unidades importadas en la ventana común de las dos fuentes." />
        <KpiCard label="Matriculaciones" value={formatUnidades(totMat)} periodo={periodo}
          tooltip="Unidades patentadas en la ventana común de las dos fuentes." />
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

      <Seccion titulo="Evolución de la brecha"
        nota="Cuánto de lo que entra al país todavía no sacó chapa. Es stock que está en la calle de la competencia y todavía no se ve como venta.">
      <Card>
        <CardHeader>
          <CardTitle>Evolución de la brecha — {f.anio}</CardTitle>
          <p className="text-xs text-muted-foreground">
            Mes a mes: cuánto entró al país, cuánto sacó chapa y el hueco entre
            las dos líneas. Ese hueco es stock que ya está acá y todavía no se
            vendió.
          </p>
        </CardHeader>
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
        <CardHeader>
          <CardTitle>Detalle mensual</CardTitle>
          <p className="text-xs text-muted-foreground">
            Los mismos meses en números, con qué parte de lo importado ya sacó
            chapa. Arriba del 100% se está vendiendo stock viejo; muy abajo, se
            está cargando stock.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col divide-y sm:hidden">
            {serie.map((p) => (
              <div key={p.mes} className="flex flex-col gap-1 py-2.5">
                <div className="flex items-baseline justify-between">
                  <span className="font-medium">{mesCorto(p.mes)}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    ratio {p.ratio === null ? "—" : p.ratio.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="tabular-nums text-muted-foreground">
                    Import. {p.importaciones === null ? "sin dato" : formatUnidades(p.importaciones)}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    Matric. {p.matriculaciones === null ? "sin dato" : formatUnidades(p.matriculaciones)}
                  </span>
                </div>
                <span className="font-mono text-sm font-semibold tabular-nums">
                  {p.diferencia === null ? "—" :
                    `${p.diferencia > 0 ? "+" : ""}${formatUnidades(p.diferencia)} dif.`}
                </span>
              </div>
            ))}
          </div>
          <div className="hidden overflow-x-auto sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mes</TableHead>
                  <TableHead className="text-right" nota="unidades que entraron al país">Importaciones</TableHead>
                  <TableHead className="text-right" nota="unidades que sacaron chapa">Matriculaciones</TableHead>
                  <TableHead className="text-right" nota="importado menos matriculado">Diferencia</TableHead>
                  <TableHead className="text-right" nota="cuánto de lo importado ya se patentó">Matric. / import.</TableHead>
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
          </div>
        </CardContent>
      </Card>

      </Seccion>

      <Seccion titulo="Marcas que más se apartan"
        nota={`Las marcas donde más se despega lo importado de lo matriculado (${periodo}): o están cargando stock, o lo están liquidando.`}>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
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

      </Seccion>

      <p className="text-xs text-muted-foreground">
        Se excluyen las marcas con menos de 20 unidades sumando ambas fuentes:
        con bases tan chicas la brecha no dice nada.
      </p>
    </Pagina>
  );
}

/**
 * Una sola fuente, hasta su propio último mes: el total contra el año
 * pasado, la evolución (una línea por año) y el ranking por marca. Es la
 * vista que muestra la importación de agosto entera cuando la
 * matriculación todavía va por julio.
 */
async function UnaFuente({
  sp, fuente, cobertura, aclaracion,
}: {
  sp: SearchParams;
  fuente: Fuente;
  cobertura: ReturnType<typeof getCobertura>;
  aclaracion?: string;
}) {
  const f = filtroDesdeUrl(sp, cobertura[fuente].ultimo);
  const periodo = etiquetaPeriodo(f.anio, f.mesDesde, f.mesHasta);
  const kpi = getKpi(fuente, f);
  const anios = [f.anio - 1, f.anio].filter((a) => cobertura[fuente].anios.includes(a));
  const serie = serieAAnios(getSerieMensual(fuente, anios, { marca: f.marca }), anios);
  const marcas = getRankingMarcas(fuente, f);
  const mesMax: Record<number, number> = {};
  for (const a of cobertura[fuente].anios) {
    mesMax[a] = a === cobertura[fuente].ultimo?.anio ? cobertura[fuente].ultimo.mes : 12;
  }
  const propias = getMarcasPropiasSet();
  const propiasU = marcas.filter((m) => propias.has(m.marca)).reduce((s, m) => s + m.unidades, 0);
  const verbo = fuente === "importacion" ? "entró al país" : "sacó chapa";

  return (
    <Pagina>
      <PageHeader
        titulo="Importaciones vs. matriculaciones"
        descripcion={`Solo ${NOMBRE[fuente]} · ${periodo}. Volvé a «Ambas» para ver la brecha entre las dos.`}
        fuente={`Fuente: CADAM / DNRA · ${etiquetaCortes(cobertura)}.`}
      />

      <div
        data-revelar=""
        className="-mx-1 flex flex-col gap-3 rounded-xl px-1 py-1 sm:sticky sm:top-16 sm:z-30 sm:flex-row sm:flex-wrap sm:items-start sm:bg-background/85 sm:backdrop-blur-md"
      >
        <SelectorFuente porDefecto="ambas" fuente={fuente} conAmbas aclaracion={aclaracion} />
        <div className="min-w-0 sm:flex-1">
          <FiltroPeriodo pegajoso={false} anios={cobertura[fuente].anios} mesMaximoPorAnio={mesMax} />
        </div>
      </div>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          label={fuente === "importacion" ? "Importaciones" : "Matriculaciones"}
          value={formatUnidades(kpi.valor)}
          variacion={kpi.variacion}
          periodo={periodo}
          tono={fuente === "importacion" ? "verde" : "azul"}
          tooltip={`Lo que ${verbo} en ${periodo}, contra el mismo período de ${f.anio - 1}.`}
        />
        <KpiCard
          label="Marcas propias"
          value={formatUnidades(propiasU)}
          periodo={kpi.valor ? `${((propiasU / kpi.valor) * 100).toFixed(1)}% del total` : undefined}
          tooltip={`Unidades de nuestras marcas en ${NOMBRE[fuente]} del período.`}
        />
        <KpiCard
          label="Marcas con unidades"
          value={String(marcas.length)}
          periodo={periodo}
          tooltip={`Marcas con al menos una unidad en ${NOMBRE[fuente]} del período.`}
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Evolución mensual — {NOMBRE[fuente]} ({anios.join(" vs. ")})</CardTitle>
          <p className="text-xs text-muted-foreground">
            Una línea por año. Los meses que la fuente todavía no tiene quedan
            sin punto, no en cero.
          </p>
        </CardHeader>
        <CardContent><SerieAniosChart series={serie} /></CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Marcas por {NOMBRE[fuente]} · {periodo}</CardTitle>
          <p className="text-xs text-muted-foreground">
            Todas las marcas ordenadas por unidades, con su variación contra el
            año pasado. Tocá una y la pantalla queda filtrada por ella.
          </p>
        </CardHeader>
        <CardContent>
          <TablaRanking
            filas={marcas}
            fuente={fuente}
            filtrarPor={{ marca: "marca" }}
            nombreArchivo={`${fuente}-marcas-${f.anio}`}
          />
        </CardContent>
      </Card>
    </Pagina>
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
      <CardContent>
        <div className="flex flex-col divide-y sm:hidden">
          {filas.map((r) => (
            <div
              key={r.marca}
              className={cn("flex items-center justify-between gap-2 py-2",
                r.esPropia && "-mx-3 rounded-md bg-primary/5 px-3")}
            >
              <span className="inline-flex min-w-0 items-center gap-2">
                <LogoMarca marca={r.marca} />
                <span className="truncate font-medium">{r.marca}</span>
                {r.esPropia && <Badge className="h-5 shrink-0 px-1.5 text-[10px]">propia</Badge>}
              </span>
              <span className="shrink-0 text-right text-xs">
                <span className="font-mono font-semibold tabular-nums">
                  {r.diferencia > 0 ? "+" : ""}{formatUnidades(r.diferencia)}
                </span>
                <span className="block tabular-nums text-muted-foreground">
                  {formatUnidades(r.importaciones)} imp. · {formatUnidades(r.matriculaciones)} mat.
                </span>
              </span>
            </div>
          ))}
        </div>
        <div className="hidden overflow-x-auto sm:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Marca</TableHead>
                <TableHead className="text-right" nota="unidades que entraron al país">Import.</TableHead>
                <TableHead className="text-right" nota="unidades que sacaron chapa">Matric.</TableHead>
                <TableHead className="text-right" nota="importado menos matriculado">Dif.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((r) => (
                <TableRow key={r.marca} className={r.esPropia ? "bg-primary/5" : undefined}>
                  <TableCell className="font-medium">
                    <span className="inline-flex items-center gap-2">
                      <LogoMarca marca={r.marca} />
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
        </div>
      </CardContent>
    </Card>
  );
}
