import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NotaDato, PageHeader } from "@/components/dashboard/page-header";
import { FiltroPeriodo } from "@/components/dashboard/filtro-periodo";
import { SelectorFuente } from "@/components/dashboard/selector-fuente";
import { BurbujasMarcaChart, type Burbuja } from "@/components/charts/burbujas-marca-chart";
import { BurbujasPrecioChart } from "@/components/charts/burbujas-precio-chart";
import { TablaVersiones } from "@/components/dashboard/tabla-versiones";
import { Seccion } from "@/components/dashboard/seccion";
import {
  getCobertura, getOpcionesFiltro, getRankingModelos, getRankingVersiones,
  type Fuente,
} from "@/lib/cadam/mercado";
import { getBurbujasVersion } from "@/lib/informes/propios";
import { asignarSegmento, SIN_CLASIFICAR } from "@/lib/informes/segmento-version";
import { getMarcasPropiasSet } from "@/lib/cadam/config";
import { formatPct, formatUnidades } from "@/lib/format";
import { etiquetaPeriodo, filtroDesdeUrl, type SearchParams } from "@/lib/periodo";

/** Unidades mínimas del período anterior para que un modelo entre al
 *  gráfico. Es lo que hace legible el eje, no un capricho: sobre los datos
 *  de Ene–Jun 2026 el universo completo llega a +8700% (un modelo que pasó
 *  de 1 a 88 unidades) y aplasta a los otros 370 contra el piso. Con base
 *  ≥20 el rango cae a ~555% conservando el 87% del volumen. */
const BASE_MINIMA = 20;

/** Marcas por volumen que se grafican. Sin tope entraban ~40 columnas en
 *  860px: etiquetas ilegibles y una cola de marcas con una burbuja suelta
 *  cada una. Las propias entran SIEMPRE, aunque no lleguen al tope. */
const TOPE_MARCAS = 15;

/** Techo del eje de variación, en %. Sobre Ene–Jun 2026 la mediana es +36% y
 *  el percentil 90 es +127%, pero el máximo llega a +555% (CHERY T2): sin
 *  techo, 91 de las 97 burbujas quedan aplastadas contra la línea del 0%.
 *  Cortando en 150 se recupera ~4x de alto útil y solo 6 quedan en el borde,
 *  dibujadas como triángulo y con su valor real en el tooltip.
 *
 *  No hace falta piso: una caída no puede pasar de -100%. */
const TECHO_VARIACION = 150;

