import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NotaDato, PageHeader } from "@/components/dashboard/page-header";
import { FiltroPeriodo } from "@/components/dashboard/filtro-periodo";
import { Seccion } from "@/components/dashboard/seccion";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { getCobertura, getRankingModelos } from "@/lib/cadam/mercado";
import {
  armarMapa, asignarPrecios, BANDAS, precioRelativo, rivalesDirectos, SIN_PRECIO,
  type PrecioCandidato,
} from "@/lib/cadam/bandas";
import { getStockPropio } from "@/lib/informes/propios";
import { getPreciosCompetencia } from "@/lib/informes/precios-competencia";
import { formatFecha, formatPct, formatUnidades } from "@/lib/format";
import { etiquetaPeriodo, filtroDesdeUrl, type SearchParams } from "@/lib/periodo";
import { cn } from "@/lib/utils";

/**
 * Dónde competir: el mercado por tipo de vehículo y banda de precio, y
 * cuánto de cada casillero es nuestro. Es el mapa que dice dónde falta
 * producto o precio — la versión para todo el mercado del cruce JETOUR
 * contra CHERY que mostró que el 71% del volumen de CHERY estaba debajo de
 * US$ 21.000.
 */

/** Segmentos con menos de esto en el período no se dibujan: una fila con
 *  tres unidades no dice nada y roba espacio. Se cuentan en la nota. */
