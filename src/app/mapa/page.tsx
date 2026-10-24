import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LogoMarca } from "@/components/dashboard/logo-marca";
import { NotaDato, PageHeader } from "@/components/dashboard/page-header";
import { Pagina } from "@/components/movimiento/pagina";
import { FiltroPeriodo } from "@/components/dashboard/filtro-periodo";
import { SelectorFuente } from "@/components/dashboard/selector-fuente";
import { Seccion } from "@/components/dashboard/seccion";
import { SelectorVista } from "@/components/dashboard/selector-vista";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  getCobertura, getModelosPorTecnologia, getPorDimension, getRankingModelos, TECNOLOGIAS,
  type Fuente,
} from "@/lib/cadam/mercado";
import {
  armarMapa, asignarPrecios, BANDAS, etiquetaBandaI18n, lecturaCasillero, PESO_PROPIO, PESO_RELEVANTE,
  precioRelativo, rivalesDirectos, SHARE_AUSENTE, SHARE_FUERTE, SIN_PRECIO,
  type LecturaCasillero, type ModeloConBanda, type PrecioCandidato, type Rival,
} from "@/lib/cadam/bandas";
import { MapaClases, type CeldaMapa } from "@/components/dashboard/mapa-clases";
import { claseDe, ordenClase } from "@/lib/cadam/clases";
import { SIN_DATO_TECNOLOGIA } from "@/lib/informes/segmento-version";
import { getStockPropio } from "@/lib/informes/propios";
import { getPreciosCompetencia } from "@/lib/informes/precios-competencia";
import { getI18n } from "@/lib/i18n/servidor";
import type { I18n } from "@/lib/i18n/crear";
import { filtroDesdeUrl, type SearchParams } from "@/lib/periodo";
import { cn } from "@/lib/utils";

/**
 * Dónde competir: el mercado por CLASE de vehículo (SUV chico, compacto,
 * mediano, grande; pick-up compacta, mediana, grande; auto chico, mediano;
 * camión liviano, mediano, pesado…) cruzada con banda de precio y con
 * motorización, cuánto de cada casillero es nuestro, y contra quién compite
 * cada modelo nuestro: los de su misma clase.
 *
 * La clase no está en CADAM (que solo dice SUV / Pick Up / Automóvil…) ni
 * en Datacar: vive en lib/cadam/clases.ts, escrita sobre los nombres reales
 * del mercado. Es lo que hace que la X50 se compare con Creta, Sonet y
 * Fronx y no con la Fortuner, y la L200 con Hilux, Ranger y Frontier
 * aunque estén una banda de precio más arriba.
 */

/** Clases con menos de esto en el período no se dibujan: una fila con
 *  tres unidades no dice nada y roba espacio. Se cuentan en la nota. */
const MINIMO_CLASE = 50;
/** Rivales que se muestran de entrada por modelo; el resto queda plegado
 *  con un "Ver N más", no afuera. */
const RIVALES_A_LA_VISTA = 8;

