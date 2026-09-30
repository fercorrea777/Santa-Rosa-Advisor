import Link from "next/link";
import { cookies } from "next/headers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { NotaDato, PageHeader } from "@/components/dashboard/page-header";
import { Pagina } from "@/components/movimiento/pagina";
import { FiltroPeriodo } from "@/components/dashboard/filtro-periodo";
import {
  TablaRentabilidad,
} from "@/components/dashboard/tabla-rentabilidad";
import { BurbujasRentabilidadChart } from "@/components/charts/burbujas-rentabilidad-chart";
import { leerSesion, NOMBRE_COOKIE } from "@/lib/auth/sesion";
import { getStockPropio, getVentasPropias } from "@/lib/informes/propios";
import { getAcciones, getMesesAcciones, nombreMes } from "@/lib/informes/acciones";
import type { FilaCars } from "@/lib/informes/acciones-cruce";
import { armarRentabilidad, puntosRentabilidad } from "@/lib/informes/rentabilidad";
import { formatFechaHora, formatPct, formatUnidades } from "@/lib/format";
import { etiquetaPeriodo, filtroDesdeUrl, type SearchParams } from "@/lib/periodo";

export const dynamic = "force-dynamic";

const txt = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

/** "71,4 M" (la moneda va al pie de la tarjeta): una cifra de ocho dígitos
 *  con "US$" adelante no entra en la tarjeta y se parte en dos renglones. */
const enMillones = (n: number) =>
  Math.abs(n) >= 1_000_000
    ? `${(n / 1_000_000).toLocaleString("es-PY", { maximumFractionDigits: 1 })} M`
    : formatUnidades(Math.round(n));

/**
 * Rentabilidad por versión: la planilla de acciones (precio y margen)
 * contra lo que facturamos según Cars (unidades), versión por versión, en
 * dos tablas lado a lado y un gráfico de burbujas en cuatro cuadrantes.
 *
 * Pedido de Fernando (18/09/2026), tal cual: "una página de view, arriba
 * el filtro fijo de siempre, abajo un cuadro Marca | Modelo | Versión |
 * PVP base | Margen base | Margen % base; otro cuadro al lado con Cant.
 * vendida | Ticket prom. fact. | Margen promedio | Margen promedio %;
 * ambas tablas con su composición abajo de su valor; después un gráfico
 * de dispersión con burbujas, eje Y cantidad vendida, eje X facturación o
 * margen, dividido en 4 cuadrantes según los valores filtrados, con
 * etiqueta de datos y leyenda por marca. Probemos con esto primero."
 *
 * Qué es cada número —y qué es estimado— está en lib/informes/rentabilidad.ts.
 * Es de admins: acá el margen está en todas las columnas.
 */