const MINIMO_SEGMENTO = 50;

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

  // Unidades: CADAM, todas las marcas. Sin filtro de marca ni segmento: el
  // mapa es el mercado entero.
  const modelos = getRankingModelos("matriculacion", { anio: f.anio, mesDesde: f.mesDesde, mesHasta: f.mesHasta }, 3000);

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
  const segmentosMapa = mapa.segmentos.filter((s) => {
    const total = [...mapa.celdas.values()].filter((c) => c.segmento === s).reduce((t, c) => t + c.mercado, 0);
    return total >= MINIMO_SEGMENTO;
  });
  const segmentosOmitidos = mapa.segmentos.length - segmentosMapa.length;

  const total = con.reduce((s, m) => s + m.unidades, 0);
  const conPrecio = con.filter((m) => m.precio).reduce((s, m) => s + m.unidades, 0);
  const rivalesTotal = con.filter((m) => !m.esPropia).reduce((s, m) => s + m.unidades, 0);
  const rivalesConPrecio = con.filter((m) => !m.esPropia && m.precio).reduce((s, m) => s + m.unidades, 0);
  const propiasTotal = con.filter((m) => m.esPropia).reduce((s, m) => s + m.unidades, 0);
  const propiasConPrecio = con.filter((m) => m.esPropia && m.precio).reduce((s, m) => s + m.unidades, 0);

  const columnas = [...BANDAS.map((b) => ({ clave: b.clave, etiqueta: b.etiqueta })), { clave: SIN_PRECIO, etiqueta: "Sin precio conocido" }];
  const totalPorColumna = new Map<string, { mercado: number; propias: number }>();
  for (const c of mapa.celdas.values()) {
    if (!segmentosMapa.includes(c.segmento)) continue;
    const t = totalPorColumna.get(c.banda) ?? { mercado: 0, propias: 0 };
    t.mercado += c.mercado;
    t.propias += c.propias;
    totalPorColumna.set(c.banda, t);
  }

  const duelos = rivalesDirectos(con).filter((d) => d.propio.unidades >= 5).slice(0, 15);
  const relativos = precioRelativo(con).filter((p) => p.mediana !== null).slice(0, 20);

  /** Tinte del casillero según nuestra participación: 0% nada, 30% o más,
   *  el tope. La cifra siempre va escrita al lado: el color acompaña, no
   *  reemplaza. */
  const tinte = (share: number) =>
    share > 0 ? `color-mix(in oklch, var(--primary) ${Math.min(45, Math.round(share * 150))}%, transparent)` : undefined;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        titulo="Dónde competir"
        descripcion={`El mercado por tipo de vehículo y banda de precio, y cuánto de cada casillero es nuestro · ${periodo}.`}
        fuente={`Fuente: CADAM (unidades) · Cars (nuestros precios) · Datacar (precios de la competencia, catálogo de terceros${
          fechaCompetencia ? `, relevado el ${formatFecha(fechaCompetencia)}` : ""
        }).`}
      />

      <FiltroPeriodo anios={cobertura.matriculacion.anios} mesMaximoPorAnio={mesMax} />

      <NotaDato>
        <strong>Cómo leer el mapa.</strong> Cada casillero es un tipo de
        vehículo en una banda de precio. El número grande es cuánto vendió el
        mercado ahí (matriculaciones); debajo, cuánto de eso es nuestro y qué
        porcentaje representa. Un casillero grande donde nuestra parte es
        chica es donde falta producto o precio; uno chico no vale la pena.{" "}
        <strong>Precio y volumen no salen de la misma fuente:</strong> las
        unidades son de CADAM; los precios nuestros, del stock de Cars; los de
        la competencia, de un catálogo de terceros (Datacar,{" "}
        {marcasConPrecio.length} marcas) — no es lista oficial. Lo que no
        tiene precio en ninguna fuente va a la última columna, no se
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

      <Seccion titulo="El mapa" id="mapa">
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
                {segmentosMapa.map((s) => {
                  const filaTotal = columnas.reduce(
                    (t, c) => {
                      const celda = mapa.celda(s, c.clave);
                      return { mercado: t.mercado + (celda?.mercado ?? 0), propias: t.propias + (celda?.propias ?? 0) };
                    },
                    { mercado: 0, propias: 0 }
                  );
                  return (
                    <TableRow key={s}>
                      <TableCell className="font-medium">{s}</TableCell>
                      {columnas.map((c) => {
                        const celda = mapa.celda(s, c.clave);
                        const share = celda && celda.mercado ? celda.propias / celda.mercado : 0;
                        return (
                          <TableCell
                            key={c.clave}
                            className="text-right align-top"
                            style={{ backgroundColor: tinte(share) }}
                            title={celda?.modelos.slice(0, 6).map((m) => `${m.marca} ${m.modelo}: ${formatUnidades(m.unidades)}`).join(" · ")}
                          >
                            {celda ? (
                              <>
                                <span className="block tabular-nums font-semibold">{formatUnidades(celda.mercado)}</span>
                                <span className="block text-[11px] tabular-nums text-muted-foreground">
                                  {celda.propias ? `${formatUnidades(celda.propias)} nuestras · ${formatPct(share)}` : "—"}
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
                    const t = totalPorColumna.get(c.clave);
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
        </CardContent>
      </Card>
      </Seccion>

      <Seccion titulo="Contra quién compite cada modelo nuestro" id="rivales">
      <Card>
        <CardHeader>
          <CardTitle>Rivales directos — mismo tipo, misma banda de precio</CardTitle>
          <p className="text-xs text-muted-foreground">
            Para cada modelo nuestro con ventas, los rivales que más venden en
            su mismo tipo de vehículo y banda. Es la lectura más simple de
            &laquo;contra quién&raquo;: mismo auto, mismo precio.
          </p>
        </CardHeader>
        <CardContent>
          {duelos.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Sin precios propios en esta corrida no se puede ubicar a nuestros modelos en una banda.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nuestro modelo</TableHead>
                  <TableHead className="text-right">Vendidos</TableHead>
                  <TableHead className="text-right">Precio</TableHead>
                  <TableHead>Rivales en su casillero (unidades · precio)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {duelos.map((d) => (
                  <TableRow key={`${d.propio.marca}|${d.propio.modelo}`}>
                    <TableCell>
                      <span className="font-medium">{d.propio.modelo}</span>
                      <span className="block text-xs text-muted-foreground">
                        {d.propio.marca} · {d.propio.segmento}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatUnidades(d.propio.unidades)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {d.propio.precio ? `US$ ${formatUnidades(d.propio.precio)}` : "sin precio"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {d.propio.banda === SIN_PRECIO ? (
                        <span className="text-muted-foreground">Sin precio, no se puede ubicar en una banda.</span>
                      ) : d.rivales.length === 0 ? (
                        <span className="text-muted-foreground">Ningún rival con precio conocido en este casillero.</span>
                      ) : (
                        d.rivales.map((r) => (
                          <span key={`${r.marca}|${r.modelo}`} className="block">
                            <span className="font-medium">{r.marca} {r.modelo}</span>{" "}
                            <span className="text-muted-foreground">
                              · {formatUnidades(r.unidades)} u.{r.precio ? ` · US$ ${formatUnidades(r.precio)}` : ""}
                            </span>
                          </span>
                        ))
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      </Seccion>

      <Seccion titulo="Nuestro precio contra la banda" id="precio-relativo">
      <Card>
        <CardHeader>
          <CardTitle>Estamos caros o baratos, modelo por modelo</CardTitle>
          <p className="text-xs text-muted-foreground">
            Nuestro precio de lista contra la mediana de los rivales de su
            mismo tipo y banda. Positivo = más caro que la mitad de los
            rivales. Solo modelos con al menos dos rivales con precio.
          </p>
        </CardHeader>
        <CardContent>
          {relativos.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Todavía no hay suficientes precios de rivales para comparar.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nuestro modelo</TableHead>
                  <TableHead className="text-right">Vendidos</TableHead>
                  <TableHead className="text-right">Nuestro precio</TableHead>
                  <TableHead className="text-right">Mediana rivales</TableHead>
                  <TableHead className="text-right">Diferencia</TableHead>
                  <TableHead className="text-right">Rivales</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {relativos.map((p) => (
                  <TableRow key={`${p.propio.marca}|${p.propio.modelo}`}>
                    <TableCell>
                      <span className="font-medium">{p.propio.modelo}</span>
                      <span className="block text-xs text-muted-foreground">{p.propio.marca} · {p.propio.segmento}</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatUnidades(p.propio.unidades)}</TableCell>
                    <TableCell className="text-right tabular-nums">US$ {formatUnidades(p.propio.precio as number)}</TableCell>
                    <TableCell className="text-right tabular-nums">US$ {formatUnidades(Math.round(p.mediana as number))}</TableCell>
                    <TableCell
                      className={cn(
                        "text-right tabular-nums font-semibold",
                        (p.diferencia as number) > 0.05 && "text-amber-600 dark:text-amber-500",
                        (p.diferencia as number) < -0.05 && "text-emerald-700 dark:text-emerald-400"
                      )}
                    >
                      {formatPct(p.diferencia as number, { signed: true })}
                      <span className="block text-[11px] font-normal text-muted-foreground">
                        {(p.diferencia as number) > 0.05 ? "más caro" : (p.diferencia as number) < -0.05 ? "más barato" : "parejo"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{p.rivalesConPrecio}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      </Seccion>
    </div>
  );
}
