import Link from "next/link";
import { cookies } from "next/headers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Marca } from "@/components/dashboard/logo-marca";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { NotaDato, PageHeader } from "@/components/dashboard/page-header";
import { Pagina } from "@/components/movimiento/pagina";
import { Seccion } from "@/components/dashboard/seccion";
import { TablaAcciones, type FamiliaAcciones } from "@/components/dashboard/tabla-acciones";
import { cn } from "@/lib/utils";
import { leerSesion, NOMBRE_COOKIE } from "@/lib/auth/sesion";
import { getCobertura, getRankingModelos } from "@/lib/cadam/mercado";
import { getVentasPropias } from "@/lib/informes/propios";
import {
  getAcciones, getMesesAcciones, nombreMes, resumirAcciones,
} from "@/lib/informes/acciones";
import {
  claveCars, claveFamilia, cruzarFamilia, nombreDeClave, type UnidadesModelo,
} from "@/lib/informes/acciones-cruce";
import { formatFechaHora, formatPct, formatUnidades } from "@/lib/format";
import { etiquetaPeriodo, mesCorto, type SearchParams } from "@/lib/periodo";

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
  const meses = getMesesAcciones();
  const acciones = getAcciones(txt(sp.mes));

  // Costo y margen son lo más sensible que hay en la casa: los ve admin.
  // Sin clave configurada no hay sesiones y todo el mundo ve todo (misma
  // regla que el layout).
  const clave = process.env.ADVISOR_CLAVE;
  const sesion = clave ? leerSesion((await cookies()).get(NOMBRE_COOKIE)?.value, clave) : null;
  const esAdmin = !clave || sesion?.rol === "admin";

  if (!acciones) return <SinPlanilla />;

  const marcaSel = txt(sp.marca)?.toUpperCase();
  const segmentoSel = txt(sp.segmento)?.toUpperCase();
  const marcas = acciones.hojas.map((h) => h.marca);
  const segmentos = [...new Set(acciones.hojas.flatMap((h) => h.versiones.map((v) => v.segmento)).filter((s): s is string => !!s))];
  const resumen = resumirAcciones(acciones);
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
    matriculaciones: fMat ? etiquetaPeriodo(anioAcc, 1, fMat.mesHasta).replace(`${anioAcc}`, "").trim() : "sin dato",
    importaciones: fImp ? etiquetaPeriodo(anioAcc, 1, fImp.mesHasta).replace(`${anioAcc}`, "").trim() : "sin dato",
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

  const enlace = (cambios: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    const base: Record<string, string | undefined> = {
      mes: txt(sp.mes), marca: marcaSel, segmento: segmentoSel, ...cambios,
    };
    for (const [k, v] of Object.entries(base)) if (v) q.set(k, v);
    const s = q.toString();
    return `/acciones-comerciales${s ? `?${s}` : ""}`;
  };
  const titulo = nombreMes(acciones.mes);

  return (
    <Pagina>
      <PageHeader
        titulo="Acciones comerciales"
        descripcion={`${acciones.titulo} · descuento máximo, precio con descuento, bono al vendedor y mecánica de cada versión, con lo que cada familia importó, matriculó y facturó en ${anioAcc}.`}
        fuente={`Fuente: «${acciones.archivo}» (Fernando) · modificado ${formatFechaHora(acciones.modificado)} · cargado ${formatFechaHora(acciones.cargado_en)}${ultMat && ultImp ? ` · CADAM matric. hasta ${mesCorto(ultMat.mes)} · import. hasta ${mesCorto(ultImp.mes)}` : ""}${hastaCars ? ` · Cars hasta ${mesCorto(hastaCars)}` : ""}.`}
      />

      <div
        data-revelar=""
        className="-mx-1 flex flex-col gap-2 rounded-xl px-1 py-1 sm:sticky sm:top-16 sm:z-30 sm:bg-background/85 sm:backdrop-blur-md"
      >
        {meses.length > 1 && (
          <Chips
            rotulo="Mes"
            items={meses.map((m) => ({ valor: m, label: nombreMes(m), href: enlace({ mes: m === meses[0] ? undefined : m }), activo: m === acciones.mes }))}
          />
        )}
        <Chips
          rotulo="Marca"
          items={[
            { valor: "", label: "Todas", href: enlace({ marca: undefined }), activo: !marcaSel },
            ...marcas.map((m) => ({ valor: m, label: m, href: enlace({ marca: m }), activo: marcaSel === m })),
          ]}
        />
        <Chips
          rotulo="Segmento"
          items={[
            { valor: "", label: "Todos", href: enlace({ segmento: undefined }), activo: !segmentoSel },
            ...segmentos.map((s) => ({ valor: s, label: s, href: enlace({ segmento: s }), activo: segmentoSel === s })),
          ]}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Versiones" value={formatUnidades(resumen.versiones)} periodo={`${resumen.marcas} marcas · ${titulo}`} />
        <KpiCard
          label="Con descuento"
          value={formatUnidades(resumen.conDescuento)}
          periodo={resumen.descuentoMedio !== null ? `${formatPct(resumen.descuentoMedio)} del PVP, ponderado por stock` : "versiones"}
          tono="tinta"
          tooltip="Versiones con descuento máximo mayor a cero. El porcentaje es descuento sobre PVP, ponderado por el stock de cada versión."
        />
        <KpiCard label="Con bono al vendedor" value={formatUnidades(resumen.conBono)} periodo="versiones" />
        <KpiCard label="Stock" value={formatUnidades(resumen.stock)} periodo="unidades, según la planilla" tono="azul" />
        <KpiCard label="En viaje" value={formatUnidades(resumen.enViaje)} periodo="unidades en camino" tono="verde" />
        <KpiCard
          label="Descuento comprometido"
          value={`US$ ${formatUnidades(Math.round(resumen.descuentoComprometido))}`}
          periodo="stock × descuento máximo"
          tono="ambar"
          tooltip="Lo que costaría vender todo el stock de hoy al precio con descuento máximo. Es una cota, no un pronóstico: no todas las unidades salen con el descuento entero."
        />
      </div>

      <NotaDato>
        <strong>La planilla manda.</strong> Precios, descuentos, márgenes y notas
        se muestran tal cual los cargó Fernando en el Excel; acá no se recalcula
        nada. Lo que sí agrega el tablero es la fila gris de cada familia: cuánto
        matriculó ({etiquetas.matriculaciones}) e importó ({etiquetas.importaciones})
        ese modelo según CADAM{etiquetas.facturadas ? `, y cuánto facturamos nosotros según Cars (${etiquetas.facturadas})` : ""}.
        El cruce es por <strong>familia</strong> (X50, TANK 300, L200), porque las
        tres fuentes escriben la versión distinto; cuando una fuente no tiene la
        familia con ese nombre exacto se usa la más parecida y se marca con «≈».
        {errorCars && (
          <> Cars no respondió ahora ({errorCars}): la facturación propia no se muestra.</>
        )}
        {!esAdmin && <> Costo y márgenes se muestran solo con rol admin.</>}
      </NotaDato>

      {hojas.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Ninguna versión coincide con ese filtro.
          </CardContent>
        </Card>
      )}

      {hojas.map((h) => (
        <Seccion key={h.marca} id={`marca-${h.marca.toLowerCase().replace(/\s+/g, "-")}`} titulo={h.marca}>
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2">
                  <Marca marca={h.marca} tamano="md" />
                </CardTitle>
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <Badge variant="secondary" className="font-normal">
                    {h.versiones.length} {h.versiones.length === 1 ? "versión" : "versiones"}
                  </Badge>
                  <Badge variant="secondary" className="font-normal">
                    {h.versiones.filter((v) => (v.descuento ?? 0) > 0).length} con descuento
                  </Badge>
                  {h.totales.stock > 0 && (
                    <Badge variant="secondary" className="font-normal">stock {formatUnidades(h.totales.stock)}</Badge>
                  )}
                  <Link href="/gama-propia" className="ml-1 text-primary underline-offset-2 hover:underline">
                    Gama propia →
                  </Link>
                  <Link
                    href={`/portafolio?marca=${encodeURIComponent(h.marca)}`}
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    Portafolio →
                  </Link>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <TablaAcciones familias={h.familias} etiquetas={etiquetas} esAdmin={esAdmin} totales={h.totales} />
              {h.notas.length > 0 && (
                <div className="mt-4 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                  <p className="mb-1 font-semibold uppercase tracking-wide text-[10px]">Notas de la hoja</p>
                  <ul className="flex flex-col gap-0.5">
                    {h.notas.map((n, i) => (
                      <li key={i} className="whitespace-pre-wrap">{n}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </Seccion>
      ))}
    </Pagina>
  );
}

function Chips({
  rotulo,
  items,
}: {
  rotulo: string;
  items: { valor: string; label: string; href: string; activo: boolean }[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{rotulo}</span>
      {items.map((it) => (
        <Link
          key={it.valor || "_"}
          href={it.href}
          aria-pressed={it.activo}
          className={cn(
            "rounded-full border px-2.5 py-1 text-xs transition-colors",
            it.activo
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card text-muted-foreground hover:text-foreground"
          )}
        >
          {it.label}
        </Link>
      ))}
    </div>
  );
}

function SinPlanilla() {
  return (
    <Pagina>
      <PageHeader
        titulo="Acciones comerciales"
        descripcion="La planilla mensual de Fernando: descuento máximo, precio con descuento, bono al vendedor y mecánica de cada versión."
      />
      <Card>
        <CardHeader>
          <CardTitle>Todavía no se cargó ninguna planilla</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
          <p>
            Hermes la carga solo cuando aparece o cambia el archivo{" "}
            <code className="rounded bg-muted px-1 py-0.5">ACCIONES COMERCIALES &lt;MES&gt;.xlsx</code>{" "}
            en <code className="rounded bg-muted px-1 py-0.5">~/Escritorio/DASHBOARD FERNANDO/</code> de
            la notebook (cron «Advisor · Acciones comerciales», cada 4 horas). Para
            forzarla ahora:
          </p>
          <div className="rounded-md bg-muted/50 p-2 font-mono text-xs">~/.hermes/scripts/advisor-acciones.sh --force</div>
        </CardContent>
      </Card>
    </Pagina>
  );
}