export default async function MapaPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const i18n = await getI18n();
  const { t, tr, fmt } = i18n;
  const { formatFecha, formatPct, formatUnidades, etiquetaPeriodo, aclaracionCortes } = fmt;
  const sp = await searchParams;
  const cobertura = getCobertura();
  // Fuente de las unidades (Croman, 15/09/2026: "el mismo selector en Dónde
  // competir"). Con importación, el mapa de precios y los rivales se arman
  // con lo que entró al país hasta su propio último mes; el mapa por
  // motorización no existe, porque la base de importación no la trae.
  const fuente: Fuente = sp.fuente === "importacion" ? "importacion" : "matriculacion";
  const esImportacion = fuente === "importacion";
  const nombreFuente = esImportacion ? t("importaciones") : t("matriculaciones");
  const f = filtroDesdeUrl(sp, cobertura[fuente].ultimo);
  const periodo = etiquetaPeriodo(f.anio, f.mesDesde, f.mesHasta);
  const mesMax: Record<number, number> = {};
  for (const a of cobertura[fuente].anios) {
    mesMax[a] = a === cobertura[fuente].ultimo?.anio ? cobertura[fuente].ultimo.mes : 12;
  }
  const aclaracion = aclaracionCortes(cobertura);
  const rango = { anio: f.anio, mesDesde: f.mesDesde, mesHasta: f.mesHasta };
  // La clase es un param propio de esta pantalla (no está en filtroDesdeUrl).
  const claseFiltro = typeof sp.clase === "string" && sp.clase && sp.clase !== "todos" ? sp.clase : undefined;

  // Opciones del filtro de tipo: todos los tipos del período. No se le
  // aplica el filtro de tipo, si no la lista se reduciría a lo elegido.
  const opcionesSegmento = getPorDimension(fuente, "segmento", { ...rango, tecnologia: f.tecnologia })
    .map((d) => d.valor);

  // Unidades: CADAM, todas las marcas. Sin filtro de marca: el mapa es el
  // mercado entero. Tipo y motorización sí se respetan, para mirar solo las
  // pick-ups o solo los enchufables.
  const modelos = getRankingModelos(
    fuente,
    { ...rango, segmento: f.segmento, tecnologia: f.tecnologia },
    3000
  );

  // Precios propios: stock de Cars (por versión). Si Cars no está, se dice.
  let propios: PrecioCandidato[] = [];
  let carsDisponible = true;
  try {
    const stock = await getStockPropio();
    propios = stock
      .filter((s) => s.precio_usd)
      .map((s) => ({ marca: s.marca, nombre: s.version, precio: s.precio_usd as number }));
  } catch {
    carsDisponible = false;
  }
  // Precios de la competencia: catálogo de terceros relevado por Hermes.
  const competencia = await getPreciosCompetencia();
  const rivales: PrecioCandidato[] = competencia.map((p) => ({ marca: p.marca, nombre: p.version, precio: p.precio_usd }));
  const fechaCompetencia = competencia[0]?.actualizado_en ?? null;
  const marcasConPrecio = [...new Set(competencia.map((p) => p.marca))].sort();

  const conTodo = asignarPrecios(modelos, [
    { fuente: "cars", lista: propios },
    { fuente: "datacar", lista: rivales },
  ]);
  const opcionesClase = [...new Set(conTodo.map((m) => m.clase))]
    .sort((a, b) => ordenClase(a) - ordenClase(b) || a.localeCompare(b))
    // El valor que viaja a la URL es la clase de siempre; lo que se lee, su nombre en el idioma.
    .map((c) => ({ valor: c, label: t(c) }));
  const con = claseFiltro ? conTodo.filter((m) => m.clase === claseFiltro) : conTodo;

  const mapa = armarMapa(con);
  const clasesMapa = mapa.clases.filter((c) => mapa.unidadesClase(c) >= MINIMO_CLASE);
  const clasesOmitidas = mapa.clases.length - clasesMapa.length;

  const total = con.reduce((s, m) => s + m.unidades, 0);
  const conPrecio = con.filter((m) => m.precio).reduce((s, m) => s + m.unidades, 0);
  const rivalesTotal = con.filter((m) => !m.esPropia).reduce((s, m) => s + m.unidades, 0);
  const rivalesConPrecio = con.filter((m) => !m.esPropia && m.precio).reduce((s, m) => s + m.unidades, 0);
  const propiasTotal = con.filter((m) => m.esPropia).reduce((s, m) => s + m.unidades, 0);
  const propiasConPrecio = con.filter((m) => m.esPropia && m.precio).reduce((s, m) => s + m.unidades, 0);
  const conClaseCatalogo = con.filter((m) => m.claseOrigen === "catalogo").reduce((s, m) => s + m.unidades, 0);
  const conClaseInferida = con.filter((m) => m.claseOrigen === "precio").reduce((s, m) => s + m.unidades, 0);

  // La columna "sin precio" no lleva marca de acción: es un hueco de
  // nuestros datos, no una posición del mercado. Lo mismo con "Sin dato" de
  // motorización.
  const columnasBanda = [
    ...BANDAS.map((b) => ({ clave: b.clave, etiqueta: etiquetaBandaI18n(b.clave, t, fmt) })),
    { clave: SIN_PRECIO, etiqueta: t("Sin precio conocido"), sinAccion: true },
  ];

  // Qué hacer en cada casillero del mapa de precios: pesa y no estamos ->
  // entrar; pesa y mandamos -> defender. El peso se mide sobre el mercado
  // efectivamente dibujado, igual que en la tabla.
  const celdasDibujadas = [...mapa.celdas.values()].filter((c) => clasesMapa.includes(c.clase));
  const totalDibujado = celdasDibujadas.reduce((s, c) => s + c.mercado, 0);
  const totalPropiasDibujado = celdasDibujadas.reduce((s, c) => s + c.propias, 0);
  const lecturas = celdasDibujadas
    .filter((c) => c.banda !== SIN_PRECIO)
    .map((c) => lecturaCasillero(c, totalDibujado, totalPropiasDibujado));
  const paraEntrar = lecturas
    .filter((l) => l.accion === "entrar")
    .sort((a, b) => b.celda.mercado - a.celda.mercado);
  const paraDefender = lecturas
    .filter((l) => l.accion === "defender")
    .sort((a, b) => b.celda.propias - a.celda.propias);

  // --- lo que viaja al navegador para el detalle al hacer clic. Se recortan
  // los modelos por casillero: el detalle es para decidir, no un volcado de
  // la base, y el peso de la página lo paga el gerente en su tablet.
  const MAX_MODELOS = 20;
  const aModelo = (m: ModeloConBanda) => ({
    marca: m.marca, modelo: m.modelo, unidades: m.unidades, precio: m.precio,
    tecnologia: m.tecnologia && m.tecnologia !== SIN_DATO_TECNOLOGIA ? m.tecnologia : undefined,
    esPropia: m.esPropia,
  });
  const celdasBanda: CeldaMapa[] = celdasDibujadas.map((c) => {
    const l = lecturaCasillero(c, totalDibujado, totalPropiasDibujado);
    return {
      fila: c.clase, columna: c.banda, mercado: c.mercado, propias: c.propias,
      modelos: c.modelos.slice(0, MAX_MODELOS).map(aModelo), modelosTotal: c.modelos.length,
      precioNuestro: l.precioNuestro, precioRival: l.precioRival,
      nPreciosNuestros: l.nPreciosNuestros, nPreciosRivales: l.nPreciosRivales,
    };
  });

  // --- mapa por motorización: mismo dibujo, columnas = tecnologías de CADAM.
  // La clase de cada modelo es la misma que en el mapa de precios (con el
  // precio ya cruzado, para que la inferencia coincida).
  const clasePorModelo = new Map(conTodo.map((m) => [`${m.marca}|${m.modelo}`, m.clase]));
  const precioPorModelo = new Map(conTodo.map((m) => [`${m.marca}|${m.modelo}`, m.precio]));
  // Solo matriculación: la base de importación no trae motorización.
  const filasTec = esImportacion ? [] : getModelosPorTecnologia({ ...rango, segmento: f.segmento });
  type CeldaTec = { mercado: number; propias: number; modelos: ModeloConBanda[] };
  const tecPorClase = new Map<string, Map<string, CeldaTec>>();
  const totalTecClase = new Map<string, number>();
  const codigosVistos = new Set<string>();
  for (const r of filasTec) {
    const clase = clasePorModelo.get(`${r.marca}|${r.modelo}`)
      ?? claseDe({ marca: r.marca, modelo: r.modelo, segmento: r.segmento }).clase;
    if (claseFiltro && clase !== claseFiltro) continue;
    const fila = tecPorClase.get(clase) ?? new Map<string, CeldaTec>();
    const celda = fila.get(r.tecnologia) ?? { mercado: 0, propias: 0, modelos: [] };
    celda.mercado += r.unidades;
    if (r.esPropia) celda.propias += r.unidades;
    // El detalle del casillero necesita el modelo con su precio: la clase y
    // el precio salen del mismo cruce que el mapa de arriba.
    celda.modelos.push({
      marca: r.marca, modelo: r.modelo, segmento: r.segmento, clase, claseOrigen: "catalogo",
      tecnologia: r.tecnologia, unidades: r.unidades, esPropia: r.esPropia,
      precio: precioPorModelo.get(`${r.marca}|${r.modelo}`) ?? null,
      precioMT: null, precioAT: null, precioHasta: null, versionesConPrecio: 0, precioDeFamilia: false,
      fuentePrecio: null, banda: "", deltaShare: null, variacion: null,
    });
    fila.set(r.tecnologia, celda);
    tecPorClase.set(clase, fila);
    totalTecClase.set(clase, (totalTecClase.get(clase) ?? 0) + r.unidades);
    codigosVistos.add(r.tecnologia);
  }
  for (const fila of tecPorClase.values()) {
    for (const c of fila.values()) c.modelos.sort((a, b) => b.unidades - a.unidades);
  }
  const clasesTec = [...totalTecClase.entries()]
    .filter(([, u]) => u >= MINIMO_CLASE)
    .map(([c]) => c)
    .sort((a, b) => ordenClase(a) - ordenClase(b) || a.localeCompare(b));
  // Orden fijo de las tecnologías; si CADAM trae un código nuevo, se agrega
  // al final antes de "Sin dato", no se pierde.
  const extras = [...codigosVistos].filter((c) => !(TECNOLOGIAS as readonly string[]).includes(c) && c !== SIN_DATO_TECNOLOGIA).sort();
  const columnasTec = [
    ...TECNOLOGIAS.filter((tec) => codigosVistos.has(tec)).map((tec) => ({ clave: tec, etiqueta: tec })),
    ...extras.map((tec) => ({ clave: tec, etiqueta: tec })),
    ...(codigosVistos.has(SIN_DATO_TECNOLOGIA) ? [{ clave: SIN_DATO_TECNOLOGIA, etiqueta: t("Sin dato"), sinAccion: true }] : []),
  ];
  // Mismo payload que el mapa de precios. El total va en 1 porque de esta
  // lectura solo se usan las medianas de precio: el peso de cada casillero lo
  // recalcula el componente sobre el mapa que dibuja.
  const celdasTec: CeldaMapa[] = [];
  for (const [clase, fila] of tecPorClase) {
    if (!clasesTec.includes(clase)) continue;
    for (const [tec, c] of fila) {
      const l = lecturaCasillero({ clase, banda: tec, ...c }, 1);
      celdasTec.push({
        fila: clase, columna: tec, mercado: c.mercado, propias: c.propias,
        modelos: c.modelos.slice(0, MAX_MODELOS).map(aModelo), modelosTotal: c.modelos.length,
        precioNuestro: l.precioNuestro, precioRival: l.precioRival,
        nPreciosNuestros: l.nPreciosNuestros, nPreciosRivales: l.nPreciosRivales,
      });
    }
  }

  const duelos = rivalesDirectos(con).filter((d) => d.propio.unidades >= 5).slice(0, 25);
  const relativos = precioRelativo(con)
    .filter((p) => p.medianaClase !== null || p.medianaTipo !== null)
    .slice(0, 25);

  // Los segmentos llegan de CADAM tal cual («Automovil»): t() los deja así en castellano y en inglés les pone nombre.
  const recorte = [
    f.segmento ? t("solo {x}", { x: t(f.segmento) }) : null,
    claseFiltro ? t("solo {x}", { x: t(claseFiltro) }) : null,
    f.tecnologia ? t("solo {x}", { x: f.tecnologia }) : null,
  ].filter(Boolean).join(" · ");
  const recorteTxt = recorte ? ` · ${recorte}` : "";

  // Tres preguntas, tres pestañas (30/09/2026): la pantalla era una tira de
  // 13.000 px — los mapas, la lista de rivales de cada modelo nuestro (la
  // parte larga) y el precio contra el mercado, uno abajo del otro.
  const VISTAS = [
    { valor: "mapa", label: t("Mapas"), pista: t("Dónde está la plata del mercado y en qué casilleros estamos o no.") },
    { valor: "rivales", label: t("Rivales por modelo"), pista: t("Contra quién compite cada modelo nuestro en el salón.") },
    { valor: "precio", label: t("Caros o baratos"), pista: t("Nuestro precio contra el de la misma caja en el mercado.") },
  ];
  const vistaPedida = Array.isArray(sp.vista) ? sp.vista[0] : sp.vista;
  const vista = VISTAS.some((v) => v.valor === vistaPedida) ? (vistaPedida as string) : "mapa";

  const varsDescripcion = { fuente: nombreFuente, periodo, recorte: recorteTxt };
  const relevado = fechaCompetencia ? t(", relevado el {fecha}", { fecha: formatFecha(fechaCompetencia) }) : "";

  return (
    <Pagina>
      <PageHeader
        titulo={t("Dónde competir")}
        descripcion={esImportacion
          ? t("El mercado por clase de vehículo, banda de precio, cuánto de cada casillero es nuestro y contra quién compite cada modelo · {fuente} {periodo}{recorte}.", varsDescripcion)
          : t("El mercado por clase de vehículo, banda de precio y motorización, cuánto de cada casillero es nuestro y contra quién compite cada modelo · {fuente} {periodo}{recorte}.", varsDescripcion)}
        fuente={t("Fuente: CADAM (unidades y motorización) · Cars (nuestros precios) · Datacar (precios de la competencia, catálogo de terceros{relevado}) · clases de vehículo: catálogo propio.", { relevado })}
      />

      <div
        data-revelar=""
        className="-mx-1 flex flex-col gap-3 rounded-xl px-1 py-1 sm:sticky sm:top-16 sm:z-30 sm:flex-row sm:flex-wrap sm:items-start sm:bg-background/85 sm:backdrop-blur-md"
      >
        <SelectorFuente fuente={fuente} porDefecto="matriculacion" aclaracion={aclaracion} />
        <div className="min-w-0 sm:flex-1">
          <FiltroPeriodo
            pegajoso={false}
            anios={cobertura[fuente].anios}
            mesMaximoPorAnio={mesMax}
            opciones={[
              { param: "segmento", label: t("Tipo de vehículo"), valores: opcionesSegmento },
              { param: "clase", label: t("Clase"), valores: opcionesClase },
              ...(esImportacion
                ? []
                : [{ param: "tecnologia", label: t("Motorización"), valores: [...TECNOLOGIAS] }]),
            ]}
          />
        </div>
      </div>

      <SelectorVista
        vistas={VISTAS}
        porDefecto="mapa"
        anclas={{ mapa: "mapa", rivales: "rivales", "precio-relativo": "precio" }}
      />

      <NotaDato>
        {tr("<b>Qué es una clase.</b> CADAM solo distingue SUV, pick-up, automóvil, camión, furgón y minibús, y eso mete en la misma bolsa a una X50 de US$ 15.000 y a una Fortuner de US$ 52.000. La clase es el tamaño y el uso con el que el comprador compara de verdad: SUV chico, compacto, mediano, grande; pick-up compacta, mediana, grande; auto chico, mediano; camión liviano, mediano, pesado. No está en ninguna fuente: es un catálogo propio sobre los nombres reales del mercado ({pct} de las unidades del período).", {
          pct: formatPct(conClaseCatalogo / (total || 1)),
        })}
        {conClaseInferida > 0 && (
          <> {t("Lo que no está en el catálogo se ubica por precio y queda marcado «por precio» ({pct}).", { pct: formatPct(conClaseInferida / (total || 1)) })}</>
        )}{" "}
        {tr("<b>Cómo leer los mapas.</b> Cada casillero es una clase en una banda de precio (primer mapa) o en una motorización (segundo). El número grande es cuánto vendió el mercado ahí; debajo, cuánto de eso es nuestro y qué porcentaje representa. Un casillero grande donde nuestra parte es chica es donde falta producto o precio.")}{" "}
        {tr("<b>Precio y volumen no salen de la misma fuente:</b> las unidades y la motorización son de CADAM; los precios nuestros, del stock de Cars; los de la competencia, de un catálogo de terceros (Datacar, {n} marcas) — no es lista oficial. Lo que no tiene precio va a la última columna, no se adivina.", {
          n: marcasConPrecio.length,
        })}{" "}
        {total > 0 && (
          <>
            {tr("Cobertura de precio: <b>{pct}</b> de las unidades ({propias} de las nuestras, {rivales} de la competencia).", {
              pct: formatPct(conPrecio / total),
              propias: formatPct(propiasConPrecio / (propiasTotal || 1)),
              rivales: formatPct(rivalesConPrecio / (rivalesTotal || 1)),
            })}
          </>
        )}
        {!carsDisponible && (
          <> {tr("<b>Cars no respondió:</b> nuestros modelos quedan sin precio en esta corrida.")}</>
        )}
        {clasesOmitidas > 0 && (
          <> {clasesOmitidas === 1
            ? t("{n} clase con menos de {min} unidades no se dibujan.", { n: clasesOmitidas, min: MINIMO_CLASE })
            : t("{n} clases con menos de {min} unidades no se dibujan.", { n: clasesOmitidas, min: MINIMO_CLASE })}</>
        )}
      </NotaDato>

      {vista === "mapa" && (
      <Seccion titulo={t("Los mapas")}
        nota={t("Dónde está la plata del mercado: cuántas unidades se venden en cada cruce de clase y precio, y en cuáles de esos casilleros estamos o no estamos.")} id="mapa">
      <Card>
        <CardHeader>
          <CardTitle>{t("Mercado por clase y banda de precio — {periodo}", { periodo })}</CardTitle>
          <p className="text-xs text-muted-foreground">
            {t("Precios de lista en dólares. Arriba, lo que vendió el mercado; debajo, lo nuestro y su participación. Cuanto más teñido el casillero, más parte nuestra. Las clases van de chico a grande.")}
          </p>
        </CardHeader>
        <CardContent>
          {clasesMapa.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t("Sin {fuente} en este recorte.", { fuente: nombreFuente })}</p>
          ) : (
            <MapaClases
              filas={clasesMapa}
              columnas={columnasBanda}
              celdas={celdasBanda}
              tipoColumna="precio"
              periodo={periodo}
              fuente={fuente}
            />
          )}
        </CardContent>
      </Card>

      {esImportacion ? (
        <NotaDato>
          {tr("<b>El mapa por motorización solo existe en matriculación.</b> La base de importación de CADAM no dice si el vehículo es híbrido o eléctrico; con «Matriculaciones» vuelve a aparecer.")}
        </NotaDato>
      ) : (
      <Card>
        <CardHeader>
          <CardTitle>{t("Mercado por clase y motorización — {periodo}", { periodo })}</CardTitle>
          <p className="text-xs text-muted-foreground">
            {t("La motorización la informa CADAM en cada matriculación: ICE es combustión; MHEV, HEV y PHEV son híbridos (el PHEV se enchufa); REEV es eléctrico con motor de apoyo; EV, eléctrico puro. Mismo dibujo que el mapa de precios.")}
            {f.tecnologia ? ` ${t("El filtro de motorización no recorta este mapa: es la dimensión de sus columnas.")}` : ""}
          </p>
        </CardHeader>
        <CardContent>
          {clasesTec.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t("Sin matriculaciones en este recorte.")}</p>
          ) : (
            <MapaClases
              filas={clasesTec}
              columnas={columnasTec}
              celdas={celdasTec}
              tipoColumna="motorizacion"
              periodo={periodo}
            />
          )}
        </CardContent>
      </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("Qué hacer en cada casillero marcado — {periodo}", { periodo })}</CardTitle>
          <p className="text-xs text-muted-foreground">
            {tr("Los casilleros del mapa de precios que piden una decisión. <b>Entrar</b>: pesan al menos {relevante} del mercado y tenemos menos de {ausente}. <b>Defender</b>: de ahí sale al menos {propio} de todo lo que vendemos y tenemos más de {fuerte} del casillero. Con quién se lo lleva, a qué precio y qué margen de precio hay. Tocá cualquier casillero del mapa para ver la comparativa entera.", {
              relevante: formatPct(PESO_RELEVANTE),
              ausente: formatPct(SHARE_AUSENTE),
              propio: formatPct(PESO_PROPIO),
              fuerte: formatPct(SHARE_FUERTE),
            })}
          </p>
        </CardHeader>
        <CardContent>
          {paraEntrar.length === 0 && paraDefender.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("Ningún casillero de este recorte cumple los cortes.")}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold">
                  {t("Dónde entrar")}{" "}
                  <span className="font-normal text-muted-foreground">
                    {t("({n}) · el mercado compra y no estamos", { n: paraEntrar.length })}
                  </span>
                </h3>
                {paraEntrar.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("No hay casilleros grandes sin presencia nuestra.")}
                  </p>
                ) : (
                  paraEntrar.map((l) => <Casillero key={`${l.celda.clase}|${l.celda.banda}`} l={l} tipo="entrar" i18n={i18n} />)
                )}
              </div>
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold">
                  {t("Dónde mandamos")}{" "}
                  <span className="font-normal text-muted-foreground">
                    {t("({n}) · cuidar stock y precio", { n: paraDefender.length })}
                  </span>
                </h3>
                {paraDefender.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("Ningún casillero grande con participación nuestra alta.")}
                  </p>
                ) : (
                  paraDefender.map((l) => <Casillero key={`${l.celda.clase}|${l.celda.banda}`} l={l} tipo="defender" i18n={i18n} />)
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      </Seccion>
      )}

      {vista === "rivales" && (
      <Seccion titulo={t("Contra quién compite cada modelo nuestro")}
        nota={t("Los rivales que se le cruzan al cliente en el salón: los de la misma clase, no los de la misma marca ni los del mismo segmento de CADAM.")} id="rivales">
      <Card>
        <CardHeader>
          <CardTitle>{t("Rivales directos — los de su misma clase, del que más vende al que menos")}</CardTitle>
          <p className="text-xs text-muted-foreground">
            {tr("Para cada modelo nuestro con ventas, todos los modelos de la competencia en su misma clase, con unidades, precio de lista y motorización. Los de su misma banda de precio van marcados; los demás no quedan afuera: una pick-up mediana compite con todas las pick-ups medianas, esté una banda arriba o abajo. <b>Misma caja</b>: los que tienen versión de la misma transmisión que la nuestra van primero, con su precio en esa caja; los que no la dicen quedan atenuados. Los primeros {n} van a la vista; el resto, plegado.", {
              n: RIVALES_A_LA_VISTA,
            })}
          </p>
        </CardHeader>
        <CardContent>
          {duelos.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("Ningún modelo nuestro con ventas en este recorte.")}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("Nuestro modelo")}</TableHead>
                  <TableHead className="text-right" nota={esImportacion ? t("importados en el período") : t("matriculados en el período")}>
                    {esImportacion ? t("Importados") : t("Vendidos")}
                  </TableHead>
                  <TableHead className="text-right" nota={t("el más barato de la gama")}>{t("Precio")}</TableHead>
                  <TableHead nota={t("los que se le cruzan al cliente en el salón")}>
                    {t("Rivales de su clase (unidades · precio desde, MT y AT · motorización)")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {duelos.map((d) => {
                  // Con la caja conocida, primero los que se comparan de
                  // verdad (misma caja) y después el resto, sin perder el
                  // orden por volumen dentro de cada grupo.
                  const ordenados = d.caja
                    ? [...d.rivales].sort((a, b) => Number(!!b.mismaCaja) - Number(!!a.mismaCaja))
                    : d.rivales;
                  const aLaVista = ordenados.slice(0, RIVALES_A_LA_VISTA);
                  const plegados = ordenados.slice(RIVALES_A_LA_VISTA);
                  const parteDeLaClase = d.unidadesClase ? d.propio.unidades / d.unidadesClase : 0;
                  return (
                    <TableRow key={`${d.propio.marca}|${d.propio.modelo}`}>
                      <TableCell className="align-top">
                        <span className="font-medium">{d.propio.modelo}</span>
                        <span className="block text-xs text-muted-foreground">
                          {d.propio.marca} · {t(d.propio.clase)}
                          {d.propio.claseOrigen !== "catalogo" ? ` ${t("(clase por precio)")}` : ""}
                          {d.propio.tecnologia && d.propio.tecnologia !== SIN_DATO_TECNOLOGIA ? ` · ${d.propio.tecnologia}` : ""}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums align-top">
                        {formatUnidades(d.propio.unidades)}
                        <span className="block text-[11px] text-muted-foreground whitespace-nowrap">
                          {t("{pct} de la clase", { pct: formatPct(parteDeLaClase) })}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums align-top">
                        {d.propio.precio ? `US$ ${formatUnidades(d.propio.precio)}` : t("sin precio")}
                        <span className="block text-[11px] text-muted-foreground whitespace-nowrap">
                          {d.propio.banda === SIN_PRECIO ? t("sin banda") : etiquetaBandaI18n(d.propio.banda, t, fmt)}
                        </span>
                        {(d.propio.precioMT || d.propio.precioAT) && (
                          <span className="block text-[11px] text-muted-foreground whitespace-nowrap">
                            {[d.propio.precioMT ? `MT ${formatUnidades(d.propio.precioMT)}` : null, d.propio.precioAT ? `AT ${formatUnidades(d.propio.precioAT)}` : null].filter(Boolean).join(" · ")}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs align-top">
                        {d.rivales.length === 0 ? (
                          <span className="text-muted-foreground">{t("Ningún rival en esta clase.")}</span>
                        ) : (
                          <>
                            <span className="mb-1 block text-[11px] text-muted-foreground">
                              {d.rivales.length === 1 ? t("{n} rival", { n: d.rivales.length }) : t("{n} rivales", { n: d.rivales.length })} ·{" "}
                              {t("{n} u. en la clase", { n: formatUnidades(d.unidadesClase) })}
                              {d.propio.banda !== SIN_PRECIO ? ` · ${t("{n} en su misma banda", { n: d.enMismaBanda })}` : ""}
                              {d.caja
                                ? ` · ${d.caja === "AT"
                                    ? t("{n} con automático como el nuestro", { n: d.enMismaCaja })
                                    : t("{n} con mecánico como el nuestro", { n: d.enMismaCaja })}`
                                : ""}
                            </span>
                            {aLaVista.map((r) => <LineaRival key={`${r.marca}|${r.modelo}`} r={r} caja={d.caja} i18n={i18n} />)}
                            {plegados.length > 0 && (
                              <details className="mt-1">
                                <summary className="cursor-pointer text-[11px] font-medium text-primary">
                                  {t("Ver {n} más", { n: plegados.length })}
                                </summary>
                                <div className="mt-1">
                                  {plegados.map((r) => <LineaRival key={`${r.marca}|${r.modelo}`} r={r} caja={d.caja} i18n={i18n} />)}
                                </div>
                              </details>
                            )}
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      </Seccion>
      )}

      {vista === "precio" && (
      <Seccion titulo={t("Nuestro precio contra el mercado")}
        nota={t("Si estamos caros o baratos, comparando siempre contra la misma caja: un automático contra automáticos, un mecánico contra mecánicos.")} id="precio-relativo">
      <Card>
        <CardHeader>
          <CardTitle>{t("Estamos caros o baratos, modelo por modelo")}</CardTitle>
          <p className="text-xs text-muted-foreground">
            {tr("Nuestro precio de lista contra la mediana de los rivales de su misma clase (los que el comprador compara de verdad) y contra la mediana de todo su tipo de vehículo. Positivo = más caro que la mitad de esos rivales. Cada mediana necesita al menos dos rivales con precio. <b>Misma transmisión:</b> se compara el «desde» automático nuestro con el «desde» automático de los rivales (o mecánico con mecánico), leído del nombre de cada versión; solo cuando no hay con qué, «desde» contra «desde». Comparar el mecánico de uno con el automático del otro no es justo.")}
          </p>
        </CardHeader>
        <CardContent>
          {relativos.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("Todavía no hay suficientes precios de rivales para comparar.")}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("Nuestro modelo")}</TableHead>
                  <TableHead className="text-right" nota={esImportacion ? t("importados en el período") : t("matriculados en el período")}>
                    {esImportacion ? t("Importados") : t("Vendidos")}
                  </TableHead>
                  {/* Rótulos cortos (30/09/2026): «Nuestro precio (misma
                      transmisión)» y «Mediana de todo el tipo» sin corte de
                      línea empujaban la última columna fuera de la tarjeta.
                      Lo largo va en la nota. */}
                  <TableHead className="text-right" nota={t("con la misma caja que se compara")}>{t("Nuestro precio")}</TableHead>
                  <TableHead className="text-right" nota={t("mediana de los rivales de su clase")}>{t("Su clase")}</TableHead>
                  <TableHead className="text-right" nota={t("contra su clase")}>{t("Diferencia")}</TableHead>
                  <TableHead className="text-right" nota={t("mediana de todo su tipo de vehículo")}>{t("Todo el tipo")}</TableHead>
                  <TableHead className="text-right" nota={t("contra el tipo")}>{t("Diferencia")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {relativos.map((p) => (
                  <TableRow key={`${p.propio.marca}|${p.propio.modelo}`}>
                    <TableCell>
                      <span className="font-medium">{p.propio.modelo}</span>
                      <span className="block text-xs text-muted-foreground">
                        {p.propio.marca} · {t(p.propio.clase)} · {etiquetaBandaI18n(p.propio.banda, t, fmt)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatUnidades(p.propio.unidades)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      US$ {formatUnidades(p.precioBase)}
                      <span className="block text-[11px] text-muted-foreground">
                        {p.base === "AT" ? t("automático") : p.base === "MT" ? t("mecánico") : t("desde")}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {p.medianaClase ? `US$ ${formatUnidades(Math.round(p.medianaClase))}` : "—"}
                      <span className="block text-[11px] text-muted-foreground">
                        {p.rivalesClase === 1 ? t("{n} rival con precio", { n: p.rivalesClase }) : t("{n} rivales con precio", { n: p.rivalesClase })}
                        {p.base !== "desde" ? ` ${p.base}` : ""}
                      </span>
                    </TableCell>
                    <Diferencia valor={p.diferenciaClase} i18n={i18n} />
                    <TableCell className="text-right tabular-nums">
                      {p.medianaTipo ? `US$ ${formatUnidades(Math.round(p.medianaTipo))}` : "—"}
                      <span className="block text-[11px] text-muted-foreground">
                        {p.rivalesTipo === 1 ? t("{n} rival con precio", { n: p.rivalesTipo }) : t("{n} rivales con precio", { n: p.rivalesTipo })}
                      </span>
                    </TableCell>
                    <Diferencia valor={p.diferenciaTipo} i18n={i18n} />
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      </Seccion>
      )}
    </Pagina>
  );
}

/**
 * Un casillero que pide una decisión, en palabras de negocio: cuánto se
 * vende ahí, quién se lo lleva (o con qué mandamos nosotros), a qué precio
 * y qué margen de precio queda. La lectura de precio es la que el mapa solo
 * no puede dar: dentro del mismo casillero, estar por debajo de la mediana
 * es espacio para subir, y estar por encima mandando es que el precio no es
 * la barrera.
 */
function Casillero({ l, tipo, i18n }: { l: LecturaCasillero; tipo: "entrar" | "defender"; i18n: I18n }) {
  const { t, tr, fmt } = i18n;
  const { formatPct, formatUnidades } = fmt;
  const entrar = tipo === "entrar";
  const lista = (entrar ? l.rivales : l.propios).slice(0, 3);
  const dif = l.diferencia;
  const brecha = l.precioNuestro && l.precioRival ? Math.abs(l.precioNuestro - l.precioRival) : null;
  // La cifra en negrita con números tabulares, como siempre: la etiqueta <num> de las frases de abajo.
  const num = { num: (h: React.ReactNode) => <strong className="tabular-nums">{h}</strong> };
  return (
    <div
      className={cn(
        "rounded-lg border-l-4 bg-muted/40 p-3",
        entrar ? "border-l-amber-500" : "border-l-emerald-600"
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-sm font-medium">
          {t(l.celda.clase)} · US$ {etiquetaBandaI18n(l.celda.banda, t, fmt)}
        </span>
        <span className="text-xs tabular-nums text-muted-foreground">
          {t("{n} u. en el casillero", { n: formatUnidades(l.celda.mercado) })} ·{" "}
          <strong className={cn("font-semibold", entrar ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400")}>
            {t("{n} nuestras", { n: formatUnidades(l.celda.propias) })} · {formatPct(l.share)}
          </strong>
        </span>
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{entrar ? t("Se lo llevan:") : t("Mandamos con:")}</span>{" "}
        {lista.length === 0
          ? t("sin modelos con ventas en el casillero")
          : lista
              .map((m) => `${m.marca} ${m.modelo} ${t("{n} u.", { n: formatUnidades(m.unidades) })}${m.precio ? ` · US$ ${formatUnidades(m.precio)}` : ""}`)
              .join(" · ")}
        {(entrar ? l.rivales : l.propios).length > 3 ? ` · ${t("y {n} más", { n: (entrar ? l.rivales : l.propios).length - 3 })}` : ""}
      </p>
      <p className="mt-1 text-xs">
        {entrar ? (
          l.precioRival ? (
            <>
              {tr("El casillero se paga alrededor de <num>US$ {precio}</num>. Para entrar hace falta producto en ese precio, o bajar el nuestro hasta ahí.", {
                precio: formatUnidades(Math.round(l.precioRival)),
              }, num)}
            </>
          ) : (
            <>{t("Sin precios de rivales en el casillero: no se puede decir a qué precio se compra.")}</>
          )
        ) : dif !== null && brecha !== null && dif <= -0.05 ? (
          <>
            {tr("Estamos <num>US$ {brecha}</num> por debajo de la mediana del casillero y aun así mandamos: hay espacio de precio, sobre todo si el stock escasea.", {
              brecha: formatUnidades(Math.round(brecha)),
            }, num)}
          </>
        ) : dif !== null && dif >= 0.05 ? (
          <>
            {tr("Estamos <num>US$ {brecha}</num> por encima de la mediana y mandamos igual: acá el precio no es la barrera, cuidar el stock.", {
              brecha: formatUnidades(Math.round(brecha ?? 0)),
            }, num)}
          </>
        ) : dif !== null ? (
          <>{t("Estamos al precio del casillero: lo que decide es el stock y el seguimiento.")}</>
        ) : (
          <>{t("Sin precios suficientes para comparar dentro del casillero.")}</>
        )}
      </p>
    </div>
  );
}

/** Un rival en la lista: marca y modelo, unidades, precio y motorización.
 *  Los de la misma banda que nuestro modelo llevan la marca al lado; los
 *  que entraron a la clase por precio y no por catálogo, también. */
function LineaRival({ r, caja, i18n }: { r: Rival; caja: "AT" | "MT" | null; i18n: I18n }) {
  const { t, fmt } = i18n;
  const { formatUnidades } = fmt;
  return (
    <span className={cn("block", caja && r.mismaCaja === false && "opacity-60")}>
      <LogoMarca marca={r.marca} className="mr-1.5 align-middle" />
      <span className={cn(r.mismaBanda ? "font-semibold" : "font-medium")}>{r.marca} {r.modelo}</span>{" "}
      <span className="text-muted-foreground">
        · {t("{n} u.", { n: formatUnidades(r.unidades) })}
        {r.precio ? ` · US$ ${formatUnidades(r.precio)}` : ` · ${t("sin precio")}`}
        {r.precioMT || r.precioAT
          ? ` (${[r.precioMT ? `MT ${formatUnidades(r.precioMT)}` : null, r.precioAT ? `AT ${formatUnidades(r.precioAT)}` : null].filter(Boolean).join(" · ")})`
          : ""}
        {r.tecnologia && r.tecnologia !== SIN_DATO_TECNOLOGIA ? ` · ${r.tecnologia}` : ""}
      </span>
      {r.mismaBanda && (
        <span className="ml-1.5 rounded bg-primary/10 px-1 py-px text-[10px] font-medium text-primary">{t("misma banda")}</span>
      )}
      {caja && r.mismaCaja && (
        <span
          className="ml-1.5 rounded bg-emerald-500/10 px-1 py-px text-[10px] font-medium text-emerald-700 dark:text-emerald-400"
          title={caja === "AT"
            ? t("Tiene versión automática, como el nuestro: US$ {precio}", { precio: formatUnidades(r.precioCaja ?? 0) })
            : t("Tiene versión mecánica, como el nuestro: US$ {precio}", { precio: formatUnidades(r.precioCaja ?? 0) })}
        >
          {t("misma caja · {precio}", { precio: formatUnidades(r.precioCaja ?? 0) })}
        </span>
      )}
      {caja && r.mismaCaja === false && (
        <span
          className="ml-1.5 rounded bg-muted px-1 py-px text-[10px] text-muted-foreground"
          title={caja === "AT"
            ? t("Su nombre no dice si tiene automático: no entra en la comparación por caja.")
            : t("Su nombre no dice si tiene mecánico: no entra en la comparación por caja.")}
        >
          {t("sin {caja}", { caja })}
        </span>
      )}
      {r.claseInferida && (
        <span className="ml-1.5 rounded bg-muted px-1 py-px text-[10px] text-muted-foreground" title={t("No está en el catálogo de clases: se ubicó por precio.")}>{t("clase por precio")}</span>
      )}
    </span>
  );
}

/** Celda de diferencia de precio: color solo fuera de ±5%, y la palabra
 *  al lado, porque el color acompaña, no reemplaza. */
function Diferencia({ valor, i18n }: { valor: number | null; i18n: I18n }) {
  const { t, fmt } = i18n;
  if (valor === null) return <TableCell className="text-right text-muted-foreground">—</TableCell>;
  return (
    <TableCell
      className={cn(
        "text-right tabular-nums font-semibold",
        valor > 0.05 && "text-amber-700 dark:text-amber-400",
        valor < -0.05 && "text-emerald-700 dark:text-emerald-400"
      )}
    >
      {fmt.formatPct(valor, { signed: true })}
      <span className="block text-[11px] font-normal text-muted-foreground">
        {valor > 0.05 ? t("más caro") : valor < -0.05 ? t("más barato") : t("parejo")}
      </span>
    </TableCell>
  );
}