export default async function RentabilidadPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const clave = process.env.ADVISOR_CLAVE;
  const sesion = clave ? leerSesion((await cookies()).get(NOMBRE_COOKIE)?.value, clave) : null;
  const esAdmin = !clave || sesion?.rol === "admin";
  if (!esAdmin) return <SoloAdmin />;

  const meses = getMesesAcciones();
  const acciones = getAcciones(txt(sp.mes));
  if (!acciones) return <SinPlanilla />;

  // --- Cars: unidades facturadas en la ventana del filtro -----------------
  // Los años y meses del filtro salen de lo que Cars tiene cargado, no de
  // CADAM: acá la cantidad vendida es la nuestra.
  let ventas: Awaited<ReturnType<typeof getVentasPropias>> = [];
  let errorCars: string | null = null;
  let precios = new Map<string, number>();
  try {
    ventas = await getVentasPropias();
    for (const s of await getStockPropio()) {
      if (s.precio_usd) {
        const k = `${s.marca}|${s.modelo}|${s.version}`;
        precios.set(k, Math.max(precios.get(k) ?? 0, s.precio_usd));
      }
    }
  } catch (e) {
    errorCars = (e as Error).message;
    ventas = [];
    precios = new Map();
  }
  const periodos = [...new Set(ventas.map((v) => v.periodo))].sort();
  const ultimo = periodos.length ? periodos[periodos.length - 1] : null;
  const ultimoCars = ultimo ? { anio: Number(ultimo.slice(0, 4)), mes: Number(ultimo.slice(5, 7)) } : null;
  const anios = [...new Set(periodos.map((p) => Number(p.slice(0, 4))))].sort((a, b) => a - b);
  const mesMax: Record<number, number> = {};
  for (const p of periodos) {
    const a = Number(p.slice(0, 4));
    mesMax[a] = Math.max(mesMax[a] ?? 0, Number(p.slice(5, 7)));
  }
  const f = filtroDesdeUrl(sp, ultimoCars);
  const periodo = etiquetaPeriodo(f.anio, f.mesDesde, f.mesHasta);
  const desde = `${f.anio}-${String(f.mesDesde).padStart(2, "0")}`;
  const hasta = `${f.anio}-${String(f.mesHasta).padStart(2, "0")}`;

  const porFila = new Map<string, FilaCars & { marca: string }>();
  for (const v of ventas) {
    if (v.periodo < desde || v.periodo > hasta) continue;
    const k = `${v.marca}|${v.modelo}|${v.version}`;
    const fila = porFila.get(k);
    if (fila) fila.unidades += v.unidades;
    else porFila.set(k, { marca: v.marca, modelo: v.modelo, version: v.version, unidades: v.unidades, precio: precios.get(k) ?? null });
  }
  const filasCars = [...porFila.values()];

  const r = armarRentabilidad(acciones, filasCars, {
    marca: txt(sp.marca), segmento: txt(sp.segmento), modelo: txt(sp.modelo),
  });
  const t = r.totales;
  const puntosVersion = puntosRentabilidad(r, "version");
  const puntosModelo = puntosRentabilidad(r, "modelo");

  const marcas = acciones.hojas.map((h) => h.marca);
  const segmentos = [...new Set(acciones.hojas.flatMap((h) => h.versiones.map((v) => v.segmento)).filter((s): s is string => !!s))];
  const mesPlanilla = nombreMes(acciones.mes);

  return (
    <Pagina>
      <PageHeader
        titulo="Rentabilidad"
        descripcion={`Precio y margen de cada versión según la planilla de ${mesPlanilla}, contra lo que facturamos en ${periodo}: cuánto vende cada una, a qué ticket y qué margen deja.`}
        fuente={`Fuente: «${acciones.archivo}» (${formatFechaHora(acciones.modificado)}) · Cars, unidades facturadas${ultimo ? ` hasta ${nombreMes(ultimo)}` : ""}.`}
      />

      <FiltroPeriodo
        anios={anios}
        mesMaximoPorAnio={mesMax}
        opciones={[
          ...(meses.length > 1
            ? [{ param: "mes", label: "Planilla", valores: meses.map((m) => ({ valor: m, label: nombreMes(m) })) }]
            : []),
          { param: "marca", label: "Marca", valores: marcas },
          { param: "segmento", label: "Segmento", valores: segmentos },
        ]}
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard
          label="Unidades facturadas"
          value={formatUnidades(t.unidades)}
          periodo={`Cars · ${periodo}`}
          tono="azul"
          tooltip={`Todo lo que Cars facturó de las marcas del filtro en ${periodo}, con o sin fila en la planilla. ${formatUnidades(t.unidadesCruzadas)} de esas unidades tienen versión en la planilla.`}
        />
        <KpiCard
          label="Versiones con venta"
          value={`${formatUnidades(t.versionesConVenta)} de ${formatUnidades(t.versiones)}`}
          periodo="versiones de la planilla"
        />
        <KpiCard
          label="Facturación"
          value={enMillones(t.facturacion)}
          periodo="US$ a precio de acción · estimada"
          tono="tinta"
          tooltip={`US$ ${formatUnidades(Math.round(t.facturacion))}: unidades facturadas × precio con descuento máximo de la planilla. Es el piso de la acción, no el importe real de las facturas: Cars no lo trae de forma confiable.`}
        />
        <KpiCard
          label="Margen"
          value={enMillones(t.margenTotal)}
          periodo={t.margenPct !== null ? `US$ · ${formatPct(t.margenPct)} sobre el precio sin IVA · estimado` : "US$ a precio de acción · estimado"}
          tono={t.margenTotal < 0 ? "ambar" : "verde"}
          tooltip={`US$ ${formatUnidades(Math.round(t.margenTotal))}: unidades facturadas × margen con descuento máximo de la planilla (costo Santa Rosa de la planilla). Es el margen a precio de acción, no el realizado.`}
        />
      </div>

      <NotaDato>
        <strong>Ticket y margen son a precio de acción, no facturados.</strong>{" "}
        Cars trae las unidades que facturamos pero no importes confiables ni costo, así
        que el ticket y el margen «promedio» se calculan con el precio y el margen
        <strong> con descuento máximo</strong> de la planilla de {mesPlanilla} —el piso de
        la acción— por las unidades facturadas en {periodo}. Es una estimación
        conservadora hecha con los números de Fernando; cuando haya dato real de
        factura (SAP), se reemplaza. El cruce planilla ↔ Cars es por versión, uno a
        uno dentro de cada familia: cuando el nombre no es el mismo se marca con «≈»
        y el tooltip dice cómo la llama Cars; lo que Cars facturó sin fila en la
        planilla se lista aparte y cuenta en el total.
        {errorCars && <> <strong>Cars no respondió ahora</strong> ({errorCars}): se ve solo la planilla.</>}
      </NotaDato>

      {r.marcas.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Ninguna versión coincide con ese filtro.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Versión por versión — base y ventas</CardTitle>
              <p className="text-xs text-muted-foreground">
                A la izquierda, lo que dice la{" "}
                <Link href="/acciones-comerciales" className="text-primary underline-offset-2 hover:underline">planilla</Link>{" "}
                de {mesPlanilla} (PVP, margen sin descuento y margen %); a la derecha, lo que
                facturamos en {periodo} y su ticket y margen a precio de acción. Debajo de cada
                valor, qué parte del total del filtro es. La fila de cada familia suma lo que Cars
                facturó de ella, cruzado o no.
              </p>
            </CardHeader>
            <CardContent>
              <TablaRentabilidad r={r} mes={mesPlanilla} periodo={periodo} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Volumen contra ticket y margen · {periodo}</CardTitle>
              <p className="text-xs text-muted-foreground">
                Cada burbuja es una versión (o una familia) con venta: arriba las que
                más facturan en unidades, a la derecha las de mayor ticket o margen.
                Los cuadrantes se cortan en el promedio de lo filtrado. Tocá una marca
                en la leyenda para apagarla.
              </p>
            </CardHeader>
            <CardContent>
              <BurbujasRentabilidadChart versiones={puntosVersion} modelos={puntosModelo} />
            </CardContent>
          </Card>
        </>
      )}
    </Pagina>
  );
}

function SoloAdmin() {
  return (
    <Pagina>
      <PageHeader titulo="Rentabilidad" descripcion="Precio y margen de cada versión contra lo que facturamos." />
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Esta pantalla muestra costos y márgenes: la ve solo el rol administrador.
        </CardContent>
      </Card>
    </Pagina>
  );
}

function SinPlanilla() {
  return (
    <Pagina>
      <PageHeader titulo="Rentabilidad" descripcion="Precio y margen de cada versión contra lo que facturamos." />
      <Card>
        <CardHeader>
          <CardTitle>Todavía no se cargó ninguna planilla de acciones</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          El precio y el margen de cada versión salen de la planilla mensual de Fernando. Cuando Hermes la cargue
          (<Link href="/acciones-comerciales" className="text-primary underline-offset-2 hover:underline">Acciones comerciales</Link>),
          esta pantalla se arma sola.
        </CardContent>
      </Card>
    </Pagina>
  );
}
