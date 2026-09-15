import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NotaDato, PageHeader } from "@/components/dashboard/page-header";
import { Pagina } from "@/components/movimiento/pagina";
import { FiltroPeriodo } from "@/components/dashboard/filtro-periodo";
import { TablaRanking } from "@/components/dashboard/tabla-ranking";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getCobertura, getMarcasDeImportador, getOpcionesFiltro, getRankingMarcas, getRankingModelos,
  TECNOLOGIAS,
} from "@/lib/cadam/mercado";
import {
  asignarPrecios, fichasDeModelos, type PrecioCandidato,
} from "@/lib/cadam/bandas";
import { getStockPropio } from "@/lib/informes/propios";
import { getPreciosCompetencia } from "@/lib/informes/precios-competencia";
import { etiquetaCorte, etiquetaPeriodo, filtroDesdeUrl, mesCorto, type SearchParams } from "@/lib/periodo";

export default async function RankingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const cobertura = getCobertura();
  // Las dos fuentes conviven en pestanas con un solo filtro. Por defecto
  // el periodo llega hasta la ultima matriculacion (asi las cuatro
  // pestanas comparan lo mismo), pero se puede pedir hasta donde llegue
  // la importacion, que suele ir un mes adelante. Cuando pasa eso, las
  // pestanas de matriculacion lo avisan.
  const ultMat = cobertura.matriculacion.ultimo;
  const ultImp = cobertura.importacion.ultimo;
  const ultimo =
    ultMat && ultImp && (ultImp.anio > ultMat.anio || (ultImp.anio === ultMat.anio && ultImp.mes > ultMat.mes))
      ? ultImp
      : ultMat;
  const f = filtroDesdeUrl(sp, ultMat);
  const periodo = etiquetaPeriodo(f.anio, f.mesDesde, f.mesHasta);
  const matricRecorta = !!ultMat && f.anio === ultMat.anio && f.mesHasta > ultMat.mes;
  const opciones = getOpcionesFiltro();

  const marcasMat = getRankingMarcas("matriculacion", f);
  const marcasImp = getRankingMarcas("importacion", f);
  const modelosMat = getRankingModelos("matriculacion", f, 500);
  const modelosImp = getRankingModelos("importacion", f, 500);
  // En importación el importador se infiere por marca (la base no lo trae):
  // se le dice al usuario qué marcas quedaron adentro.
  const marcasDelImportador = f.empresa ? getMarcasDeImportador(f.empresa, f.anio) : [];

  const mesMax: Record<number, number> = {};
  for (const a of [...new Set([...cobertura.matriculacion.anios, ...cobertura.importacion.anios])].sort()) {
    mesMax[a] = a === ultimo?.anio ? ultimo.mes : 12;
  }
  const nota = `Variación y cambio de posición contra ${periodo.replace(String(f.anio), String(f.anio - 1))}.`;

  // --- ficha de cada modelo, para abrirla desde su fila -------------------
  // Un ranking dice quién vendió más; la pregunta que sigue es contra quién
  // compite ese modelo y a qué precio, y eso ya está calculado (clases.ts +
  // precios de Cars y Datacar). Las filas de MARCA no llevan ficha: la ficha
  // es de un modelo, no de una marca entera.
  let preciosPropios: PrecioCandidato[] = [];
  try {
    preciosPropios = (await getStockPropio())
      .filter((s) => s.precio_usd)
      .map((s) => ({ marca: s.marca, nombre: s.version, precio: s.precio_usd as number }));
  } catch {
    preciosPropios = [];
  }
  const preciosRivales: PrecioCandidato[] = (await getPreciosCompetencia())
    .map((p) => ({ marca: p.marca, nombre: p.version, precio: p.precio_usd }));
  const listasPrecio = [
    { fuente: "cars", lista: preciosPropios },
    { fuente: "datacar", lista: preciosRivales },
  ];
  // Una ficha por fuente: los rivales de un modelo importado son los otros
  // modelos importados, no los matriculados. Son dos mediciones distintas.
  const fichasDe = (filas: typeof modelosMat) =>
    fichasDeModelos(asignarPrecios(filas, listasPrecio));
  const fichasMat = fichasDe(modelosMat);
  const fichasImp = fichasDe(modelosImp);

  return (
    <Pagina>
      <PageHeader
        titulo="Rankings"
        descripcion={`Marcas y modelos, matriculación e importación · ${periodo}.`}
        fuente={`Fuente: CADAM / DNRA · datos hasta ${etiquetaCorte(cobertura.snapshot)}.`}
      />

      <FiltroPeriodo
        anios={cobertura.matriculacion.anios}
        mesMaximoPorAnio={mesMax}
        hastaPorDefecto={f.mesHasta}
        opciones={[
          // Marca puntual (pedido de Fernando, 15/09/2026): con una marca
          // elegida las pestañas de modelos son la gama de esa marca.
          { param: "marca", label: "Marca", valores: opciones.marcas },
          { param: "segmento", label: "Segmento", valores: opciones.segmentos },
          { param: "tecnologia", label: "Tecnología", valores: [...TECNOLOGIAS] },
          { param: "empresa", label: "Importador", valores: opciones.empresas },
        ]}
      />

      <NotaDato>
        CADAM no publica <strong>versión, motor, transmisión ni tracción</strong> en
        ninguna de sus fuentes, así que el ranking por versión que pide la spec no
        es construible. El mayor detalle disponible es el modelo tal como lo
        escribe la DNRA, que a veces incluye la cilindrada en el texto.
      </NotaDato>

      <Tabs defaultValue="marcas-mat">
        <TabsList className="flex-wrap">
          <TabsTrigger value="marcas-mat">Marcas · Matriculación</TabsTrigger>
          <TabsTrigger value="marcas-imp">Marcas · Importación</TabsTrigger>
          <TabsTrigger value="modelos-mat">Modelos · Matriculación</TabsTrigger>
          <TabsTrigger value="modelos-imp">Modelos · Importación</TabsTrigger>
        </TabsList>

        <TabsContent value="marcas-mat">
          <Panel
            titulo={`Marcas por matriculación (${marcasMat.length})`}
            nota="Las marcas ordenadas por chapas puestas. Tocá una y toda la pantalla queda filtrada por ella; tocala de nuevo y se quita."
          >
            {matricRecorta && ultMat && (
              <NotaDato>
                CADAM todavía no publicó la matriculación de {mesCorto(f.mesHasta)}: este
                ranking llega hasta {mesCorto(ultMat.mes)}. La importación de{" "}
                {mesCorto(f.mesHasta)} ya está, en las pestañas de importación.
              </NotaDato>
            )}
            <TablaRanking filas={marcasMat} notaVariacion={nota}
              filtrarPor={{ marca: "marca" }}
              nombreArchivo={`ranking-marcas-matriculacion-${f.anio}`} />
          </Panel>
        </TabsContent>

        <TabsContent value="marcas-imp">
          <Panel
            titulo={`Marcas por importación (${marcasImp.length})`}
            nota="Lo mismo, pero por unidades que entraron al país. Una marca puede liderar acá y todavía no aparecer en matriculación: es stock en camino."
          >
            <NotasImportacion f={f} marcasDelImportador={marcasDelImportador} />
            <TablaRanking filas={marcasImp} notaVariacion={nota}
              filtrarPor={{ marca: "marca" }}
              nombreArchivo={`ranking-marcas-importacion-${f.anio}`} />
          </Panel>
        </TabsContent>

        <TabsContent value="modelos-mat">
          <Panel
            titulo={`Modelos por matriculación (${modelosMat.length})`}
            nota="Modelo por modelo, con su segmento. Tocá una fila y se abre contra quién compite ese modelo: su clase, sus rivales y a qué precio."
          >
            {matricRecorta && ultMat && (
              <NotaDato>
                CADAM todavía no publicó la matriculación de {mesCorto(f.mesHasta)}: este
                ranking llega hasta {mesCorto(ultMat.mes)}.
              </NotaDato>
            )}
            <TablaRanking filas={modelosMat} mostrarModelo mostrarSegmento
              notaVariacion={nota}
              fichas={fichasMat}
              periodo={periodo}
              filtrarPor={{ marca: "marca" }}
              nombreArchivo={`ranking-modelos-matriculacion-${f.anio}`} />
          </Panel>
        </TabsContent>

        <TabsContent value="modelos-imp">
          <Panel
            titulo={`Modelos por importación (${modelosImp.length})`}
            nota="Los modelos por unidades importadas. Sirve para ver qué se está trayendo antes de que llegue al mercado."
          >
            <NotasImportacion f={f} marcasDelImportador={marcasDelImportador} />
            <TablaRanking filas={modelosImp} mostrarModelo mostrarSegmento
              notaVariacion={nota}
              fichas={fichasImp}
              periodo={periodo}
              fuente="importacion"
              filtrarPor={{ marca: "marca" }}
              nombreArchivo={`ranking-modelos-importacion-${f.anio}`} />
          </Panel>
        </TabsContent>
      </Tabs>
    </Pagina>
  );
}

