import Link from "next/link";
import { cookies } from "next/headers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Marca } from "@/components/dashboard/logo-marca";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { NotaDato, PageHeader } from "@/components/dashboard/page-header";
import { Pagina } from "@/components/movimiento/pagina";
import { FiltroPeriodo } from "@/components/dashboard/filtro-periodo";
import { SelectorVista } from "@/components/dashboard/selector-vista";
import { TablaAcciones, type FamiliaAcciones } from "@/components/dashboard/tabla-acciones";
import { cn } from "@/lib/utils";
import { leerSesion, NOMBRE_COOKIE } from "@/lib/auth/sesion";
import { getCobertura, getRankingModelos } from "@/lib/cadam/mercado";
import { getVentasPropias } from "@/lib/informes/propios";
import {
  getAcciones, getMesesAcciones, resumirAcciones,
} from "@/lib/informes/acciones";
import {
  claveCars, claveFamilia, cruzarFamilia, nombreDeClave, type UnidadesModelo,
} from "@/lib/informes/acciones-cruce";
import { nombreDeMarca } from "@/lib/format";
import { type SearchParams } from "@/lib/periodo";
import { getI18n } from "@/lib/i18n/servidor";

export const dynamic = "force-dynamic";

const txt = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

/**
 * Acciones comerciales del mes.
 *
 * La planilla de Fernando, tal cual: por cada versión el precio de lista,
 * el descuento máximo, el precio con descuento, el bono al vendedor y la
 * mecánica; costo y márgenes solo para admin. Y lo que la planilla no
 * tiene: al lado de cada familia, cuánto matriculó, importó y facturó ese
 * modelo en el año (CADAM y Cars), para que la acción se lea contra el
 * mercado y no en el vacío.
 *
 * Pedido de Fernando (15/09/2026): "cargar las acciones comerciales en
 * nuestro dashboard", en el apartado SANTA ROSA, con la gama propia
 * "vinculada con las acciones comerciales y con importaciones,
 * matriculaciones y ventas".
 */
