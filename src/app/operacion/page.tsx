import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { NotaDato, PageHeader } from "@/components/dashboard/page-header";
import { FiltroPeriodo } from "@/components/dashboard/filtro-periodo";
import { EmptyState } from "@/components/dashboard/empty-state";
import { SerieAniosChart } from "@/components/charts/serie-anios-chart";
import { DistribucionChart } from "@/components/charts/distribucion-chart";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  getCobertura, getRankingMarcas, totalUnidades,
} from "@/lib/cadam/mercado";
import { getParametros } from "@/lib/cadam/config";
import {
  getEstadoSyncPropio, getStockPropio, getVentasPropias, hayDatosPropios,
} from "@/lib/informes/propios";
import { formatPct, formatUnidades } from "@/lib/format";
import { etiquetaPeriodo, filtroDesdeUrl, type SearchParams } from "@/lib/periodo";
import { cn } from "@/lib/utils";

/**
 * Nuestra operación: lo que facturamos y lo que tenemos en stock, contra el
 * mercado que ya mide el resto del tablero.
 *
 * El dato sale del API de Cars (el DMS de la casa) y lo empuja Hermes; ver
 * src/lib/informes/propios.ts para por qué es push y no pull, y por qué no
 * hay ni plata ni datos de clientes acá.
 */

/** Debajo de este ritmo mensual, "meses de stock" deja de significar algo:
 *  con 1 venta al mes, 12 unidades son "12 meses" y también podrían venderse
 *  las 12 la semana que viene. */
const RITMO_MINIMO = 3;