export default async function BubbleChartPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const fuente: Fuente = sp.fuente === "importacion" ? "importacion" : "matriculacion";
  const cobertura = getCobertura();
  const ultimo = fuente === "importacion"
    ? cobertura.importacion.ultimo
    : cobertura.matriculacion.ultimo;
  const f = filtroDesdeUrl(sp, ultimo);
  const periodo = etiquetaPeriodo(f.anio, f.mesDesde, f.mesHasta);
  const etiquetaFuente = fuente === "importacion" ? "importaciones" : "matriculaciones";

  const anios = fuente === "importacion"
    ? cobertura.importacion.anios
    : cobertura.matriculacion.anios;
  const mesMax: Record<number, number> = {};
  for (const a of anios) {
    mesMax[a] = a === ultimo?.anio ? ultimo.mes : 12;
  }

  const modelos = getRankingModelos(fuente, f, 600);

  // Solo entran los que tienen base comparable Y la superan. `variacion`
  // viene null cuando el modelo no existía el año anterior: esos no se
  // pueden ubicar en un eje de porcentaje, no se estiman.
  const conBase = modelos.filter(
    (m) => m.variacion !== null && m.unidadesAnterior >= BASE_MINIMA
  );

  // Top de marcas por volumen dentro de lo comparable, MÁS las propias
  // siempre. No es un capricho: con los datos de Ene–Jun 2026, MITSUBISHI
  // queda 17ª y RENAULT más abajo — un top 15 estricto dejaba el tablero de
  // Santa Rosa sin sus propias marcas.
  const volPorMarca = new Map<string, number>();
  for (const m of conBase) {
    volPorMarca.set(m.marca, (volPorMarca.get(m.marca) ?? 0) + m.unidades);
  }
  const topMarcas = [...volPorMarca.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOPE_MARCAS)
    .map(([marca]) => marca);
  const marcasVisibles = new Set([
    ...topMarcas,
    ...conBase.filter((m) => m.esPropia).map((m) => m.marca),
  ]);
  const visibles = conBase.filter((m) => marcasVisibles.has(m.marca));

  const datos: Burbuja[] = visibles.map((m) => ({
    marca: m.marca,
    modelo: m.modelo ?? m.marca,
    unidades: m.unidades,
    unidadesAnterior: m.unidadesAnterior,
    variacion: m.variacion as number,
    esPropia: m.esPropia,
  }));

  const volTotal = modelos.reduce((s, m) => s + m.unidades, 0);
  const volGraficado = visibles.reduce((s, m) => s + m.unidades, 0);
  const entrantes = modelos.filter((m) => m.variacion === null).length;
  const bajoBase = modelos.length - conBase.length - entrantes;
  const fueraDelTope = conBase.length - visibles.length;
  const propiasForzadas = [...marcasVisibles].filter(
    (m) => !topMarcas.includes(m)
  );
  const recortadas = datos.filter((d) => d.variacion * 100 > TECHO_VARIACION);

  // Las versiones ('HILUX D/C 4X4 SRV AUT') solo existen en matriculacion:
  // la base de importacion no las trae. Con fuente=importacion la tabla no
  // se muestra en vez de inventar un equivalente.
  const versiones = fuente === "matriculacion" ? getRankingVersiones(f, 400) : [];

  const opciones = getOpcionesFiltro();

  // La lista de modelos sale de los datos ya filtrados, no de un catálogo
  // fijo: al elegir una marca (o un segmento) el desplegable se achica solo
  // a los modelos que existen en ese corte, en vez de ofrecer 600 sueltos.
  // Vienen ordenados por volumen porque getRankingModelos ya rankea.
  const modelosDisponibles = [
    ...new Set(modelos.map((m) => m.modelo).filter((m): m is string => !!m)),
  ];

  // Posicionamiento por VERSION contra precio. El precio no existe en CADAM:
  // sale del API de Cars, que solo tiene la gama propia. Por eso este corte
  // es de nuestras marcas y no del mercado — no hay precios de competencia a
  // nivel version en ninguna fuente que tengamos.
  const dd = (m: number) => String(m).padStart(2, "0");
  const burbujasPrecio = await getBurbujasVersion(
    `${f.anio}-${dd(f.mesDesde)}`,
    `${f.anio}-${dd(f.mesHasta)}`
  ).catch(() => []);
  const propiasSet = getMarcasPropiasSet();
  // SOLO las marcas del grupo. El stock de Cars también tiene canje y usados
  // (BMW, KARRY, CHANGAN... con una unidad cada una): en la captura que
  // motivó el rediseño, esa cola ocupaba MEDIA PANTALLA con una burbuja
  // suelta por columna. Se cuentan aparte en la nota, no se grafican.
  const ordenPrecio = burbujasPrecio
    .filter((b) => propiasSet.has(b.marca))
    .sort((a, b) => b.unidades - a.unidades);
  const canje = burbujasPrecio.length - ordenPrecio.length;
  const unidadesBurbujas = ordenPrecio.reduce((s, b) => s + b.unidades, 0);

  // Segmento por versión, desde CADAM. Se toma el año entero del filtro y el
  // anterior, no solo la ventana de meses: el segmento es una propiedad del
  // modelo, no del período, y una versión facturada en marzo puede recién
  // matricularse en agosto. Sin filtro de marca ni segmento: es un catálogo.
  const anioEntero = { anio: f.anio, mesDesde: 1, mesHasta: 12 };
  const catalogoCadam = [
    ...getRankingModelos("matriculacion", anioEntero, 5000),
    ...getRankingModelos("matriculacion", { ...anioEntero, anio: f.anio - 1 }, 5000),
  ]
    .filter((m) => m.esPropia && m.modelo && m.segmento)
    .map((m) => ({ marca: m.marca, modelo: m.modelo as string, segmento: m.segmento as string }));
  const conSegmento = asignarSegmento(ordenPrecio, catalogoCadam);
  const sinClasificar = conSegmento.filter((b) => b.segmento === SIN_CLASIFICAR);
  const unidadesSinClasificar = sinClasificar.reduce((s, b) => s + b.unidades, 0);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        titulo="Bubble chart"
        descripcion={`Cada burbuja es un modelo, agrupado en la columna de su marca · ${etiquetaFuente} · ${periodo} vs. mismo período ${f.anio - 1}.`}
        fuente={`Fuente: CADAM / DNRA · snapshot ${cobertura.snapshot ?? "—"}.`}
      />

      <div className="-mx-1 flex flex-col gap-3 rounded-xl px-1 py-1 sm:sticky sm:top-16 sm:z-30 sm:flex-row sm:flex-wrap sm:items-end sm:bg-background/85 sm:backdrop-blur-md">
        <SelectorFuente fuente={fuente} />
        <div className="min-w-0 sm:flex-1">
          <FiltroPeriodo
            pegajoso={false}
            anios={anios}
            mesMaximoPorAnio={mesMax}
            opciones={[
              { param: "marca", label: "Marca", valores: opciones.marcas },
              { param: "modelo", label: "Modelo", valores: modelosDisponibles },
              { param: "segmento", label: "Segmento", valores: opciones.segmentos },
              ...(fuente === "importacion"
                ? []
                : [{
                    param: "tecnologia",
                    label: "Tecnología",
                    valores: ["ICE", "MHEV", "HEV", "PHEV", "REEV", "EV"],
                  }]),
            ]}
          />
        </div>
      </div>

      <NotaDato>
        El eje vertical es la <strong>variación %</strong>, no el precio: la base
        de CADAM trae unidades, no importes. Como el porcentaje se dispara sobre
        bases chicas, sólo entran los modelos con al menos{" "}
        <strong>{BASE_MINIMA} unidades</strong> en {f.anio - 1}, y sólo las{" "}
        <strong>{TOPE_MARCAS} marcas de mayor volumen</strong>
        {propiasForzadas.length > 0 && (
          <> más las propias ({propiasForzadas.join(", ")}), que entran siempre</>
        )}
        . Se grafican <strong>{visibles.length}</strong> de {modelos.length}{" "}
        modelos, el{" "}
        <strong>{volTotal ? formatPct(volGraficado / volTotal) : "—"}</strong> del
        volumen del período. Fuera quedan {entrantes} modelos nuevos (sin año
        anterior contra qué comparar), {bajoBase} por debajo de la base mínima y{" "}
        {fueraDelTope} de marcas que no llegan al tope.
      </NotaDato>

      <Seccion titulo="Posicionamiento por variación">
      <Card>
        <CardHeader>
          <CardTitle>Crecimiento por modelo — {etiquetaFuente}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="pb-3 text-xs text-muted-foreground">
            Eje Y = variación contra {f.anio - 1} · tamaño = unidades del período ·
            las marcas propias van primero, con borde y su nombre resaltado en el
            eje. Arriba de la línea del 0% crecen, abajo caen; el tamaño dice
            cuánto pesa ese crecimiento.
            {recortadas.length > 0 && (
              <>
                {" "}El eje corta en +{TECHO_VARIACION}%:{" "}
                <strong>{recortadas.length}</strong>{" "}
                {recortadas.length === 1 ? "modelo se sale" : "modelos se salen"} y
                {recortadas.length === 1 ? " queda dibujado" : " quedan dibujados"}{" "}
                como triángulo en el tope —{" "}
                {[...recortadas]
                  .sort((a, b) => b.variacion - a.variacion)
                  .slice(0, 3)
                  .map((d) => `${d.marca} ${d.modelo} ${formatPct(d.variacion, { signed: true })}`)
                  .join(", ")}
                {recortadas.length > 3 ? " y otros" : ""}. El valor real está en el
                tooltip de cada uno.
              </>
            )}
          </p>
          <BurbujasMarcaChart datos={datos} techo={TECHO_VARIACION} />
        </CardContent>
      </Card>

      </Seccion>

      {ordenPrecio.length > 0 && (
        <Seccion titulo="Posicionamiento por versión">
        <Card>
          <CardHeader>
            <CardTitle>Bubble chart por segmento y versión</CardTitle>
            <p className="text-xs text-muted-foreground">
              Una burbuja por versión · eje X = segmento · eje Y = precio de
              lista · tamaño = unidades · color = marca. Lo que comparte columna
              compite entre sí.
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <BurbujasPrecioChart
              datos={conSegmento.map((b) => ({
                marca: b.marca,
                familia: b.modelo,
                version: b.version,
                segmento: b.segmento,
                unidades: b.unidades,
                precio: b.precio,
                moneda: "US$",
              }))}
              altura={520}
            />
            <NotaDato>
              El precio sale del <strong>API de Cars</strong>, que solo conoce
              nuestra gama: por eso acá están nuestras marcas y no el mercado
              entero. CADAM no trae importes, así que no hay precio de
              competencia a nivel versión en ninguna fuente que tengamos —
              lo público de la competencia vive en el benchmark de Hermes, que
              cubre pocos modelos. El <strong>segmento</strong> tampoco está en
              Cars: se cruza contra el nombre de la versión en CADAM, y lo que no
              cruza va a «Sin clasificar» en vez de adivinarse
              {sinClasificar.length > 0 ? (
                <>
                  {" "}— {sinClasificar.length}{" "}
                  {sinClasificar.length === 1 ? "versión" : "versiones"},{" "}
                  {formatUnidades(unidadesSinClasificar)} u.:{" "}
                  {[...sinClasificar]
                    .sort((a, b) => b.unidades - a.unidades)
                    .slice(0, 3)
                    .map((b) => `${b.marca} ${b.version}`)
                    .join(", ")}
                  {sinClasificar.length > 3 ? " y otras" : ""}
                </>
              ) : (
                ""
              )}
              . {ordenPrecio.length} versiones con precio,{" "}
              {formatUnidades(unidadesBurbujas)} unidades facturadas en el
              período; las versiones sin precio en Cars quedan fuera del
              gráfico porque no tendrían dónde ubicarse en el eje
              {canje > 0
                ? `, y las ${canje} versiones de canje y usados (marcas que no distribuimos, una unidad cada una) también: están en /operacion`
                : ""}
              .
            </NotaDato>
          </CardContent>
        </Card>
        </Seccion>
      )}

      {versiones.length > 0 && (
        <Seccion titulo="Ranking por versión">
        <Card>
          <CardHeader>
            <CardTitle>Ranking de competidores por versión</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="pb-3 text-xs text-muted-foreground">
              {versiones.length} versiones · el Δ compara <strong>puntos de
              share</strong>, no unidades: entre {f.anio - 1} y {f.anio} el
              mercado cambió de tamaño, así que las unidades de los dos períodos
              no son comparables entre sí — el share sí. Una versión puede vender
              más y aun así ceder terreno.
            </p>
            <TablaVersiones filas={versiones} />
          </CardContent>
        </Card>
        </Seccion>
      )}
    </div>
  );
}
