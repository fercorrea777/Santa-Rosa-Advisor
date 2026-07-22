import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NotaDato, PageHeader } from "@/components/dashboard/page-header";
import { FiltroPeriodo } from "@/components/dashboard/filtro-periodo";
import { TablaShare } from "@/components/dashboard/tabla-share";
import { SelectorDimension } from "@/components/dashboard/selector-dimension";
import { SerieAniosChart } from "@/components/charts/serie-anios-chart";
import {
  getCobertura, getOpcionesFiltro, getPorDimension, getSerieMensual,
  TECNOLOGIAS, type Fuente,
} from "@/lib/cadam/mercado";
import { getMarcasPropiasSet } from "@/lib/cadam/config";
import { serieAAnios } from "@/lib/serie";
import { etiquetaPeriodo, filtroDesdeUrl, type SearchParams } from "@/lib/periodo";

const DIMENSIONES = {
  marca: { label: "Marca", col: "marca" },
  segmento: { label: "Segmento", col: "segmento" },
  tecnologia: { label: "Tecnología", col: "tecnologia" },
  empresa: { label: "Importador", col: "empresa" },
} as const;

type Dim = keyof typeof DIMENSIONES;

export default async function MarketSharePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const cobertura = getCobertura();
  const f = filtroDesdeUrl(sp, cobertura.matriculacion.ultimo);
  const periodo = etiquetaPeriodo(f.anio, f.mesDesde, f.mesHasta);
  const opciones = getOpcionesFiltro();
  const propias = getMarcasPropiasSet();

  const dimRaw = String(sp.dim ?? "marca");
  const dim: Dim = (dimRaw in DIMENSIONES ? dimRaw : "marca") as Dim;
  const fuente: Fuente = sp.fuente === "importacion" ? "importacion" : "matriculacion";

  // Importacion no trae tecnologia ni importador: esas dimensiones solo
  // existen del lado de matriculacion.
  const dimDisponible = fuente === "matriculacion" ||
    dim === "marca" || dim === "segmento";
  const dimEfectiva: Dim = dimDisponible ? dim : "marca";
  const etiquetaFuente = fuente === "importacion" ? "importaciones" : "matriculaciones";

  const filas = getPorDimension(fuente, DIMENSIONES[dimEfectiva].col, f)
    .map((r) => ({ ...r, esPropia: dimEfectiva === "marca" && propias.has(r.valor) }));

  // Evolucion de la participacion de los 5 primeros, mes a mes.
  const anios = [f.anio - 1, f.anio].filter((a) => cobertura[fuente].anios.includes(a));
  const totalPorMes = new Map<string, number>();
  for (const p of getSerieMensual(fuente, anios)) {
    totalPorMes.set(`${p.anio}-${p.mes}`, p.unidades);
  }
  const top5 = filas.slice(0, 5);
  const seriesShare = top5.map((r, i) => {
    const corte = dimEfectiva === "marca" ? { marca: r.valor }
      : dimEfectiva === "segmento" ? { segmento: r.valor }
      : dimEfectiva === "tecnologia" ? { tecnologia: r.valor }
      : { empresa: r.valor };
    const puntos = getSerieMensual(fuente, anios, corte);
    const valores: (number | null)[] = Array(12).fill(null);
    for (const p of puntos) {
      if (p.anio !== f.anio) continue;
      const tot = totalPorMes.get(`${p.anio}-${p.mes}`);
      // Sin total del mes no hay porcentaje posible: queda como hueco.
      valores[p.mes - 1] = tot ? Number(((p.unidades / tot) * 100).toFixed(2)) : null;
    }
    return { anio: r.valor, valores, punteada: i > 2, unidad: "porcentaje" as const };
  });

  const mesMax: Record<number, number> = {};
  for (const a of cobertura.matriculacion.anios) {
    mesMax[a] = a === cobertura.matriculacion.ultimo?.anio
      ? cobertura.matriculacion.ultimo.mes : 12;
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        titulo="Market Share"
        descripcion={`Participación por ${DIMENSIONES[dimEfectiva].label.toLowerCase()} sobre ${etiquetaFuente} · ${periodo} vs. ${f.anio - 1}.`}
        fuente={`Fuente: CADAM / DNRA · snapshot ${cobertura.snapshot ?? "—"}.`}
      />

      <SelectorDimension
        dimensiones={Object.entries(DIMENSIONES).map(([k, v]) => ({ valor: k, label: v.label }))}
        dimensionActual={dimEfectiva}
        fuente={fuente}
      />

      <FiltroPeriodo
        anios={cobertura.matriculacion.anios}
        mesMaximoPorAnio={mesMax}
        opciones={[
          { param: "segmento", label: "Segmento", valores: opciones.segmentos },
          ...(fuente === "matriculacion"
            ? [{ param: "tecnologia", label: "Tecnología", valores: [...TECNOLOGIAS] }]
            : []),
        ]}
      />

      {!dimDisponible && (
        <NotaDato>
          La base de importación no trae tecnología ni importador, así que esa
          vista solo existe del lado de matriculación. Se muestra por marca.
        </NotaDato>
      )}

      <NotaDato>
        <strong>Crecer en unidades no es ganar market share.</strong> Si una marca
        crece 40% pero el mercado creció 54%, pierde participación. Por eso las dos
        columnas van juntas y las filas donde los signos no coinciden quedan
        marcadas.
      </NotaDato>

      <Card>
        <CardHeader>
          <CardTitle>
            Participación por {DIMENSIONES[dimEfectiva].label.toLowerCase()} —{" "}
            {etiquetaFuente} ({filas.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TablaShare
            filas={filas}
            etiqueta={DIMENSIONES[dimEfectiva].label}
            anioAnterior={f.anio - 1}
            nombreArchivo={`market-share-${dimEfectiva}-${fuente}-${f.anio}`}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Evolución de la participación — top 5 en {etiquetaFuente}, {f.anio}{" "}
            (% del mes)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {seriesShare.length ? (
            <>
              <SerieAniosChart series={seriesShare} altura={300} />
              <p className="mt-2 text-xs text-muted-foreground">
                Cada línea es el % que representó esa {DIMENSIONES[dimEfectiva].label.toLowerCase()} sobre
                el total del mes. Los meses sin dato quedan como hueco.
              </p>
            </>
          ) : (
            <p className="py-16 text-center text-sm text-muted-foreground">
              Sin datos para graficar.
            </p>
          )}
        </CardContent>
      </Card>

      <NotaDato>
        La spec pide también market share por <strong>fabricante</strong> y{" "}
        <strong>país de origen</strong>. Ninguno de los dos está en las fuentes
        row-level: el campo <code>ORIGEN</code> de la base de importación es solo
        un indicador <code>CHINA</code>/<code>OTROS</code>, no el país. El país
        real aparece únicamente en el Cuadro 12 del informe de matriculación, y
        solo acumulado por año.
      </NotaDato>
    </div>
  );
}
