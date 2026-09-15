import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NotaDato, PageHeader } from "@/components/dashboard/page-header";
import { Pagina } from "@/components/movimiento/pagina";
import { FiltroPeriodo } from "@/components/dashboard/filtro-periodo";
import { SelectorFuente, type FuenteVista } from "@/components/dashboard/selector-fuente";
import { TablaShare } from "@/components/dashboard/tabla-share";
import { SelectorDimension } from "@/components/dashboard/selector-dimension";
import { SerieAniosChart } from "@/components/charts/serie-anios-chart";
import {
  getCobertura, getOpcionesFiltro, getPorDimension, getSerieMensual,
  TECNOLOGIAS, type Fuente,
} from "@/lib/cadam/mercado";
import { getMarcasPropiasSet } from "@/lib/cadam/config";
import {
  etiquetaCortes, etiquetaPeriodo, filtroDesdeUrl, mesCorto, type SearchParams,
} from "@/lib/periodo";

const DIMENSIONES = {
  marca: { label: "Marca", col: "marca" },
  segmento: { label: "Segmento", col: "segmento" },
  tecnologia: { label: "Tecnología", col: "tecnologia" },
  empresa: { label: "Importador", col: "empresa" },
} as const;

type Dim = keyof typeof DIMENSIONES;

const NOMBRE: Record<Fuente, string> = { matriculacion: "matriculaciones", importacion: "importaciones" };