export default async function AccionesComercialesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const { t, tr, fmt } = await getI18n();
  const { formatFechaHora, formatPct, formatUnidades, etiquetaPeriodo } = fmt;
  // «2026-09» → «Septiembre 2026» | «September 2026» (acciones.ts:nombreMes es solo castellano).
  const nombreMes = (mes: string) => {
    const [a, m] = mes.split("-").map(Number);
    return m >= 1 && m <= 12 ? etiquetaPeriodo(a, m, m) : mes;
  };
  const meses = getMesesAcciones();
  const acciones = getAcciones(txt(sp.mes));

  // Costo y margen son lo más sensible que hay en la casa: los ve admin.
  // Sin clave configurada no hay sesiones y todo el mundo ve todo (misma
  // regla que el layout).
  const clave = process.env.ADVISOR_CLAVE;
  const sesion = clave ? leerSesion((await cookies()).get(NOMBRE_COOKIE)?.value, clave) : null;
  const esAdmin = !clave || sesion?.rol === "admin";

  if (!acciones) return <SinPlanilla />;

  const segmentoSel = txt(sp.segmento)?.toUpperCase();
  const marcas = acciones.hojas.map((h) => h.marca);
  const segmentos = [...new Set(acciones.hojas.flatMap((h) => h.versiones.map((v) => v.segmento)).filter((s): s is string => !!s))];

  // --- una pestaña por marca (Croman, 30/09/2026) --------------------------
  // Las diez hojas una abajo de la otra eran 11.400 px: para ver Mitsubishi
  // había que pasar por nueve marcas. Ahora arranca en la primera hoja de la
  // planilla y «Todas» deja la vista completa (para imprimir o recorrer).
  // La pestaña va en `vista` (no es filtro: «Quitar filtros» no la borra);
  // los enlaces viejos con `?marca=` (Gama propia) caen en su pestaña.
  const TODAS = "todas";
  const vistaPedida = (txt(sp.vista) ?? txt(sp.marca))?.toUpperCase();
  const marcaSel = vistaPedida && marcas.includes(vistaPedida) ? vistaPedida : vistaPedida === TODAS.toUpperCase() ? null : marcas[0];
  const vistas = [
    ...marcas.map((m) => ({ valor: m, label: nombreDeMarca(m) })),
    { valor: TODAS, label: t("Todas"), pista: t("Las diez hojas de la planilla, una abajo de la otra.") },
  ];
  const hojasVista = marcaSel ? acciones.hojas.filter((h) => h.marca === marcaSel) : acciones.hojas;
  // Los números de arriba son los de la pestaña, no los de toda la planilla.
  const resumen = resumirAcciones({ ...acciones, hojas: hojasVista });
  const [anioAcc] = acciones.mes.split("-").map(Number);

  // --- el mercado y Cars, por familia --------------------------------------
  // Año de la planilla, de enero al último mes que tiene cada fuente.
  const cobertura = getCobertura();
  const ultMat = cobertura.matriculacion.ultimo;
  const ultImp = cobertura.importacion.ultimo;
  const ventana = (ult: { anio: number; mes: number } | null) =>
    ult && ult.anio === anioAcc ? { anio: anioAcc, mesDesde: 1, mesHasta: ult.mes } : null;
  const fMat = ventana(ultMat);
  const fImp = ventana(ultImp);
  const modelosDe = (fuente: "matriculacion" | "importacion", marca: string): UnidadesModelo[] => {
    const f = fuente === "matriculacion" ? fMat : fImp;
    if (!f) return [];
    return getRankingModelos(fuente, { ...f, marca }, 500).map((r) => ({ modelo: r.modelo ?? r.clave, unidades: r.unidades }));
  };

  // Facturación propia (Cars). Si Postgres no responde, la columna no
  // aparece y se dice; la planilla no depende de eso.
  let ventasCars: { marca: string; modelo: string; version: string; unidades: number }[] = [];
  let hastaCars: number | null = null;
  let errorCars: string | null = null;
  try {
    const todas = await getVentasPropias();
    for (const v of todas) {
      if (!v.periodo.startsWith(`${anioAcc}-`)) continue;
      const m = Number(v.periodo.slice(5, 7));
      hastaCars = Math.max(hastaCars ?? 0, m);
      ventasCars.push(v);
    }
  } catch (e) {
    errorCars = (e as Error).message;
    ventasCars = [];
  }

  const etiquetas = {
    matriculaciones: fMat ? etiquetaPeriodo(anioAcc, 1, fMat.mesHasta).replace(`${anioAcc}`, "").trim() : t("sin dato"),
    importaciones: fImp ? etiquetaPeriodo(anioAcc, 1, fImp.mesHasta).replace(`${anioAcc}`, "").trim() : t("sin dato"),
    facturadas: hastaCars ? etiquetaPeriodo(anioAcc, 1, hastaCars).replace(`${anioAcc}`, "").trim() : null,
  };

  const hojas = acciones.hojas
    .filter((h) => !marcaSel || h.marca === marcaSel)
    .map((h) => {
      const mat = modelosDe("matriculacion", h.marca);
      const imp = modelosDe("importacion", h.marca);
      const cars = ventasCars
        .filter((v) => v.marca === h.marca)
        .map((v) => ({ modelo: `${v.modelo} | ${v.version}`, unidades: v.unidades, fila: v }));
      const orden: string[] = [];
      const porFamilia = new Map<string, FamiliaAcciones>();
      for (const v of h.versiones) {
        if (segmentoSel && v.segmento !== segmentoSel) continue;
        const clave = claveFamilia(h.marca, v.version) || v.version.toUpperCase();
        let f = porFamilia.get(clave);
        if (!f) {
          f = {
            clave,
            nombre: nombreDeClave(clave),
            versiones: [],
            matriculaciones: cruzarFamilia(h.marca, clave, mat),
            importaciones: cruzarFamilia(h.marca, clave, imp),
            facturadas: hastaCars
              ? cruzarFamilia(h.marca, clave, cars, (m) => claveCars(h.marca, (m as (typeof cars)[number]).fila))
              : null,
          };
          porFamilia.set(clave, f);
          orden.push(clave);
        }
        f.versiones.push(v);
      }
      const familias = orden.map((k) => porFamilia.get(k)!);
      const versiones = familias.flatMap((f) => f.versiones);
      return {
        ...h,
        familias,
        totales: {
          stock: versiones.reduce((s, v) => s + (v.stock ?? 0), 0),
          enViaje: versiones.reduce((s, v) => s + (v.en_viaje ?? 0), 0),
          comprometido: versiones.reduce((s, v) => s + (v.stock ?? 0) * (v.descuento ?? 0), 0),
        },
      };
    })
    .filter((h) => h.familias.length > 0);

  const titulo = nombreMes(acciones.mes);

  return (
    <Pagina>
      <PageHeader
        titulo={t("Acciones comerciales")}
        descripcion={t("{titulo} · descuento máximo, precio con descuento, bono al vendedor y mecánica de cada versión, con lo que cada familia importó, matriculó y facturó en {anio}.", { titulo: acciones.titulo, anio: anioAcc })}
        fuente={t("Fuente: «{archivo}» de Fernando, modificado {modificado} · cargado {cargado}.", { archivo: acciones.archivo, modificado: formatFechaHora(acciones.modificado), cargado: formatFechaHora(acciones.cargado_en) })}
      />

      {/* La misma barra de filtros que el resto del tablero (Croman,
          16/09: "más estético que tenga filtro como las demás secciones"),
          sin Año/Desde/Hasta porque la planilla es de un mes. */}
      <FiltroPeriodo
        sinPeriodo
        opciones={[
          ...(meses.length > 1
            ? [{ param: "mes", label: t("Mes"), valores: meses.map((m) => ({ valor: m, label: nombreMes(m) })) }]
            : []),
          { param: "segmento", label: t("Segmento"), valores: segmentos },
        ]}
      />

      <SelectorVista vistas={vistas} porDefecto={marcas[0]} actual={marcaSel ?? TODAS} quitar={["marca"]} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label={t("Versiones")}
          value={formatUnidades(resumen.versiones)}
          periodo={marcaSel ? `${nombreDeMarca(marcaSel)} · ${titulo}` : t("{n} marcas · {titulo}", { n: resumen.marcas, titulo })}
        />
        <KpiCard
          label={t("Con descuento")}
          value={formatUnidades(resumen.conDescuento)}
          periodo={resumen.descuentoMedio !== null ? t("{pct} del PVP, ponderado por stock", { pct: formatPct(resumen.descuentoMedio) }) : t("versiones")}
          tono="tinta"
          tooltip={t("Versiones con descuento máximo mayor a cero. El porcentaje es descuento sobre PVP, ponderado por el stock de cada versión.")}
        />
        <KpiCard label={t("Con bono al vendedor")} value={formatUnidades(resumen.conBono)} periodo={t("versiones")} />
        <KpiCard label={t("Stock")} value={formatUnidades(resumen.stock)} periodo={t("unidades, según la planilla")} tono="azul" />
        <KpiCard label={t("En viaje")} value={formatUnidades(resumen.enViaje)} periodo={t("unidades en camino")} tono="verde" />
        <KpiCard
          label={t("Descuento comprometido")}
          // En millones cuando pasa el millón y la moneda al pie: «US$
          // 1.287.938» no entraba en la tarjeta y se partía en dos renglones.
          // La cifra exacta va en el tooltip.
          value={
            resumen.descuentoComprometido >= 1_000_000
              ? `${new Intl.NumberFormat(fmt.locale, { maximumFractionDigits: 2 }).format(resumen.descuentoComprometido / 1_000_000)} M`
              : formatUnidades(Math.round(resumen.descuentoComprometido))
          }
          periodo={t("US$ · stock × descuento máximo")}
          tono="ambar"
          tooltip={t("US$ {monto}: lo que costaría vender todo el stock de hoy al precio con descuento máximo. Es una cota, no un pronóstico: no todas las unidades salen con el descuento entero.", { monto: formatUnidades(Math.round(resumen.descuentoComprometido)) })}
        />
      </div>

      <NotaDato>
        {tr(
          "<b>La planilla manda.</b> Precios, descuentos, márgenes y notas se muestran tal cual los cargó Fernando en el Excel; acá no se recalcula nada. Lo que agrega el tablero son las tres columnas de la derecha, en la fila de cada familia: cuánto matriculó ({mat}) e importó ({imp}) ese modelo según CADAM{cars}. El cruce es por <b>familia</b> (X50, TANK 300, L200), porque las tres fuentes escriben la versión distinto; cuando una fuente no tiene la familia con ese nombre exacto se usa la más parecida y se marca con «≈».",
          {
            mat: etiquetas.matriculaciones,
            imp: etiquetas.importaciones,
            cars: etiquetas.facturadas ? t(", y cuánto facturamos nosotros según Cars ({periodo})", { periodo: etiquetas.facturadas }) : "",
          }
        )}
        {errorCars && (
          <> {t("Cars no respondió ahora ({error}): la facturación propia no se muestra.", { error: errorCars })}</>
        )}
        {!esAdmin && <> {t("Costo y márgenes se muestran solo con rol admin.")}</>}
      </NotaDato>

      {hojas.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {t("Ninguna versión coincide con ese filtro.")}
          </CardContent>
        </Card>
      )}

      {hojas.map((h, i) => {
        const conDcto = h.versiones.filter((v) => (v.descuento ?? 0) > 0).length;
        return (
          // Una sola cabecera por marca: el logo con el nombre, el resumen
          // en una línea y los enlaces como botones chicos. La tarjeta ya
          // entra animada por ser tarjeta (movimiento/pagina.tsx).
          <section
            key={h.marca}
            id={`marca-${h.marca.toLowerCase().replace(/\s+/g, "-")}`}
            // Diez marcas × una tabla: de la segunda en adelante el layout se
            // difiere hasta que se acercan al viewport (.seccion-diferida).
            className={cn("scroll-mt-40", i > 0 && "seccion-diferida")}
          >
            <Card>
              <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Marca marca={h.marca} tamano="md" claseNombre="font-semibold" />
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {h.versiones.length === 1 ? t("1 versión") : t("{n} versiones", { n: h.versiones.length })} ·{" "}
                    {t("{n} con descuento", { n: conDcto })}
                    {h.totales.stock > 0 && <> · {t("stock {n}", { n: formatUnidades(h.totales.stock) })}</>}
                    {h.totales.enViaje > 0 && <> · {t("{n} en viaje", { n: formatUnidades(h.totales.enViaje) })}</>}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Link href="/gama-propia" className={ENLACE_CHICO}>{t("Gama propia")}</Link>
                  <Link href={`/portafolio?marca=${encodeURIComponent(h.marca)}`} className={ENLACE_CHICO}>
                    {t("Portafolio")}
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <TablaAcciones familias={h.familias} etiquetas={etiquetas} esAdmin={esAdmin} totales={h.totales} />
                {h.notas.length > 0 && (
                  <div className="mt-4 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide">{t("Notas de la hoja")}</p>
                    <ul className="flex flex-col gap-0.5">
                      {h.notas.map((n, i) => (
                        <li key={i} className="whitespace-pre-wrap">{n}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        );
      })}
    </Pagina>
  );
}

const FOCO = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-1";
const ENLACE_CHICO = cn(
  "rounded-md border border-border bg-card px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
  FOCO
);

async function SinPlanilla() {
  const { t, tr } = await getI18n();
  return (
    <Pagina>
      <PageHeader
        titulo={t("Acciones comerciales")}
        descripcion={t("La planilla mensual de Fernando: descuento máximo, precio con descuento, bono al vendedor y mecánica de cada versión.")}
      />
      <Card>
        <CardHeader>
          <CardTitle>{t("Todavía no se cargó ninguna planilla")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
          <p>
            {tr(
              "Hermes la carga solo cuando aparece o cambia el archivo <code>{archivo}</code> en <code>{carpeta}</code> de la notebook (cron «Advisor · Acciones comerciales», cada 4 horas). Para forzarla ahora:",
              // i18n-ignore (nombre de archivo y carpeta reales: datos, no texto de pantalla)
              { archivo: "ACCIONES COMERCIALES <MES>.xlsx", carpeta: "~/Escritorio/DASHBOARD FERNANDO/" },
              { code: (h) => <code className="rounded bg-muted px-1 py-0.5">{h}</code> }
            )}
          </p>
          {/* i18n-ignore: comando de consola, no es texto de pantalla */}
          <div className="rounded-md bg-muted/50 p-2 font-mono text-xs">~/.hermes/scripts/advisor-acciones.sh --force</div>
        </CardContent>
      </Card>
    </Pagina>
  );
}