export default async function OperacionPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const cobertura = getCobertura();
  const f = filtroDesdeUrl(sp, cobertura.matriculacion.ultimo);
  const periodo = etiquetaPeriodo(f.anio, f.mesDesde, f.mesHasta);

  if (!(await hayDatosPropios())) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader
          titulo="Nuestra operación"
          descripcion="Facturación y stock propios, del API de Cars."
        />
        <EmptyState
          title="Todavía no llegaron los datos de Cars"
          description="Los empuja Hermes cada 4 horas desde la máquina donde el API responde. Si pasaron varias horas y sigue vacío, revisá el trabajo advisor-datos-propios en Hermes."
        />
      </div>
    );
  }

  const [ventas, stock, sync] = await Promise.all([
    getVentasPropias(),
    getStockPropio(),
    getEstadoSyncPropio(),
  ]);

  // --- facturación del período filtrado, y del mismo período del año anterior
  const enVentana = (periodoTxt: string, anio: number) => {
    const [a, m] = periodoTxt.split("-").map(Number);
    return a === anio && m >= f.mesDesde && m <= f.mesHasta;
  };
  const facturasPeriodo = ventas.filter((v) => enVentana(v.periodo, f.anio));
  const facturasAnterior = ventas.filter((v) => enVentana(v.periodo, f.anio - 1));
  const totalFacturas = facturasPeriodo.reduce((s, v) => s + v.unidades, 0);
  const totalFacturasAnterior = facturasAnterior.reduce((s, v) => s + v.unidades, 0);

  // --- matriculaciones CADAM de las marcas propias, misma ventana
  const propias = getParametros().marcas_propias.map((m) => m.marca_cadam);
  const rankingMarcas = getRankingMarcas("matriculacion", f);
  const matricPorMarca = new Map(
    rankingMarcas.filter((r) => propias.includes(r.marca)).map((r) => [r.marca, r.unidades])
  );
  const totalMatric = [...matricPorMarca.values()].reduce((s, u) => s + u, 0);
  const mercado = totalUnidades("matriculacion", f);

  // Matriculaciones propias del MISMO período del año anterior. Sirven para
  // contrastar el crecimiento de facturación contra una fuente que no es
  // nuestra: si Cars dice que duplicamos y CADAM dice lo mismo con el
  // registro de la DNRA, el número deja de depender de nuestro propio
  // sistema. Si no coincidieran, eso también hay que verlo.
  const matricAnterior = getRankingMarcas("matriculacion", { ...f, anio: f.anio - 1 })
    .filter((r) => propias.includes(r.marca))
    .reduce((s, r) => s + r.unidades, 0);
  const crecFacturas =
    totalFacturasAnterior > 0 ? totalFacturas / totalFacturasAnterior - 1 : null;
  const crecMatric = matricAnterior > 0 ? totalMatric / matricAnterior - 1 : null;

  // --- stock por marca
  const stockPorMarca = new Map<string, { total: number; reservadas: number }>();
  for (const s of stock) {
    const x = stockPorMarca.get(s.marca) ?? { total: 0, reservadas: 0 };
    x.total += s.unidades;
    x.reservadas += s.reservadas;
    stockPorMarca.set(s.marca, x);
  }
  const totalStock = stock.reduce((s, x) => s + x.unidades, 0);
  const totalReservadas = stock.reduce((s, x) => s + x.reservadas, 0);

  // --- tabla por marca: los tres números al lado, más el stock
  const meses = f.mesHasta - f.mesDesde + 1;
  const marcas = [...new Set([
    ...facturasPeriodo.map((v) => v.marca),
    ...matricPorMarca.keys(),
    ...stockPorMarca.keys(),
  ])];
  // Cars tiene en stock marcas que la casa NO distribuye (BMW, Mazda, Mini,
  // Peugeot...): son unidades de canje y usados, casi siempre 1 o 2. Mezcladas
  // en la tabla eran 20 renglones de guiones que tapaban las 10 que importan.
  // Se resumen en una linea al pie, sin perderlas.
  const esPropia = (m: string) => propias.includes(m);
  const filas = marcas
    .filter(esPropia)
    .map((marca) => {
      const facturado = facturasPeriodo
        .filter((v) => v.marca === marca)
        .reduce((s, v) => s + v.unidades, 0);
      const matriculado = matricPorMarca.get(marca) ?? 0;
      const st = stockPorMarca.get(marca) ?? { total: 0, reservadas: 0 };
      const ritmo = meses > 0 ? facturado / meses : 0;
      return {
        marca,
        facturado,
        matriculado,
        share: mercado ? matriculado / mercado : 0,
        stock: st.total,
        reservadas: st.reservadas,
        // null cuando el ritmo es tan bajo que el cociente no informa nada.
        mesesStock: ritmo >= RITMO_MINIMO ? st.total / ritmo : null,
      };
    })
    .sort((a, b) => b.facturado - a.facturado);

  const ajenas = marcas.filter((m) => !esPropia(m));
  const resumenAjenas = {
    marcas: ajenas.length,
    facturado: facturasPeriodo
      .filter((v) => !esPropia(v.marca))
      .reduce((s, v) => s + v.unidades, 0),
    stock: ajenas.reduce((s, m) => s + (stockPorMarca.get(m)?.total ?? 0), 0),
  };

  // --- serie mensual: facturación de este año contra el anterior
  const serieDe = (anio: number) => {
    const v: (number | null)[] = Array(12).fill(null);
    for (const x of ventas) {
      const [a, m] = x.periodo.split("-").map(Number);
      if (a === anio) v[m - 1] = (v[m - 1] ?? 0) + x.unidades;
    }
    return v;
  };
  const aniosSerie = [f.anio - 1, f.anio].filter((a) =>
    ventas.some((v) => v.periodo.startsWith(String(a)))
  );
  const serie = aniosSerie.map((anio, i) => ({
    anio,
    valores: serieDe(anio),
    punteada: i < aniosSerie.length - 1,
  }));

  const mesMax: Record<number, number> = {};
  for (const a of cobertura.matriculacion.anios) {
    mesMax[a] = a === cobertura.matriculacion.ultimo?.anio
      ? cobertura.matriculacion.ultimo.mes : 12;
  }

  const detalle = (sync?.detalle ?? {}) as Record<string, unknown>;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        titulo="Nuestra operación"
        descripcion={`Lo que facturamos y lo que tenemos en stock · ${periodo}.`}
        fuente={`Fuente: API de Cars (DMS propio)${
          sync ? ` · sincronizado ${new Date(sync.actualizado_en).toLocaleString("es-PY")}` : ""
        }.`}
      />

      <FiltroPeriodo anios={cobertura.matriculacion.anios} mesMaximoPorAnio={mesMax} />

      <NotaDato>
        <strong>Facturar no es matricular.</strong> Cars cuenta cuándo emitimos
        la factura; CADAM, cuándo la DNRA registró el vehículo — y el comprador
        matricula después, o nunca si es flota o si registra en otra plaza. Por
        eso las dos columnas no coinciden y <strong>ninguna de las dos está
        mal</strong>: miden momentos distintos del mismo auto.
        {crecFacturas !== null && crecMatric !== null && (
          <>
            {" "}Que no coincidan no las hace sospechosas: en este período
            nuestra facturación creció{" "}
            <strong>{formatPct(crecFacturas, { signed: true })}</strong> y las
            matriculaciones de nuestras marcas en CADAM —una fuente que no es
            nuestra—{" "}
            <strong>{formatPct(crecMatric, { signed: true })}</strong>. Las dos
            cuentan la misma historia por caminos separados.
          </>
        )}
      </NotaDato>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Facturado"
          value={formatUnidades(totalFacturas)}
          valorAnimado={totalFacturas}
          formato="unidades"
          periodo={periodo}
          variacion={crecFacturas}
          tooltip={`Contra ${formatUnidades(totalFacturasAnterior)} en el mismo período de ${f.anio - 1}.`}
          tono="azul"
        />
        <KpiCard
          label="Matriculado (CADAM)"
          value={formatUnidades(totalMatric)}
          valorAnimado={totalMatric}
          formato="unidades"
          periodo={periodo}
          tooltip="Marcas propias registradas por la DNRA en el mismo período. Es otro evento, no el mismo dato."
          tono="verde"
        />
        <KpiCard
          label="Participación de mercado"
          value={formatPct(mercado ? totalMatric / mercado : 0)}
          valorAnimado={mercado ? totalMatric / mercado : 0}
          formato="porcentaje"
          periodo={periodo}
          tooltip={`${formatUnidades(totalMatric)} de ${formatUnidades(mercado)} matriculaciones del país. Se mide con CADAM, no con nuestras facturas: el denominador es el mercado.`}
          tono="tinta"
        />
        <KpiCard
          label="Unidades en stock"
          value={formatUnidades(totalStock)}
          valorAnimado={totalStock}
          formato="unidades"
          periodo="Hoy"
          tooltip={`${formatUnidades(totalReservadas)} reservadas. Incluye lo que está en viaje: ver el corte por estado.`}
          chipIcono="segmentos"
          chipTono="amber"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Facturación mensual</CardTitle>
            <p className="text-xs text-muted-foreground">
              Unidades facturadas por mes. El año anterior va punteado.
            </p>
          </CardHeader>
          <CardContent>
            {serie.length ? (
              <SerieAniosChart series={serie} />
            ) : (
              <p className="py-16 text-center text-sm text-muted-foreground">
                Sin facturación cargada para estos años.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Stock por estado — hoy</CardTitle>
            <p className="text-xs text-muted-foreground">
              «En viaje» y «sin despachar» no se pueden entregar mañana: por eso
              el estado no se colapsa en un solo número de stock.
            </p>
          </CardHeader>
          <CardContent>
            <DistribucionChart
              datos={[...stock
                .reduce((m, s) => m.set(s.estado, (m.get(s.estado) ?? 0) + s.unidades), new Map<string, number>())
                .entries()]
                .map(([nombre, valor]) => ({ nombre, valor }))}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Marca por marca — {periodo}</CardTitle>
          <p className="text-xs text-muted-foreground">
            Los tres números al lado: lo que facturamos (Cars), lo que se
            matriculó (CADAM) y qué parte del mercado es eso. El stock y su
            cobertura son de hoy, no del período.
          </p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Marca</TableHead>
                <TableHead className="text-right">Facturado</TableHead>
                <TableHead className="text-right">Matriculado</TableHead>
                <TableHead className="text-right">Share</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Reservadas</TableHead>
                <TableHead className="text-right">Meses de stock</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((r) => (
                <TableRow key={r.marca}>
                  <TableCell className="font-medium">{r.marca}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.facturado ? formatUnidades(r.facturado) : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.matriculado ? formatUnidades(r.matriculado) : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.matriculado ? formatPct(r.share) : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.stock ? formatUnidades(r.stock) : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {r.reservadas ? formatUnidades(r.reservadas) : "—"}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right tabular-nums",
                      r.mesesStock !== null && r.mesesStock > 6 &&
                        "text-amber-600 dark:text-amber-500"
                    )}
                    title={
                      r.mesesStock === null
                        ? `Menos de ${RITMO_MINIMO} facturas por mes: el cociente no informa nada.`
                        : undefined
                    }
                  >
                    {r.mesesStock === null ? "—" : `${r.mesesStock.toFixed(1)}`}
                  </TableCell>
                </TableRow>
              ))}
              {resumenAjenas.marcas > 0 && (
                <TableRow className="text-muted-foreground">
                  <TableCell className="italic">
                    Otras {resumenAjenas.marcas} marcas (canje y usados)
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {resumenAjenas.facturado ? formatUnidades(resumenAjenas.facturado) : "—"}
                  </TableCell>
                  <TableCell className="text-right">—</TableCell>
                  <TableCell className="text-right">—</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {resumenAjenas.stock ? formatUnidades(resumenAjenas.stock) : "—"}
                  </TableCell>
                  <TableCell className="text-right">—</TableCell>
                  <TableCell className="text-right">—</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {resumenAjenas.marcas > 0 && (
            <p className="pt-3 text-xs text-muted-foreground">
              Las {resumenAjenas.marcas} marcas que la casa no distribuye (unidades
              de canje y usados, casi siempre una o dos) van resumidas en la última
              fila: sueltas eran veinte renglones de guiones tapando las que
              importan. Aparecen igual en el stock por modelo de abajo.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Stock por modelo — hoy</CardTitle>
          <p className="text-xs text-muted-foreground">
            Los 25 modelos con más unidades. El precio es el de lista de Cars,
            en dólares: la mediana del modelo, porque un modelo con versiones de
            30k y 39k no tiene un &laquo;promedio&raquo; que exista en la lista.
          </p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Marca</TableHead>
                <TableHead>Modelo</TableHead>
                <TableHead className="text-right">Unidades</TableHead>
                <TableHead className="text-right">Precio lista</TableHead>
                <TableHead>Estados</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...stock
                .reduce((m, s) => {
                  const k = `${s.marca}|${s.modelo}`;
                  const x = m.get(k) ?? {
                    marca: s.marca, modelo: s.modelo, unidades: 0,
                    precio: s.precio_usd, estados: [] as string[],
                  };
                  x.unidades += s.unidades;
                  x.precio = x.precio ?? s.precio_usd;
                  x.estados.push(`${s.estado} ${s.unidades}`);
                  return m.set(k, x);
                }, new Map<string, { marca: string; modelo: string; unidades: number; precio: number | null; estados: string[] }>())
                .values()]
                .sort((a, b) => b.unidades - a.unidades)
                .slice(0, 25)
                .map((m) => (
                  <TableRow key={`${m.marca}|${m.modelo}`}>
                    <TableCell className="font-medium">{m.marca}</TableCell>
                    <TableCell>{m.modelo}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatUnidades(m.unidades)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {m.precio ? `US$ ${formatUnidades(m.precio)}` : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {m.estados.join(" · ")}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <NotaDato>
        <strong>Acá no hay facturación en guaraníes ni dólares, a propósito.</strong>{" "}
        Cars devuelve importes, pero no cierran: en 2026 hay 2.936 facturas
        marcadas «DOLARES» con montos de 54 millones a 4,8 billones —o sea
        guaraníes, con basura adentro— y 54 marcadas «GUARANIES» que arrancan en
        29.990. Publicar facturación con esa base sería inventar una cifra. Las
        unidades sí cierran, y son lo que se muestra. El precio de lista de las
        unidades es harina de otro costal: ese sí está en dólares y es creíble.
        {typeof detalle.facturas_leidas === "number" && (
          <>
            {" "}Última sincronización: {String(detalle.facturas_leidas)} facturas y{" "}
            {String(detalle.unidades_leidas ?? "?")} unidades leídas de Cars,
            agregadas antes de salir de la máquina — el Advisor nunca recibe
            nombres, correos, teléfonos ni VIN de clientes.
          </>
        )}
      </NotaDato>
    </div>
  );
}
