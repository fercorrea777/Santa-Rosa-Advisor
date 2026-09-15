import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NotaDato, PageHeader } from "@/components/dashboard/page-header";
import { Pagina } from "@/components/movimiento/pagina";
import { FiltroPeriodo } from "@/components/dashboard/filtro-periodo";
import { SelectorFuente, type FuenteVista } from "@/components/dashboard/selector-fuente";
import { BurbujasMarcaChart, type Burbuja } from "@/components/charts/burbujas-marca-chart";
import { BurbujasPrecioChart } from "@/components/charts/burbujas-precio-chart";
import { BatallaModeloChart } from "@/components/charts/batalla-modelo-chart";
import { getBatalla } from "@/lib/informes/batalla";
import { TablaVersiones } from "@/components/dashboard/tabla-versiones";
import { Seccion } from "@/components/dashboard/seccion";
import {
  getCobertura, getOpcionesFiltro, getRankingModelos, getRankingVersiones,
  type Fuente,
} from "@/lib/cadam/mercado";
import { getBurbujasVersion, getStockPropio } from "@/lib/informes/propios";
import { getPreciosCompetencia } from "@/lib/informes/precios-competencia";
import {
  asignarPrecios, claveModelo, fichasDeModelos, type PrecioCandidato,
} from "@/lib/cadam/bandas";
import { asignarSegmento, SIN_CLASIFICAR, tokens } from "@/lib/informes/segmento-version";
import { getMarcasPropiasSet } from "@/lib/cadam/config";
import { formatPct, formatUnidades } from "@/lib/format";
import { etiquetaPeriodo, filtroDesdeUrl, mesCorto, type SearchParams, etiquetaCortes } from "@/lib/periodo";

