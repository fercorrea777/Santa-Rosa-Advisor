import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NotaDato, PageHeader } from "@/components/dashboard/page-header";
import { FiltroPeriodo } from "@/components/dashboard/filtro-periodo";
import { Seccion } from "@/components/dashboard/seccion";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  getCobertura, getMapaSegmentoTecnologia, getPorDimension, getRankingModelos, TECNOLOGIAS,
} from "@/lib/cadam/mercado";
import {
  armarMapa, asignarPrecios, BANDAS, etiquetaBanda, precioRelativo, rivalesDirectos, SIN_PRECIO,
  type PrecioCandidato, type Rival,
} from "@/lib/cadam/bandas";
import { SIN_DATO_TECNOLOGIA } from "@/lib/informes/segmento-version";
import { getStockPropio } from "@/lib/informes/propios";
import { getPreciosCompetencia } from "@/lib/informes/precios-competencia";
import { formatFecha, formatPct, formatUnidades } from "@/lib/format";
import { etiquetaPeriodo, filtroDesdeUrl, type SearchParams } from "@/lib/periodo";
import { cn } from "@/lib/utils";

/**
 * Dónde competir: el mercado por tipo de vehículo y banda de precio (y por
 * tipo y motorización), cuánto de cada casillero es nuestro, y contra quién
 * compite cada modelo nuestro. Es el mapa que dice dónde falta producto o
 * precio — la versión para todo el mercado del cruce JETOUR contra CHERY
 * que mostró que el 71% del volumen de CHERY estaba debajo de US$ 21.000.
 *
 * Los rivales son TODO el tipo de vehículo, no solo la banda del modelo
 * nuestro (ver bandas.ts): el comprador de una pick-up compara pick-ups.
 */

/** Segmentos con menos de esto en el período no se dibujan: una fila con
 *  tres unidades no dice nada y roba espacio. Se cuentan en la nota. */
