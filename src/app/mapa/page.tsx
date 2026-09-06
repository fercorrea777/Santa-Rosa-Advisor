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
  armarMapa, asignarPrecios, BANDAS, etiquetaBanda, precioRelativo, rivalesDirectos, SIN_PRECIO,
  type PrecioCandidato, type Rival,
} from "@/lib/cadam/bandas";
import { claseDe, CLASES_ORDEN, ordenClase, SEGMENTO_DE_CLASE } from "@/lib/cadam/clases";
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

  const columnasBanda = [
    ...BANDAS.map((b) => ({ clave: b.clave, etiqueta: b.etiqueta })),
    { clave: SIN_PRECIO, etiqueta: "Sin precio conocido" },
  ];

  // --- mapa por motorización: mismo dibujo, columnas = tecnologías de CADAM.
  // La clase de cada modelo es la misma que en el mapa de precios (con el
  // precio ya cruzado, para que la inferencia coincida).
  const clasePorModelo = new Map(conTodo.map((m) => [`${m.marca}|${m.modelo}`, m.clase]));
  const filasTec = getModelosPorTecnologia({ ...rango, segmento: f.segmento });
  const tecPorClase = new Map<string, Map<string, { mercado: number; propias: number }>>();
  const totalTecClase = new Map<string, number>();
  const codigosVistos = new Set<string>();
  for (const r of filasTec) {
    const clase = clasePorModelo.get(`${r.marca}|${r.modelo}`)
      ?? claseDe({ marca: r.marca, modelo: r.modelo, segmento: r.segmento }).clase;
    if (claseFiltro && clase !== claseFiltro) continue;
    const fila = tecPorClase.get(clase) ?? new Map<string, { mercado: number; propias: number }>();
    const celda = fila.get(r.tecnologia) ?? { mercado: 0, propias: 0 };
    celda.mercado += r.unidades;
    if (r.esPropia) celda.propias += r.unidades;
    fila.set(r.tecnologia, celda);
    tecPorClase.set(clase, fila);
    totalTecClase.set(clase, (totalTecClase.get(clase) ?? 0) + r.unidades);
    codigosVistos.add(r.tecnologia);
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
    ...(codigosVistos.has(SIN_DATO_TECNOLOGIA) ? [{ clave: SIN_DATO_TECNOLOGIA, etiqueta: "Sin dato" }] : []),
  ];

  const duelos = rivalesDirectos(con).filter((d) => d.propio.unidades >= 5).slice(0, 25);
  const relativos = precioRelativo(con)
    .filter((p) => p.medianaClase !== null || p.medianaTipo !== null)
    .slice(0, 25);

  const recorte = [
    f.segmento ? `solo ${f.segmento}` : null,
    claseFiltro ? `solo ${claseFiltro}` : null,
    f.tecnologia ? `solo ${f.tecnologia}` : null,
  ].filter(Boolean).join(" · ");

  /** Cabecera de fila del mapa: la clase, y en chico el segmento de CADAM
   *  cuando el nombre de la clase no lo dice solo. */
  const etiquetaClase = (c: string) => ({ clase: c, segmento: SEGMENTO_DE_CLASE[c] });

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

      <Seccion titulo="Los mapas" id="mapa">
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
            <TablaMapa
              filas={clasesMapa.map(etiquetaClase)}
              columnas={columnasBanda}
              celda={(c, b) => {
                const x = mapa.celda(c, b);
                return x
                  ? {
                      mercado: x.mercado,
                      propias: x.propias,
                      detalle: x.modelos.slice(0, 6).map((m) => `${m.marca} ${m.modelo}: ${formatUnidades(m.unidades)}`).join(" · "),
                    }
                  : undefined;
              }}
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
            <TablaMapa
              filas={clasesTec.map(etiquetaClase)}
              columnas={columnasTec}
              celda={(c, t) => tecPorClase.get(c)?.get(t)}
            />
          )}
        </CardContent>
      </Card>
      </Seccion>

      <Seccion titulo="Contra quién compite cada modelo nuestro" id="rivales">
      <Card>
        <CardHeader>
          <CardTitle>Rivales directos — los de su misma clase, del que más vende al que menos</CardTitle>
          <p className="text-xs text-muted-foreground">
            Para cada modelo nuestro con ventas, todos los modelos de la
            competencia en su misma clase, con unidades, precio de lista y
            motorización. Los de su misma banda de precio van marcados; los
            demás no quedan afuera: una pick-up mediana compite con todas las
            pick-ups medianas, esté una banda arriba o abajo. Los primeros{" "}
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
                  <TableHead className="text-right">Vendidos</TableHead>
                  <TableHead className="text-right">Precio</TableHead>
                  <TableHead>Rivales de su clase (unidades · precio · motorización)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {duelos.map((d) => {
                  const aLaVista = d.rivales.slice(0, RIVALES_A_LA_VISTA);
                  const plegados = d.rivales.slice(RIVALES_A_LA_VISTA);
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
                            </span>
                            {aLaVista.map((r) => <LineaRival key={`${r.marca}|${r.modelo}`} r={r} />)}
                            {plegados.length > 0 && (
                              <details className="mt-1">
                                <summary className="cursor-pointer text-[11px] font-medium text-primary">
                                  Ver {plegados.length} más
                                </summary>
                                <div className="mt-1">
                                  {plegados.map((r) => <LineaRival key={`${r.marca}|${r.modelo}`} r={r} />)}
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

      <Seccion titulo="Nuestro precio contra el mercado" id="precio-relativo">
      <Card>
        <CardHeader>
          <CardTitle>Estamos caros o baratos, modelo por modelo</CardTitle>
          <p className="text-xs text-muted-foreground">
            Nuestro precio de lista contra la mediana de los rivales de su
            misma clase (los que el comprador compara de verdad) y contra la
            mediana de todo su tipo de vehículo. Positivo = más caro que la
            mitad de esos rivales. Cada mediana necesita al menos dos rivales
            con precio.
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
                  <TableHead className="text-right">Vendidos</TableHead>
                  <TableHead className="text-right">Nuestro precio</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Mediana de su clase</TableHead>
                  <TableHead className="text-right">Diferencia</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Mediana de todo el tipo</TableHead>
                  <TableHead className="text-right">Diferencia</TableHead>
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
                    <TableCell className="text-right tabular-nums">US$ {formatUnidades(p.propio.precio as number)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {p.medianaClase ? `US$ ${formatUnidades(Math.round(p.medianaClase))}` : "—"}
                      <span className="block text-[11px] text-muted-foreground">
                        {p.rivalesClase} {p.rivalesClase === 1 ? "rival" : "rivales"} con precio
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

/** Un rival en la lista: marca y modelo, unidades, precio y motorización.
 *  Los de la misma banda que nuestro modelo llevan la marca al lado; los
 *  que entraron a la clase por precio y no por catálogo, también. */
function LineaRival({ r }: { r: Rival }) {
  return (
    <span className="block">
      <span className={cn(r.mismaBanda ? "font-semibold" : "font-medium")}>{r.marca} {r.modelo}</span>{" "}
      <span className="text-muted-foreground">
        · {formatUnidades(r.unidades)} u.
        {r.precio ? ` · US$ ${formatUnidades(r.precio)}` : " · sin precio"}
        {r.tecnologia && r.tecnologia !== SIN_DATO_TECNOLOGIA ? ` · ${r.tecnologia}` : ""}
      </span>
      {r.mismaBanda && (
        <span className="ml-1.5 rounded bg-primary/10 px-1 py-px text-[10px] font-medium text-primary">misma banda</span>
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

/**
 * El dibujo de los mapas: filas = clases de vehículo, columnas = bandas o
 * motorizaciones. En cada casillero, el mercado arriba y lo nuestro debajo
 * con su participación; el tinte acompaña a la cifra, nunca la reemplaza.
 */
function TablaMapa({
  filas,
  columnas,
  celda,
}: {
  filas: { clase: string; segmento?: string }[];
  columnas: { clave: string; etiqueta: string }[];
  celda: (fila: string, columna: string) => { mercado: number; propias: number; detalle?: string } | undefined;
}) {
  /** 0% nada; 30% o más, el tope. */
  const tinte = (share: number) =>
    share > 0 ? `color-mix(in oklch, var(--primary) ${Math.min(45, Math.round(share * 150))}%, transparent)` : undefined;

  const totalColumna = new Map<string, { mercado: number; propias: number }>();
  for (const fila of filas) {
    for (const c of columnas) {
      const x = celda(fila.clase, c.clave);
      if (!x) continue;
      const t = totalColumna.get(c.clave) ?? { mercado: 0, propias: 0 };
      t.mercado += x.mercado;
      t.propias += x.propias;
      totalColumna.set(c.clave, t);
    }
  }
  const esConocida = (c: string) => CLASES_ORDEN.includes(c);

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Clase</TableHead>
            {columnas.map((c) => (
              <TableHead key={c.clave} className="text-right whitespace-nowrap">{c.etiqueta}</TableHead>
            ))}
            <TableHead className="text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filas.map((fila) => {
            const filaTotal = columnas.reduce(
              (t, c) => {
                const x = celda(fila.clase, c.clave);
                return { mercado: t.mercado + (x?.mercado ?? 0), propias: t.propias + (x?.propias ?? 0) };
              },
              { mercado: 0, propias: 0 }
            );
            return (
              <TableRow key={fila.clase}>
                <TableCell className="font-medium whitespace-nowrap">
                  {fila.clase}
                  {!esConocida(fila.clase) && (
                    <span className="block text-[11px] font-normal text-muted-foreground">sin clase: segmento de CADAM</span>
                  )}
                </TableCell>
                {columnas.map((c) => {
                  const x = celda(fila.clase, c.clave);
                  const share = x && x.mercado ? x.propias / x.mercado : 0;
                  return (
                    <TableCell
                      key={c.clave}
                      className="text-right align-top"
                      style={{ backgroundColor: tinte(share) }}
                      title={x?.detalle}
                    >
                      {x ? (
                        <>
                          <span className="block tabular-nums font-semibold">{formatUnidades(x.mercado)}</span>
                          <span className="block text-[11px] tabular-nums text-muted-foreground">
                            {x.propias ? `${formatUnidades(x.propias)} nuestras · ${formatPct(share)}` : "—"}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">·</span>
                      )}
                    </TableCell>
                  );
                })}
                <TableCell className="text-right align-top">
                  <span className="block tabular-nums font-semibold">{formatUnidades(filaTotal.mercado)}</span>
                  <span className="block text-[11px] tabular-nums text-muted-foreground">
                    {filaTotal.propias ? `${formatUnidades(filaTotal.propias)} · ${formatPct(filaTotal.propias / filaTotal.mercado)}` : "—"}
                  </span>
                </TableCell>
              </TableRow>
            );
          })}
          <TableRow className="font-medium">
            <TableCell>Total</TableCell>
            {columnas.map((c) => {
              const t = totalColumna.get(c.clave);
              return (
                <TableCell key={c.clave} className="text-right align-top">
                  <span className="block tabular-nums">{t ? formatUnidades(t.mercado) : "·"}</span>
                  <span className="block text-[11px] tabular-nums text-muted-foreground">
                    {t?.propias ? `${formatUnidades(t.propias)} · ${formatPct(t.propias / t.mercado)}` : "—"}
                  </span>
                </TableCell>
              );
            })}
            <TableCell className="text-right" />
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
