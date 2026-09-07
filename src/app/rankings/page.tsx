import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NotaDato, PageHeader } from "@/components/dashboard/page-header";
import { FiltroPeriodo } from "@/components/dashboard/filtro-periodo";
import { TablaRanking } from "@/components/dashboard/tabla-ranking";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getCobertura, getOpcionesFiltro, getRankingMarcas, getRankingModelos, TECNOLOGIAS,
} from "@/lib/cadam/mercado";
import {
  asignarPrecios, fichasDeModelos, type PrecioCandidato,
} from "@/lib/cadam/bandas";
import { getStockPropio } from "@/lib/informes/propios";
import { getPreciosCompetencia } from "@/lib/informes/precios-competencia";
import { etiquetaPeriodo, filtroDesdeUrl, type SearchParams } from "@/lib/periodo";

export default async function RankingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const cobertura = getCobertura();
  const f = filtroDesdeUrl(sp, cobertura.matriculacion.ultimo);
  const periodo = etiquetaPeriodo(f.anio, f.mesDesde, f.mesHasta);
  const opciones = getOpcionesFiltro();

  const marcasMat = getRankingMarcas("matriculacion", f);
  const marcasImp = getRankingMarcas("importacion", f);
  const modelosMat = getRankingModelos("matriculacion", f, 500);
  const modelosImp = getRankingModelos("importacion", f, 500);

  const mesMax: Record<number, number> = {};
  for (const a of cobertura.matriculacion.anios) {
    mesMax[a] = a === cobertura.matriculacion.ultimo?.anio ? cobertura.matriculacion.ultimo.mes : 12;
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
    <div className="flex flex-col gap-5">
      <PageHeader
        titulo="Rankings"
        descripcion={`Marcas y modelos, matriculación e importación · ${periodo}.`}
        fuente={`Fuente: CADAM / DNRA · snapshot ${cobertura.snapshot ?? "—"}.`}
      />

      <FiltroPeriodo
        anios={cobertura.matriculacion.anios}
        mesMaximoPorAnio={mesMax}
        opciones={[
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
          <Panel titulo={`Marcas por matriculación (${marcasMat.length})`}>
            <TablaRanking filas={marcasMat} notaVariacion={nota}
              nombreArchivo={`ranking-marcas-matriculacion-${f.anio}`} />
          </Panel>
        </TabsContent>

        <TabsContent value="marcas-imp">
          <Panel titulo={`Marcas por importación (${marcasImp.length})`}>
            {(f.tecnologia || f.empresa) && (
              <NotaDato>
                Los filtros de tecnología e importador solo aplican a
                matriculación: la base de importación no trae esas columnas.
              </NotaDato>
            )}
            <TablaRanking filas={marcasImp} notaVariacion={nota}
              nombreArchivo={`ranking-marcas-importacion-${f.anio}`} />
          </Panel>
        </TabsContent>

        <TabsContent value="modelos-mat">
          <Panel titulo={`Modelos por matriculación (${modelosMat.length})`}>
            <TablaRanking filas={modelosMat} mostrarModelo mostrarSegmento
              notaVariacion={nota}
              fichas={fichasMat}
              periodo={periodo}
              nombreArchivo={`ranking-modelos-matriculacion-${f.anio}`} />
          </Panel>
        </TabsContent>

        <TabsContent value="modelos-imp">
          <Panel titulo={`Modelos por importación (${modelosImp.length})`}>
            <TablaRanking filas={modelosImp} mostrarModelo mostrarSegmento
              notaVariacion={nota}
              fichas={fichasImp}
              periodo={periodo}
              fuente="importacion"
              nombreArchivo={`ranking-modelos-importacion-${f.anio}`} />
          </Panel>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Panel({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <Card className="mt-3">
      <CardHeader><CardTitle>{titulo}</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-3">{children}</CardContent>
    </Card>
  );
}