const MINIMO_SEGMENTO = 50;
/** Rivales que se muestran de entrada por modelo; el resto queda plegado
 *  con un "+N más", no afuera. */
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

  const con = asignarPrecios(modelos, [
    { fuente: "cars", lista: propios },
    { fuente: "datacar", lista: rivales },
  ]);
  const mapa = armarMapa(con);
  const unidadesSegmento = (s: string) =>
    [...mapa.celdas.values()].filter((c) => c.segmento === s).reduce((t, c) => t + c.mercado, 0);
  const segmentosMapa = mapa.segmentos.filter((s) => unidadesSegmento(s) >= MINIMO_SEGMENTO);
  const segmentosOmitidos = mapa.segmentos.length - segmentosMapa.length;

  const total = con.reduce((s, m) => s + m.unidades, 0);
  const conPrecio = con.filter((m) => m.precio).reduce((s, m) => s + m.unidades, 0);
  const rivalesTotal = con.filter((m) => !m.esPropia).reduce((s, m) => s + m.unidades, 0);
  const rivalesConPrecio = con.filter((m) => !m.esPropia && m.precio).reduce((s, m) => s + m.unidades, 0);
  const propiasTotal = con.filter((m) => m.esPropia).reduce((s, m) => s + m.unidades, 0);
  const propiasConPrecio = con.filter((m) => m.esPropia && m.precio).reduce((s, m) => s + m.unidades, 0);

  const columnasBanda = [
    ...BANDAS.map((b) => ({ clave: b.clave, etiqueta: b.etiqueta })),
    { clave: SIN_PRECIO, etiqueta: "Sin precio conocido" },
  ];

  // --- mapa por motorización: mismo dibujo, columnas = tecnologías de CADAM.
  const celdasTec = getMapaSegmentoTecnologia({ ...rango, segmento: f.segmento });
  const tecPorSegmento = new Map<string, Map<string, { mercado: number; propias: number }>>();
  const totalTecSegmento = new Map<string, number>();
  const codigosVistos = new Set<string>();
  for (const c of celdasTec) {
    const fila = tecPorSegmento.get(c.segmento) ?? new Map();
    fila.set(c.tecnologia, { mercado: c.mercado, propias: c.propias });
    tecPorSegmento.set(c.segmento, fila);
    totalTecSegmento.set(c.segmento, (totalTecSegmento.get(c.segmento) ?? 0) + c.mercado);
    codigosVistos.add(c.tecnologia);
  }
  const segmentosTec = [...totalTecSegmento.entries()]
    .filter(([, u]) => u >= MINIMO_SEGMENTO)
    .sort((a, b) => b[1] - a[1])
    .map(([s]) => s);
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
    .filter((p) => p.medianaTipo !== null || p.medianaBanda !== null)
    .slice(0, 25);

  const recorte = [
    f.segmento ? `solo ${f.segmento}` : null,
    f.tecnologia ? `solo ${f.tecnologia}` : null,
  ].filter(Boolean).join(" · ");

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        titulo="Dónde competir"
        descripcion={`El mercado por tipo de vehículo, banda de precio y motorización, cuánto de cada casillero es nuestro y contra quién compite cada modelo · ${periodo}${recorte ? ` · ${recorte}` : ""}.`}
        fuente={`Fuente: CADAM (unidades y motorización) · Cars (nuestros precios) · Datacar (precios de la competencia, catálogo de terceros${
          fechaCompetencia ? `, relevado el ${formatFecha(fechaCompetencia)}` : ""
        }).`}
      />

      <FiltroPeriodo
        anios={cobertura.matriculacion.anios}
        mesMaximoPorAnio={mesMax}
        opciones={[
          { param: "segmento", label: "Tipo de vehículo", valores: opcionesSegmento },
          { param: "tecnologia", label: "Motorización", valores: [...TECNOLOGIAS] },
        ]}
      />

      <NotaDato>
        <strong>Cómo leer los mapas.</strong> Cada casillero es un tipo de
        vehículo en una banda de precio (primer mapa) o en una motorización
        (segundo). El número grande es cuánto vendió el mercado ahí
        (matriculaciones); debajo, cuánto de eso es nuestro y qué porcentaje
        representa. Un casillero grande donde nuestra parte es chica es donde
        falta producto o precio; uno chico no vale la pena.{" "}
        <strong>Precio y volumen no salen de la misma fuente:</strong> las
        unidades y la motorización son de CADAM; los precios nuestros, del
        stock de Cars; los de la competencia, de un catálogo de terceros
        (Datacar, {marcasConPrecio.length} marcas) — no es lista oficial. Lo
        que no tiene precio en ninguna fuente va a la última columna, no se
        adivina.{" "}
        {total > 0 && (
          <>
            Cobertura: <strong>{formatPct(conPrecio / total)}</strong> de las
            unidades del período tienen precio ({formatPct(propiasConPrecio / (propiasTotal || 1))} de
            las nuestras, {formatPct(rivalesConPrecio / (rivalesTotal || 1))} de la competencia).
          </>
        )}
        {!carsDisponible && (
          <> <strong>Cars no respondió:</strong> nuestros modelos quedan sin precio en esta corrida.</>
        )}
        {segmentosOmitidos > 0 && (
          <> {segmentosOmitidos} {segmentosOmitidos === 1 ? "tipo" : "tipos"} con menos de {MINIMO_SEGMENTO} unidades no se dibujan.</>
        )}
      </NotaDato>

      <Seccion titulo="Los mapas" id="mapa">
      <Card>
        <CardHeader>
          <CardTitle>Mercado por tipo y banda de precio — {periodo}</CardTitle>
          <p className="text-xs text-muted-foreground">
            Precios de lista en dólares. Arriba, lo que vendió el mercado;
            debajo, lo nuestro y su participación. Cuanto más teñido el
            casillero, más parte nuestra.
          </p>
        </CardHeader>
        <CardContent>
          <TablaMapa
            filas={segmentosMapa}
            columnas={columnasBanda}
            celda={(s, b) => {
              const c = mapa.celda(s, b);
              return c
                ? {
                    mercado: c.mercado,
                    propias: c.propias,
                    detalle: c.modelos.slice(0, 6).map((m) => `${m.marca} ${m.modelo}: ${formatUnidades(m.unidades)}`).join(" · "),
                  }
                : undefined;
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mercado por tipo y motorización — {periodo}</CardTitle>
          <p className="text-xs text-muted-foreground">
            La motorización la informa CADAM en cada matriculación: ICE es
            combustión; MHEV, HEV y PHEV son híbridos (el PHEV se enchufa);
            REEV es eléctrico con motor de apoyo; EV, eléctrico puro. Mismo
            dibujo que el mapa de precios.
            {f.tecnologia ? " El filtro de motorización no recorta este mapa: es la dimensión de sus columnas." : ""}
          </p>
        </CardHeader>
        <CardContent>
          {segmentosTec.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Sin matriculaciones en este recorte.</p>
          ) : (
            <TablaMapa
              filas={segmentosTec}
              columnas={columnasTec}
              celda={(s, t) => tecPorSegmento.get(s)?.get(t)}
            />
          )}
        </CardContent>
      </Card>
      </Seccion>

      <Seccion titulo="Contra quién compite cada modelo nuestro" id="rivales">
      <Card>
        <CardHeader>
          <CardTitle>Rivales — todo su tipo de vehículo, del que más vende al que menos</CardTitle>
          <p className="text-xs text-muted-foreground">
            Para cada modelo nuestro con ventas, todos los modelos de la
            competencia en su mismo tipo de vehículo, con unidades, precio de
            lista y motorización. Los de su misma banda de precio van
            marcados; los demás no quedan afuera: una pick-up compite con
            todas las pick-ups, esté una banda arriba o abajo. Los primeros{" "}
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
                  <TableHead>Rivales del tipo (unidades · precio · motorización)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {duelos.map((d) => {
                  const aLaVista = d.rivales.slice(0, RIVALES_A_LA_VISTA);
                  const plegados = d.rivales.slice(RIVALES_A_LA_VISTA);
                  const parteDelTipo = d.unidadesTipo ? d.propio.unidades / d.unidadesTipo : 0;
                  return (
                    <TableRow key={`${d.propio.marca}|${d.propio.modelo}`}>
                      <TableCell className="align-top">
                        <span className="font-medium">{d.propio.modelo}</span>
                        <span className="block text-xs text-muted-foreground">
                          {d.propio.marca} · {d.propio.segmento}
                          {d.propio.tecnologia && d.propio.tecnologia !== SIN_DATO_TECNOLOGIA ? ` · ${d.propio.tecnologia}` : ""}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums align-top">
                        {formatUnidades(d.propio.unidades)}
                        <span className="block text-[11px] text-muted-foreground whitespace-nowrap">
                          {formatPct(parteDelTipo)} del tipo
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
                          <span className="text-muted-foreground">Ningún rival en este tipo de vehículo.</span>
                        ) : (
                          <>
                            <span className="mb-1 block text-[11px] text-muted-foreground">
                              {d.rivales.length} {d.rivales.length === 1 ? "rival" : "rivales"} ·{" "}
                              {formatUnidades(d.unidadesTipo)} u. en el tipo
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
            misma banda (los que el comprador compara centavo a centavo) y
            contra la mediana de todo su tipo de vehículo. Positivo = más caro
            que la mitad de esos rivales. Cada mediana necesita al menos dos
            rivales con precio.
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
                  <TableHead className="text-right whitespace-nowrap">Mediana de su banda</TableHead>
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
                        {p.propio.marca} · {p.propio.segmento} · {etiquetaBanda(p.propio.banda)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatUnidades(p.propio.unidades)}</TableCell>
                    <TableCell className="text-right tabular-nums">US$ {formatUnidades(p.propio.precio as number)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {p.medianaBanda ? `US$ ${formatUnidades(Math.round(p.medianaBanda))}` : "—"}
                      <span className="block text-[11px] text-muted-foreground">
                        {p.rivalesBanda} {p.rivalesBanda === 1 ? "rival" : "rivales"} con precio
                      </span>
                    </TableCell>
                    <Diferencia valor={p.diferenciaBanda} />
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
 *  Los de la misma banda que nuestro modelo llevan la marca al lado. */
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
 * El dibujo de los mapas: filas = tipos de vehículo, columnas = bandas o
 * motorizaciones. En cada casillero, el mercado arriba y lo nuestro debajo
 * con su participación; el tinte acompaña a la cifra, nunca la reemplaza.
 */
function TablaMapa({
  filas,
  columnas,
  celda,
}: {
  filas: string[];
  columnas: { clave: string; etiqueta: string }[];
  celda: (fila: string, columna: string) => { mercado: number; propias: number; detalle?: string } | undefined;
}) {
  /** 0% nada; 30% o más, el tope. */
  const tinte = (share: number) =>
    share > 0 ? `color-mix(in oklch, var(--primary) ${Math.min(45, Math.round(share * 150))}%, transparent)` : undefined;

  const totalColumna = new Map<string, { mercado: number; propias: number }>();
  for (const fila of filas) {
    for (const c of columnas) {
      const x = celda(fila, c.clave);
      if (!x) continue;
      const t = totalColumna.get(c.clave) ?? { mercado: 0, propias: 0 };
      t.mercado += x.mercado;
      t.propias += x.propias;
      totalColumna.set(c.clave, t);
    }
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tipo</TableHead>
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
                const x = celda(fila, c.clave);
                return { mercado: t.mercado + (x?.mercado ?? 0), propias: t.propias + (x?.propias ?? 0) };
              },
              { mercado: 0, propias: 0 }
            );
            return (
              <TableRow key={fila}>
                <TableCell className="font-medium">{fila}</TableCell>
                {columnas.map((c) => {
                  const x = celda(fila, c.clave);
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