export default async function MarketSharePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const cobertura = getCobertura();
  // Tres vistas (Croman, 15/09/2026: "el mismo selector en Market Share").
  // Con "Ambas", la tabla y la evolución van dos veces, una por fuente y
  // lado a lado, cada una hasta su propio último mes.
  const vista: FuenteVista =
    sp.fuente === "importacion" ? "importacion" : sp.fuente === "ambas" ? "ambas" : "matriculacion";
  const fuentes: Fuente[] = vista === "ambas" ? ["matriculacion", "importacion"] : [vista];
  const principal: Fuente = fuentes[0];
  const opciones = getOpcionesFiltro();
  const propias = getMarcasPropiasSet();

  const dimRaw = String(sp.dim ?? "marca");
  const dim: Dim = (dimRaw in DIMENSIONES ? dimRaw : "marca") as Dim;

  // El período lo manda la fuente principal; la otra se recorta o se estira
  // a su propio último mes cuando la URL no fija el "hasta".
  const f0 = filtroDesdeUrl(sp, cobertura[principal].ultimo);
  const ventanaDe = (fuente: Fuente) => {
    const ult = cobertura[fuente].ultimo;
    if (!ult || f0.anio !== ult.anio) return f0;
    if (sp.hasta) return f0.mesHasta > ult.mes ? { ...f0, mesHasta: Math.max(f0.mesDesde, ult.mes) } : f0;
    return { ...f0, mesHasta: Math.max(f0.mesDesde, ult.mes) };
  };

  const ultMat = cobertura.matriculacion.ultimo;
  const ultImp = cobertura.importacion.ultimo;
  const desparejas = !!ultMat && !!ultImp && (ultMat.anio !== ultImp.anio || ultMat.mes !== ultImp.mes);
  const aclaracion = desparejas && ultMat && ultImp
    ? `Matriculaciones hasta ${mesCorto(ultMat.mes)} · importaciones hasta ${mesCorto(ultImp.mes)}: CADAM ya publicó la importación de ${mesCorto(ultImp.mes)}, la matriculación de ese mes todavía no.`
    : undefined;

  // Un bloque por fuente: la tabla de participación y la evolución del top 5.
  const bloques = fuentes.map((fuente) => {
    const f = ventanaDe(fuente);
    const periodo = etiquetaPeriodo(f.anio, f.mesDesde, f.mesHasta);
    // Importacion no trae tecnologia: esa dimension solo existe del lado de
    // matriculacion. Importador tampoco viene en la base, pero se infiere
    // por marca (ver getPorDimension) y por eso si esta disponible.
    const dimDisponible = fuente === "matriculacion" || dim !== "tecnologia";
    const dimEfectiva: Dim = dimDisponible ? dim : "marca";
    const importadorInferido = fuente === "importacion" && dimEfectiva === "empresa";

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
    return { fuente, f, periodo, dimEfectiva, dimDisponible, importadorInferido, filas, seriesShare };
  });
  const principalBloque = bloques[0];
  const dimLabel = DIMENSIONES[dim].label.toLowerCase();

  const mesMax: Record<number, number> = {};
  for (const a of cobertura[principal].anios) {
    mesMax[a] = a === cobertura[principal].ultimo?.anio ? cobertura[principal].ultimo.mes : 12;
  }

  return (
    <Pagina>
      <PageHeader
        titulo="Market Share"
        descripcion={`Participación por ${dimLabel} sobre ${bloques.map((b) => `${NOMBRE[b.fuente]} ${b.periodo}`).join(" y ")} vs. ${principalBloque.f.anio - 1}.`}
        fuente={`Fuente: CADAM / DNRA · ${etiquetaCortes(cobertura)}.`}
      />

      <div
        data-revelar=""
        className="-mx-1 flex flex-col gap-3 rounded-xl px-1 py-1 sm:sticky sm:top-16 sm:z-30 sm:flex-row sm:flex-wrap sm:items-start sm:bg-background/85 sm:backdrop-blur-md"
      >
        <SelectorFuente fuente={vista} porDefecto="matriculacion" conAmbas aclaracion={aclaracion} />
        <SelectorDimension
          dimensiones={Object.entries(DIMENSIONES).map(([k, v]) => ({ valor: k, label: v.label }))}
          dimensionActual={principalBloque.dimEfectiva}
        />
        <div className="min-w-0 sm:flex-1">
          <FiltroPeriodo
            pegajoso={false}
            anios={cobertura[principal].anios}
            mesMaximoPorAnio={mesMax}
            opciones={[
              { param: "segmento", label: "Segmento", valores: opciones.segmentos },
              ...(fuentes.includes("matriculacion")
                ? [{ param: "tecnologia", label: "Tecnología", valores: [...TECNOLOGIAS] }]
                : []),
            ]}
          />
        </div>
      </div>

      {bloques.some((b) => !b.dimDisponible) && (
        <NotaDato>
          La base de importación no trae tecnología, así que esa vista solo
          existe del lado de matriculación. En importaciones se muestra por marca.
        </NotaDato>
      )}

      {bloques.some((b) => b.importadorInferido) && (
        <NotaDato>
          La base de importación de CADAM no dice quién importa. En importaciones
          cada unidad se le atribuye al <strong>representante de su marca</strong>: la
          empresa que más chapas le puso a esa marca en {principalBloque.f.anio} y{" "}
          {principalBloque.f.anio - 1}. Las marcas que todavía nadie matriculó quedan
          en «Sin representante conocido».
        </NotaDato>
      )}

      <NotaDato>
        <strong>Crecer en unidades no es ganar market share.</strong> Si una marca
        crece 40% pero el mercado creció 54%, pierde participación. Por eso las dos
        columnas van juntas y las filas donde los signos no coinciden quedan
        marcadas.
      </NotaDato>

      {/* Con las dos fuentes, lado a lado en pantallas anchas: tabla sobre
          tabla y evolución sobre evolución, para comparar de un vistazo. */}
      <div className={vista === "ambas" ? "grid grid-cols-1 gap-4 xl:grid-cols-2" : "flex flex-col gap-4"}>
        {bloques.map((b) => (
          <div key={b.fuente} className="flex min-w-0 flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle>
                  Participación por {DIMENSIONES[b.dimEfectiva].label.toLowerCase()} —{" "}
                  {NOMBRE[b.fuente]} ({b.filas.length}) · {b.periodo}
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Unidades y parte del mercado de cada uno, contra el mismo período del
                  año pasado. La columna que importa es la última: los puntos de
                  participación que ganó o perdió.
                </p>
              </CardHeader>
              <CardContent>
                <TablaShare
                  filas={b.filas}
                  etiqueta={DIMENSIONES[b.dimEfectiva].label}
                  logos={b.dimEfectiva === "marca"}
                  anioAnterior={b.f.anio - 1}
                  nombreArchivo={`market-share-${b.dimEfectiva}-${b.fuente}-${b.f.anio}`}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>
                  Evolución de la participación — top 5 en {NOMBRE[b.fuente]}, {b.f.anio}{" "}
                  (% del mes)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {b.seriesShare.length ? (
                  <>
                    <SerieAniosChart series={b.seriesShare} altura={300} ordenTooltip="seriesAsc" />
                    <p className="mt-2 text-xs text-muted-foreground">
                      Cada línea es el % que representó esa {DIMENSIONES[b.dimEfectiva].label.toLowerCase()} sobre
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
          </div>
        ))}
      </div>

      <NotaDato>
        Falta el market share por <strong>fabricante</strong> y por{" "}
        <strong>país de origen</strong>. Ninguno de los dos viene en el detalle
        por vehículo: la base de importación solo marca si es de China o no, no
        el país. El país real aparece únicamente en el Cuadro 12 del informe de
        matriculación, y solo acumulado por año.
      </NotaDato>
    </Pagina>
  );
}