/** Qué pasa con los filtros que la base de importación no trae. Tecnología
 *  no se puede; importador se infiere por marca y se dice cuáles. */
function NotasImportacion({
  f, marcasDelImportador,
}: { f: { anio: number; tecnologia?: string; empresa?: string }; marcasDelImportador: string[] }) {
  return (
    <>
      {f.tecnologia && (
        <NotaDato>
          El filtro de tecnología solo aplica a matriculación: la base de
          importación no dice si el vehículo es híbrido o eléctrico.
        </NotaDato>
      )}
      {f.empresa && (
        <NotaDato>
          La base de importación no dice quién importa. Se muestran las marcas que{" "}
          <strong>{f.empresa}</strong> representa —la empresa que más las matriculó en{" "}
          {f.anio - 1} y {f.anio}—:{" "}
          {marcasDelImportador.length ? marcasDelImportador.join(", ") : "ninguna con matriculación todavía"}.
        </NotaDato>
      )}
    </>
  );
}

function Panel({
  titulo, nota, children,
}: { titulo: string; nota?: string; children: React.ReactNode }) {
  return (
    <Card className="mt-3">
      <CardHeader>
        <CardTitle>{titulo}</CardTitle>
        {nota ? <p className="text-xs text-muted-foreground">{nota}</p> : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">{children}</CardContent>
    </Card>
  );
}