const NOMBRE: Record<Fuente, string> = { matriculacion: "matriculaciones", importacion: "importaciones" };

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
  const cobertura = getCobertura();
  // Tres vistas (Croman, 15/09/2026: "el mismo selector en Bubble chart").
  // Con "Ambas", el gráfico de crecimiento por modelo va dos veces, uno por
  // fuente y cada uno hasta su propio último mes. El resto de la pantalla
  // (batalla de producto, posicionamiento por versión) no depende de la
  // fuente: sale del Excel de producto y de Cars.
  const vista: FuenteVista =
    sp.fuente === "importacion" ? "importacion" : sp.fuente === "ambas" ? "ambas" : "matriculacion";
  const fuentes: Fuente[] = vista === "ambas" ? ["matriculacion", "importacion"] : [vista];
  const fuente: Fuente = fuentes[0];
  const ultimo = cobertura[fuente].ultimo;
  const f = filtroDesdeUrl(sp, ultimo);
  const periodo = etiquetaPeriodo(f.anio, f.mesDesde, f.mesHasta);
  const ventanaDe = (x: Fuente) => {
    const ult = cobertura[x].ultimo;
    if (!ult || f.anio !== ult.anio) return f;
    if (sp.hasta) return f.mesHasta > ult.mes ? { ...f, mesHasta: Math.max(f.mesDesde, ult.mes) } : f;
    return { ...f, mesHasta: Math.max(f.mesDesde, ult.mes) };
  };

  const ultMat = cobertura.matriculacion.ultimo;
  const ultImp = cobertura.importacion.ultimo;
  const desparejas = !!ultMat && !!ultImp && (ultMat.anio !== ultImp.anio || ultMat.mes !== ultImp.mes);
  const aclaracion = desparejas && ultMat && ultImp
    ? `Matriculaciones hasta ${mesCorto(ultMat.mes)} · importaciones hasta ${mesCorto(ultImp.mes)}: CADAM ya publicó la importación de ${mesCorto(ultImp.mes)}, la matriculación de ese mes todavía no.`
    : undefined;

  const anios = cobertura[fuente].anios;
  const mesMax: Record<number, number> = {};
  for (const a of anios) {
    mesMax[a] = a === ultimo?.anio ? ultimo.mes : 12;
  }

  /** El gráfico de crecimiento de una fuente: qué modelos entran y por qué
   *  no entran los demás. Se arma una vez por fuente. */
  const armarBloque = (x: Fuente) => {
    const fx = ventanaDe(x);
    const modelos = getRankingModelos(x, fx, 600);

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
    const propiasForzadas = [...marcasVisibles].filter((m) => !topMarcas.includes(m));
    const recortadas = datos.filter((d) => d.variacion * 100 > TECHO_VARIACION);
    return {
      fuente: x, f: fx, periodo: etiquetaPeriodo(fx.anio, fx.mesDesde, fx.mesHasta),
      modelos, visibles, datos, volTotal, volGraficado, entrantes, bajoBase, fueraDelTope,
      propiasForzadas, recortadas,
    };
  };
  const bloques = fuentes.map(armarBloque);
  const principal = bloques[0];
  const modelos = principal.modelos;

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
  // La batalla por modelo del equipo de producto (Excel), si Hermes ya la cargó.
  const batalla = getBatalla();
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
    .map((m) => ({
      marca: m.marca,
      modelo: m.modelo as string,
      segmento: m.segmento as string,
      tecnologia: m.tecnologia,
    }));
  const conSegmento = asignarSegmento(ordenPrecio, catalogoCadam);
  const sinClasificar = conSegmento.filter((b) => b.segmento === SIN_CLASIFICAR);
  const unidadesSinClasificar = sinClasificar.reduce((s, b) => s + b.unidades, 0);

  // --- fichas de modelo: contra quién compite cada burbuja ------------------
  // El gráfico contesta "quién está dónde"; la ficha contesta la pregunta que
  // sigue. Los rivales salen de la CLASE (clases.ts), igual que en «Dónde
  // competir»: el segmento de CADAM pone una X50 al lado de una Fortuner.
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
  const universo = asignarPrecios(modelos, listasPrecio);
  // Una ficha por fuente: los rivales de un modelo importado son los otros
  // modelos importados, no los matriculados.
  const fichasPorFuente = new Map(
    bloques.map((b) => [b.fuente, fichasDeModelos(b.fuente === fuente ? universo : asignarPrecios(b.modelos, listasPrecio))])
  );

  // Las claves que hacen falta: los modelos dibujados en el primer gráfico y
  // las familias de nuestras versiones en el segundo. Nada más: cada ficha
  // arrastra hasta doce rivales y el payload lo paga el navegador.
  const porClaveUniverso = new Map(universo.map((m) => [claveModelo(m.marca, m.modelo), m]));
  /** La familia de Cars ("L200 TRITON") contra el modelo de CADAM ("L200"):
   *  la clave exacta y, si no, el candidato de la misma marca que ARRANCA con
   *  la misma palabra, el que más palabras comparta. Exigir la primera es lo
   *  que evita que un "X200" cruce con cualquier cosa; aun así un "TANK 700"
   *  que CADAM todavía no registró cae en otro TANK, y por eso la ficha de una
   *  versión no afirma unidades del modelo (ver detalle-modelo.tsx). */
  const claveDeFamilia = (marca: string, familia: string): string | undefined => {
    const exacta = claveModelo(marca, familia);
    if (porClaveUniverso.has(exacta)) return exacta;
    const tf = tokens(familia);
    if (!tf.length) return undefined;
    const hallado = universo
      .filter((m) => m.marca === marca && tokens(m.modelo)[0] === tf[0])
      .map((m) => ({ m, comunes: new Set(tokens(m.modelo).filter((t) => tf.includes(t))).size }))
      .sort((a, b) => b.comunes - a.comunes || b.m.unidades - a.m.unidades)[0];
    return hallado ? claveModelo(hallado.m.marca, hallado.m.modelo) : undefined;
  };
  const burbujasConClave = conSegmento.map((b) => ({
    ...b,
    claveDetalle: claveDeFamilia(b.marca, b.modelo),
  }));
  const fichas = fichasPorFuente.get(fuente) ?? [];
  const clasePorClave = new Map(fichas.map((x) => [x.clave, x.clase]));
  /** La clase de cada versión: la de su familia en CADAM. Es la columna del
   *  gráfico de precios, en vez del segmento — misma razón que en el mapa. */
  const claseDeBurbuja = (clave: string | undefined, b: { segmento: string }) =>
    (clave ? clasePorClave.get(clave) : undefined) ?? b.segmento;

  return (
    <Pagina>
      <PageHeader
        titulo="Bubble chart"
        descripcion={`Cada burbuja es un modelo, agrupado en la columna de su marca · ${bloques.map((b) => `${NOMBRE[b.fuente]} ${b.periodo}`).join(" · ")} vs. mismo período ${f.anio - 1}.`}
        fuente={`Fuente: CADAM / DNRA · ${etiquetaCortes(cobertura)}.`}
      />

      <div
        data-revelar=""
        className="-mx-1 flex flex-col gap-3 rounded-xl px-1 py-1 sm:sticky sm:top-16 sm:z-30 sm:flex-row sm:flex-wrap sm:items-start sm:bg-background/85 sm:backdrop-blur-md"
      >
        <SelectorFuente porDefecto="matriculacion" fuente={vista} conAmbas aclaracion={aclaracion} />
        <div className="min-w-0 sm:flex-1">
          <FiltroPeriodo
            pegajoso={false}
            anios={anios}
            mesMaximoPorAnio={mesMax}
            opciones={[
              { param: "marca", label: "Marca", valores: opciones.marcas },
              { param: "modelo", label: "Modelo", valores: modelosDisponibles },
              { param: "segmento", label: "Segmento", valores: opciones.segmentos },
              ...(fuentes.includes("matriculacion")
                ? [{
                    param: "tecnologia",
                    label: "Tecnología",
                    valores: ["ICE", "MHEV", "HEV", "PHEV", "REEV", "EV"],
                  }]
                : []),
            ]}
          />
        </div>
      </div>

      <Seccion titulo="Batalla por modelo"
        nota="El cuadro que arma producto: cada modelo contra sus rivales de verdad, por precio y por volumen, con las medidas de cada versión.">
        {batalla ? (
          <>
            <NotaDato>
              El bubble chart del <strong>equipo de producto</strong>, tal cual está en sus
              planillas ({batalla.archivos?.length ?? 1} archivos, una por marca; cargados el{" "}
              {batalla.cargado_en.slice(0, 10)}): por cada modelo nuestro, las versiones rivales
              que ellos eligieron, con precio de lista, medidas y volumen. Cada hoja tiene su
              propio período, que se muestra arriba del gráfico: no todas están al mismo mes.
              Nada se cruza con CADAM ni con Datacar acá: se dibuja lo que dice el Excel, y
              cuando el Excel cambia, se vuelve a cargar solo.
            </NotaDato>
            <BatallaModeloChart modelos={batalla.modelos} propias={[...propiasSet]} />
          </>
        ) : (
          <Card>
            <CardContent className="py-8 text-sm text-muted-foreground">
              Todavía no se cargó la planilla de producto (JETOUR_PY_BBCH_*.xlsx). La carga
              Hermes desde la carpeta del tablero con <code>advisor-batalla.sh</code>.
            </CardContent>
          </Card>
        )}
      </Seccion>

      <NotaDato>
        El eje vertical es la <strong>variación %</strong>, no el precio: la base
        de CADAM trae unidades, no importes. Como el porcentaje se dispara sobre
        bases chicas, sólo entran los modelos con al menos{" "}
        <strong>{BASE_MINIMA} unidades</strong> en {f.anio - 1}, y sólo las{" "}
        <strong>{TOPE_MARCAS} marcas de mayor volumen</strong> más las propias, que
        entran siempre.
        {bloques.map((b) => (
          <span key={b.fuente}>
            {" "}En {NOMBRE[b.fuente]} ({b.periodo}) se grafican <strong>{b.visibles.length}</strong> de{" "}
            {b.modelos.length} modelos, el{" "}
            <strong>{b.volTotal ? formatPct(b.volGraficado / b.volTotal) : "—"}</strong> del
            volumen; fuera quedan {b.entrantes} modelos nuevos (sin año anterior contra
            qué comparar), {b.bajoBase} por debajo de la base mínima y {b.fueraDelTope} de
            marcas que no llegan al tope
            {b.propiasForzadas.length > 0 ? ` (propias que entran igual: ${b.propiasForzadas.join(", ")})` : ""}.
          </span>
        ))}
      </NotaDato>

      <Seccion titulo="Posicionamiento por variación"
        nota="Qué modelos crecen y cuáles se caen, y con cuánto volumen: arriba a la derecha están los que crecen y ya pesan.">
      {bloques.map((b) => (
      <Card key={b.fuente}>
        <CardHeader>
          <CardTitle>Crecimiento por modelo — {NOMBRE[b.fuente]} · {b.periodo}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="pb-3 text-xs text-muted-foreground">
            Eje Y = variación contra {b.f.anio - 1} · tamaño = unidades del período ·
            las marcas propias van primero, con borde y su nombre resaltado en el
            eje. Arriba de la línea del 0% crecen, abajo caen; el tamaño dice
            cuánto pesa ese crecimiento. <strong>Tocá una burbuja</strong> y se
            abre la ficha del modelo: su clase, contra quién compite, a qué
            precio y cómo viene contra el año pasado.
            {b.recortadas.length > 0 && (
              <>
                {" "}El eje corta en +{TECHO_VARIACION}%:{" "}
                <strong>{b.recortadas.length}</strong>{" "}
                {b.recortadas.length === 1 ? "modelo se sale" : "modelos se salen"} y
                {b.recortadas.length === 1 ? " queda dibujado" : " quedan dibujados"}{" "}
                como triángulo en el tope —{" "}
                {[...b.recortadas]
                  .sort((x, y) => y.variacion - x.variacion)
                  .slice(0, 3)
                  .map((d) => `${d.marca} ${d.modelo} ${formatPct(d.variacion, { signed: true })}`)
                  .join(", ")}
                {b.recortadas.length > 3 ? " y otros" : ""}. El valor real está en el
                tooltip de cada uno.
              </>
            )}
          </p>
          <BurbujasMarcaChart
            datos={b.datos}
            techo={TECHO_VARIACION}
            fichas={fichasPorFuente.get(b.fuente) ?? []}
            periodo={b.periodo}
            fuente={b.fuente}
          />
        </CardContent>
      </Card>
      ))}

      </Seccion>

      {ordenPrecio.length > 0 && (
        <Seccion titulo="Posicionamiento por versión"
        nota="El mismo cruce de precio y volumen, pero versión por versión: es el nivel al que el cliente elige.">
        <Card>
          <CardHeader>
            <CardTitle>Bubble chart por clase y versión</CardTitle>
            <p className="text-xs text-muted-foreground">
              Una burbuja por versión · eje X = clase de vehículo · eje Y =
              precio de lista · tamaño = unidades · color = marca. Lo que
              comparte columna compite entre sí: la clase separa el SUV chico
              del grande, cosa que el segmento de CADAM no hace.{" "}
              <strong>Tocá una burbuja</strong> y se abre contra quién compite
              esa versión, a qué precio está cada rival y si estamos caros o
              baratos.
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <BurbujasPrecioChart
              datos={burbujasConClave.map((b) => ({
                marca: b.marca,
                familia: b.modelo,
                version: b.version,
                segmento: claseDeBurbuja(b.claveDetalle, b),
                tecnologia: b.tecnologia,
                unidades: b.unidades,
                precio: b.precio,
                moneda: "US$",
                claveDetalle: b.claveDetalle,
              }))}
              altura={520}
              fichas={fichas}
              periodo={periodo}
              etiquetaColumna="Clase"
            />
            <NotaDato>
              El precio sale del <strong>API de Cars</strong>, que solo conoce
              nuestra gama: por eso acá están nuestras marcas y no el mercado
              entero. CADAM no trae importes, así que no hay precio de
              competencia a nivel versión en ninguna fuente que tengamos —
              lo público de la competencia sale del relevamiento de precios, que
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
    </Pagina>
  );
}
