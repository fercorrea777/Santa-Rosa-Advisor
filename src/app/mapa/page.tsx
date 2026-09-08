import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NotaDato, PageHeader } from "@/components/dashboard/page-header";
import { FiltroPeriodo } from "@/components/dashboard/filtro-periodo";
import { Seccion } from "@/components/dashboard/seccion";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  getCobertura, getModelosPorTecnologia, getPorDimension, getRankingModelos, TECNOLOGIAS,
} from "@/lib/cadam/mercado";
import {
  armarMapa, asignarPrecios, BANDAS, etiquetaBanda, lecturaCasillero, PESO_PROPIO, PESO_RELEVANTE,
  precioRelativo, rivalesDirectos, SHARE_AUSENTE, SHARE_FUERTE, SIN_PRECIO,
  type LecturaCasillero, type ModeloConBanda, type PrecioCandidato, type Rival,
} from "@/lib/cadam/bandas";
import { MapaClases, type CeldaMapa } from "@/components/dashboard/mapa-clases";
import { claseDe, ordenClase } from "@/lib/cadam/clases";
import { SIN_DATO_TECNOLOGIA } from "@/lib/informes/segmento-version";
import { getStockPropio } from "@/lib/informes/propios";
import { getPreciosCompetencia } from "@/lib/informes/precios-competencia";
import { formatFecha, formatPct, formatUnidades } from "@/lib/format";
import { etiquetaPeriodo, filtroDesdeUrl, type SearchParams } from "@/lib/periodo";
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
  const sp = await searchParams;
  const cobertura = getCobertura();
  const f = filtroDesdeUrl(sp, cobertura.matriculacion.ultimo);
  const periodo = etiquetaPeriodo(f.anio, f.mesDesde, f.mesHasta);
  const mesMax: Record<number, number> = {};
  for (const a of cobertura.matriculacion.anios) {
    mesMax[a] = a === cobertura.matriculacion.ultimo?.anio ? cobertura.matriculacion.ultimo.mes : 12;
  }
  const rango = { anio: f.anio, mesDesde: f.mesDesde, mesHasta: f.mesHasta };
  // La clase es un param propio de esta pantalla (no está en filtroDesdeUrl).
  const claseFiltro = typeof sp.clase === "string" && sp.clase && sp.clase !== "todos" ? sp.clase : undefined;

  // Opciones del filtro de tipo: todos los tipos del período. No se le
  // aplica el filtro de tipo, si no la lista se reduciría a lo elegido.
  const opcionesSegmento = getPorDimension("matriculacion", "segmento", { ...rango, tecnologia: f.tecnologia })
    .map((d) => d.valor);

  // Unidades: CADAM, todas las marcas. Sin filtro de marca: el mapa es el
  // mercado entero. Tipo y motorización sí se respetan, para mirar solo las
  // pick-ups o solo los enchufables.
  const modelos = getRankingModelos(
    "matriculacion",
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
  const opcionesClase = [...new Set(conTodo.map((m) => m.clase))].sort((a, b) => ordenClase(a) - ordenClase(b) || a.localeCompare(b));
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
    ...BANDAS.map((b) => ({ clave: b.clave, etiqueta: b.etiqueta })),
    { clave: SIN_PRECIO, etiqueta: "Sin precio conocido", sinAccion: true },
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
  const filasTec = getModelosPorTecnologia({ ...rango, segmento: f.segmento });
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
      precioMT: null, precioAT: null,
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
    ...TECNOLOGIAS.filter((t) => codigosVistos.has(t)).map((t) => ({ clave: t, etiqueta: t })),
    ...extras.map((t) => ({ clave: t, etiqueta: t })),
    ...(codigosVistos.has(SIN_DATO_TECNOLOGIA) ? [{ clave: SIN_DATO_TECNOLOGIA, etiqueta: "Sin dato", sinAccion: true }] : []),
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

  const recorte = [
    f.segmento ? `solo ${f.segmento}` : null,
    claseFiltro ? `solo ${claseFiltro}` : null,
    f.tecnologia ? `solo ${f.tecnologia}` : null,
  ].filter(Boolean).join(" · ");

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        titulo="Dónde competir"
        descripcion={`El mercado por clase de vehículo, banda de precio y motorización, cuánto de cada casillero es nuestro y contra quién compite cada modelo · ${periodo}${recorte ? ` · ${recorte}` : ""}.`}
        fuente={`Fuente: CADAM (unidades y motorización) · Cars (nuestros precios) · Datacar (precios de la competencia, catálogo de terceros${
          fechaCompetencia ? `, relevado el ${formatFecha(fechaCompetencia)}` : ""
        }) · clases de vehículo: catálogo propio.`}
      />

      <FiltroPeriodo
        anios={cobertura.matriculacion.anios}
        mesMaximoPorAnio={mesMax}
        opciones={[
          { param: "segmento", label: "Tipo de vehículo", valores: opcionesSegmento },
          { param: "clase", label: "Clase", valores: opcionesClase },
          { param: "tecnologia", label: "Motorización", valores: [...TECNOLOGIAS] },
        ]}
      />

      <NotaDato>
        <strong>Qué es una clase.</strong> CADAM solo distingue SUV, pick-up,
        automóvil, camión, furgón y minibús, y eso mete en la misma bolsa a
        una X50 de US$ 15.000 y a una Fortuner de US$ 52.000. La clase es el
        tamaño y el uso con el que el comprador compara de verdad: SUV chico,
        compacto, mediano, grande; pick-up compacta, mediana, grande; auto
        chico, mediano; camión liviano, mediano, pesado. No está en ninguna
        fuente: es un catálogo propio sobre los nombres reales del mercado
        ({formatPct(conClaseCatalogo / (total || 1))} de las unidades del período).
        {conClaseInferida > 0 && (
          <> Lo que no está en el catálogo se ubica por precio y queda marcado «por precio» ({formatPct(conClaseInferida / (total || 1))}).</>
        )}{" "}
        <strong>Cómo leer los mapas.</strong> Cada casillero es una clase en
        una banda de precio (primer mapa) o en una motorización (segundo). El
        número grande es cuánto vendió el mercado ahí; debajo, cuánto de eso
        es nuestro y qué porcentaje representa. Un casillero grande donde
        nuestra parte es chica es donde falta producto o precio.{" "}
        <strong>Precio y volumen no salen de la misma fuente:</strong> las
        unidades y la motorización son de CADAM; los precios nuestros, del
        stock de Cars; los de la competencia, de un catálogo de terceros
        (Datacar, {marcasConPrecio.length} marcas) — no es lista oficial. Lo
        que no tiene precio va a la última columna, no se adivina.{" "}
        {total > 0 && (
          <>
            Cobertura de precio: <strong>{formatPct(conPrecio / total)}</strong> de las
            unidades ({formatPct(propiasConPrecio / (propiasTotal || 1))} de las nuestras,{" "}
            {formatPct(rivalesConPrecio / (rivalesTotal || 1))} de la competencia).
          </>
        )}
        {!carsDisponible && (
          <> <strong>Cars no respondió:</strong> nuestros modelos quedan sin precio en esta corrida.</>
        )}
        {clasesOmitidas > 0 && (
          <> {clasesOmitidas} {clasesOmitidas === 1 ? "clase" : "clases"} con menos de {MINIMO_CLASE} unidades no se dibujan.</>
        )}
      </NotaDato>

      <Seccion titulo="Los mapas"
        nota="Dónde está la plata del mercado: cuántas unidades se venden en cada cruce de clase y precio, y en cuáles de esos casilleros estamos o no estamos." id="mapa">
      <Card>
        <CardHeader>
          <CardTitle>Mercado por clase y banda de precio — {periodo}</CardTitle>
          <p className="text-xs text-muted-foreground">
            Precios de lista en dólares. Arriba, lo que vendió el mercado;
            debajo, lo nuestro y su participación. Cuanto más teñido el
            casillero, más parte nuestra. Las clases van de chico a grande.
          </p>
        </CardHeader>
        <CardContent>
          {clasesMapa.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Sin matriculaciones en este recorte.</p>
          ) : (
            <MapaClases
              filas={clasesMapa}
              columnas={columnasBanda}
              celdas={celdasBanda}
              nombreColumna="banda de precio"
              periodo={periodo}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mercado por clase y motorización — {periodo}</CardTitle>
          <p className="text-xs text-muted-foreground">
            La motorización la informa CADAM en cada matriculación: ICE es
            combustión; MHEV, HEV y PHEV son híbridos (el PHEV se enchufa);
            REEV es eléctrico con motor de apoyo; EV, eléctrico puro. Mismo
            dibujo que el mapa de precios.
            {f.tecnologia ? " El filtro de motorización no recorta este mapa: es la dimensión de sus columnas." : ""}
          </p>
        </CardHeader>
        <CardContent>
          {clasesTec.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Sin matriculaciones en este recorte.</p>
          ) : (
            <MapaClases
              filas={clasesTec}
              columnas={columnasTec}
              celdas={celdasTec}
              nombreColumna="motorización"
              periodo={periodo}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Qué hacer en cada casillero marcado — {periodo}</CardTitle>
          <p className="text-xs text-muted-foreground">
            Los casilleros del mapa de precios que piden una decisión.{" "}
            <strong>Entrar</strong>: pesan al menos {formatPct(PESO_RELEVANTE)} del
            mercado y tenemos menos de {formatPct(SHARE_AUSENTE)}.{" "}
            <strong>Defender</strong>: de ahí sale al menos {formatPct(PESO_PROPIO)} de
            todo lo que vendemos y tenemos más de {formatPct(SHARE_FUERTE)} del
            casillero. Con quién se lo lleva, a qué precio y qué margen de precio
            hay. Tocá cualquier casillero del mapa para ver la comparativa entera.
          </p>
        </CardHeader>
        <CardContent>
          {paraEntrar.length === 0 && paraDefender.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Ningún casillero de este recorte cumple los cortes.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold">
                  Dónde entrar{" "}
                  <span className="font-normal text-muted-foreground">
                    ({paraEntrar.length}) · el mercado compra y no estamos
                  </span>
                </h3>
                {paraEntrar.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No hay casilleros grandes sin presencia nuestra.
                  </p>
                ) : (
                  paraEntrar.map((l) => <Casillero key={`${l.celda.clase}|${l.celda.banda}`} l={l} tipo="entrar" />)
                )}
              </div>
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold">
                  Dónde mandamos{" "}
                  <span className="font-normal text-muted-foreground">
                    ({paraDefender.length}) · cuidar stock y precio
                  </span>
                </h3>
                {paraDefender.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Ningún casillero grande con participación nuestra alta.
                  </p>
                ) : (
                  paraDefender.map((l) => <Casillero key={`${l.celda.clase}|${l.celda.banda}`} l={l} tipo="defender" />)
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      </Seccion>

      <Seccion titulo="Contra quién compite cada modelo nuestro"
        nota="Los rivales que se le cruzan al cliente en el salón: los de la misma clase, no los de la misma marca ni los del mismo segmento de CADAM." id="rivales">
      <Card>
        <CardHeader>
          <CardTitle>Rivales directos — los de su misma clase, del que más vende al que menos</CardTitle>
          <p className="text-xs text-muted-foreground">
            Para cada modelo nuestro con ventas, todos los modelos de la
            competencia en su misma clase, con unidades, precio de lista y
            motorización. Los de su misma banda de precio van marcados; los
            demás no quedan afuera: una pick-up mediana compite con todas las
            pick-ups medianas, esté una banda arriba o abajo.{" "}
            <strong>Misma caja</strong>: los que tienen versión de la misma
            transmisión que la nuestra van primero, con su precio en esa caja;
            los que no la dicen quedan atenuados. Los primeros{" "}
            {RIVALES_A_LA_VISTA} van a la vista; el resto, plegado.
          </p>
        </CardHeader>
        <CardContent>
          {duelos.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Ningún modelo nuestro con ventas en este recorte.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nuestro modelo</TableHead>
                  <TableHead className="text-right" nota="matriculados en el período">Vendidos</TableHead>
                  <TableHead className="text-right" nota="el más barato de la gama">Precio</TableHead>
                  <TableHead nota="los que se le cruzan al cliente en el salón">
                    Rivales de su clase (unidades · precio desde, MT y AT · motorización)
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
                          {d.propio.marca} · {d.propio.clase}
                          {d.propio.claseOrigen !== "catalogo" ? " (clase por precio)" : ""}
                          {d.propio.tecnologia && d.propio.tecnologia !== SIN_DATO_TECNOLOGIA ? ` · ${d.propio.tecnologia}` : ""}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums align-top">
                        {formatUnidades(d.propio.unidades)}
                        <span className="block text-[11px] text-muted-foreground whitespace-nowrap">
                          {formatPct(parteDeLaClase)} de la clase
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums align-top">
                        {d.propio.precio ? `US$ ${formatUnidades(d.propio.precio)}` : "sin precio"}
                        <span className="block text-[11px] text-muted-foreground whitespace-nowrap">
                          {d.propio.banda === SIN_PRECIO ? "sin banda" : etiquetaBanda(d.propio.banda)}
                        </span>
                        {(d.propio.precioMT || d.propio.precioAT) && (
                          <span className="block text-[11px] text-muted-foreground whitespace-nowrap">
                            {[d.propio.precioMT ? `MT ${formatUnidades(d.propio.precioMT)}` : null, d.propio.precioAT ? `AT ${formatUnidades(d.propio.precioAT)}` : null].filter(Boolean).join(" · ")}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs align-top">
                        {d.rivales.length === 0 ? (
                          <span className="text-muted-foreground">Ningún rival en esta clase.</span>
                        ) : (
                          <>
                            <span className="mb-1 block text-[11px] text-muted-foreground">
                              {d.rivales.length} {d.rivales.length === 1 ? "rival" : "rivales"} ·{" "}
                              {formatUnidades(d.unidadesClase)} u. en la clase
                              {d.propio.banda !== SIN_PRECIO ? ` · ${d.enMismaBanda} en su misma banda` : ""}
                              {d.caja ? ` · ${d.enMismaCaja} con ${d.caja === "AT" ? "automático" : "mecánico"} como el nuestro` : ""}
                            </span>
                            {aLaVista.map((r) => <LineaRival key={`${r.marca}|${r.modelo}`} r={r} caja={d.caja} />)}
                            {plegados.length > 0 && (
                              <details className="mt-1">
                                <summary className="cursor-pointer text-[11px] font-medium text-primary">
                                  Ver {plegados.length} más
                                </summary>
                                <div className="mt-1">
                                  {plegados.map((r) => <LineaRival key={`${r.marca}|${r.modelo}`} r={r} caja={d.caja} />)}
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

      <Seccion titulo="Nuestro precio contra el mercado"
        nota="Si estamos caros o baratos, comparando siempre contra la misma caja: un automático contra automáticos, un mecánico contra mecánicos." id="precio-relativo">
      <Card>
        <CardHeader>
          <CardTitle>Estamos caros o baratos, modelo por modelo</CardTitle>
          <p className="text-xs text-muted-foreground">
            Nuestro precio de lista contra la mediana de los rivales de su
            misma clase (los que el comprador compara de verdad) y contra la
            mediana de todo su tipo de vehículo. Positivo = más caro que la
            mitad de esos rivales. Cada mediana necesita al menos dos rivales
            con precio. <strong>Misma transmisión:</strong> se compara el
            «desde» automático nuestro con el «desde» automático de los rivales
            (o mecánico con mecánico), leído del nombre de cada versión; solo
            cuando no hay con qué, «desde» contra «desde». Comparar el mecánico
            de uno con el automático del otro no es justo.
          </p>
        </CardHeader>
        <CardContent>
          {relativos.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Todavía no hay suficientes precios de rivales para comparar.
            </p>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nuestro modelo</TableHead>
                  <TableHead className="text-right" nota="matriculados en el período">Vendidos</TableHead>
                  <TableHead className="text-right whitespace-nowrap" nota="con la caja que se compara">Nuestro precio (misma transmisión)</TableHead>
                  <TableHead className="text-right whitespace-nowrap" nota="el del medio de su clase">Mediana de su clase</TableHead>
                  <TableHead className="text-right" nota="más caro o barato que su clase">Diferencia</TableHead>
                  <TableHead className="text-right whitespace-nowrap" nota="el del medio de todo el tipo">Mediana de todo el tipo</TableHead>
                  <TableHead className="text-right" nota="más caro o barato que el tipo">Diferencia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {relativos.map((p) => (
                  <TableRow key={`${p.propio.marca}|${p.propio.modelo}`}>
                    <TableCell>
                      <span className="font-medium">{p.propio.modelo}</span>
                      <span className="block text-xs text-muted-foreground">
                        {p.propio.marca} · {p.propio.clase} · {etiquetaBanda(p.propio.banda)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatUnidades(p.propio.unidades)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      US$ {formatUnidades(p.precioBase)}
                      <span className="block text-[11px] text-muted-foreground">
                        {p.base === "AT" ? "automático" : p.base === "MT" ? "mecánico" : "desde"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {p.medianaClase ? `US$ ${formatUnidades(Math.round(p.medianaClase))}` : "—"}
                      <span className="block text-[11px] text-muted-foreground">
                        {p.rivalesClase} {p.rivalesClase === 1 ? "rival" : "rivales"} con precio
                        {p.base !== "desde" ? ` ${p.base}` : ""}
                      </span>
                    </TableCell>
                    <Diferencia valor={p.diferenciaClase} />
                    <TableCell className="text-right tabular-nums">
                      {p.medianaTipo ? `US$ ${formatUnidades(Math.round(p.medianaTipo))}` : "—"}
                      <span className="block text-[11px] text-muted-foreground">
                        {p.rivalesTipo} {p.rivalesTipo === 1 ? "rival" : "rivales"} con precio
                      </span>
                    </TableCell>
                    <Diferencia valor={p.diferenciaTipo} />
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>
      </Seccion>
    </div>
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
function Casillero({ l, tipo }: { l: LecturaCasillero; tipo: "entrar" | "defender" }) {
  const entrar = tipo === "entrar";
  const lista = (entrar ? l.rivales : l.propios).slice(0, 3);
  const dif = l.diferencia;
  const brecha = l.precioNuestro && l.precioRival ? Math.abs(l.precioNuestro - l.precioRival) : null;
  return (
    <div
      className={cn(
        "rounded-lg border-l-4 bg-muted/40 p-3",
        entrar ? "border-l-amber-500" : "border-l-emerald-600"
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-sm font-medium">
          {l.celda.clase} · US$ {etiquetaBanda(l.celda.banda)}
        </span>
        <span className="text-xs tabular-nums text-muted-foreground">
          {formatUnidades(l.celda.mercado)} u. en el casillero ·{" "}
          <strong className={cn("font-semibold", entrar ? "text-amber-600 dark:text-amber-500" : "text-emerald-700 dark:text-emerald-400")}>
            {formatUnidades(l.celda.propias)} nuestras · {formatPct(l.share)}
          </strong>
        </span>
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{entrar ? "Se lo llevan:" : "Mandamos con:"}</span>{" "}
        {lista.length === 0
          ? "sin modelos con ventas en el casillero"
          : lista
              .map((m) => `${m.marca} ${m.modelo} ${formatUnidades(m.unidades)} u.${m.precio ? ` · US$ ${formatUnidades(m.precio)}` : ""}`)
              .join(" · ")}
        {(entrar ? l.rivales : l.propios).length > 3 ? ` · y ${(entrar ? l.rivales : l.propios).length - 3} más` : ""}
      </p>
      <p className="mt-1 text-xs">
        {entrar ? (
          l.precioRival ? (
            <>
              El casillero se paga alrededor de{" "}
              <strong className="tabular-nums">US$ {formatUnidades(Math.round(l.precioRival))}</strong>. Para
              entrar hace falta producto en ese precio, o bajar el nuestro hasta ahí.
            </>
          ) : (
            <>Sin precios de rivales en el casillero: no se puede decir a qué precio se compra.</>
          )
        ) : dif !== null && brecha !== null && dif <= -0.05 ? (
          <>
            Estamos <strong className="tabular-nums">US$ {formatUnidades(Math.round(brecha))}</strong> por debajo de
            la mediana del casillero y aun así mandamos: hay espacio de precio, sobre todo si el stock escasea.
          </>
        ) : dif !== null && dif >= 0.05 ? (
          <>
            Estamos <strong className="tabular-nums">US$ {formatUnidades(Math.round(brecha ?? 0))}</strong> por
            encima de la mediana y mandamos igual: acá el precio no es la barrera, cuidar el stock.
          </>
        ) : dif !== null ? (
          <>Estamos al precio del casillero: lo que decide es el stock y el seguimiento.</>
        ) : (
          <>Sin precios suficientes para comparar dentro del casillero.</>
        )}
      </p>
    </div>
  );
}

/** Un rival en la lista: marca y modelo, unidades, precio y motorización.
 *  Los de la misma banda que nuestro modelo llevan la marca al lado; los
 *  que entraron a la clase por precio y no por catálogo, también. */
function LineaRival({ r, caja }: { r: Rival; caja: "AT" | "MT" | null }) {
  return (
    <span className={cn("block", caja && r.mismaCaja === false && "opacity-60")}>
      <span className={cn(r.mismaBanda ? "font-semibold" : "font-medium")}>{r.marca} {r.modelo}</span>{" "}
      <span className="text-muted-foreground">
        · {formatUnidades(r.unidades)} u.
        {r.precio ? ` · US$ ${formatUnidades(r.precio)}` : " · sin precio"}
        {r.precioMT || r.precioAT
          ? ` (${[r.precioMT ? `MT ${formatUnidades(r.precioMT)}` : null, r.precioAT ? `AT ${formatUnidades(r.precioAT)}` : null].filter(Boolean).join(" · ")})`
          : ""}
        {r.tecnologia && r.tecnologia !== SIN_DATO_TECNOLOGIA ? ` · ${r.tecnologia}` : ""}
      </span>
      {r.mismaBanda && (
        <span className="ml-1.5 rounded bg-primary/10 px-1 py-px text-[10px] font-medium text-primary">misma banda</span>
      )}
      {caja && r.mismaCaja && (
        <span
          className="ml-1.5 rounded bg-emerald-500/10 px-1 py-px text-[10px] font-medium text-emerald-700 dark:text-emerald-400"
          title={`Tiene versión ${caja === "AT" ? "automática" : "mecánica"}, como el nuestro: US$ ${formatUnidades(r.precioCaja ?? 0)}`}
        >
          misma caja · {formatUnidades(r.precioCaja ?? 0)}
        </span>
      )}
      {caja && r.mismaCaja === false && (
        <span
          className="ml-1.5 rounded bg-muted px-1 py-px text-[10px] text-muted-foreground"
          title={`Su nombre no dice si tiene ${caja === "AT" ? "automático" : "mecánico"}: no entra en la comparación por caja.`}
        >
          sin {caja}
        </span>
      )}
      {r.claseInferida && (
        <span className="ml-1.5 rounded bg-muted px-1 py-px text-[10px] text-muted-foreground" title="No está en el catálogo de clases: se ubicó por precio.">clase por precio</span>
      )}
    </span>
  );
}

/** Celda de diferencia de precio: color solo fuera de ±5%, y la palabra
 *  al lado, porque el color acompaña, no reemplaza. */
function Diferencia({ valor }: { valor: number | null }) {
  if (valor === null) return <TableCell className="text-right text-muted-foreground">—</TableCell>;
  return (
    <TableCell
      className={cn(
        "text-right tabular-nums font-semibold",
        valor > 0.05 && "text-amber-600 dark:text-amber-500",
        valor < -0.05 && "text-emerald-700 dark:text-emerald-400"
      )}
    >
      {formatPct(valor, { signed: true })}
      <span className="block text-[11px] font-normal text-muted-foreground">
        {valor > 0.05 ? "más caro" : valor < -0.05 ? "más barato" : "parejo"}
      </span>
    </TableCell>
  );
}
