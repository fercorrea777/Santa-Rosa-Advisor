import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LogoMarca, Marca } from "@/components/dashboard/logo-marca";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { NotaDato, PageHeader } from "@/components/dashboard/page-header";
import { Pagina } from "@/components/movimiento/pagina";
import { FiltroPeriodo } from "@/components/dashboard/filtro-periodo";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Seccion } from "@/components/dashboard/seccion";
import { SelectorVista } from "@/components/dashboard/selector-vista";
import { TablaStockModelos, type ModeloStock } from "@/components/dashboard/tabla-stock-modelos";
import { SerieAniosChart } from "@/components/charts/serie-anios-chart";
import { DistribucionChart } from "@/components/charts/distribucion-chart";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  getCobertura, getRankingMarcas, totalUnidades,
} from "@/lib/cadam/mercado";
import { getAsesoresMayoristasSet, getMetasMensuales, getParametros, getPresupuesto } from "@/lib/cadam/config";
import {
  cumplimiento, facturadoEntre, planPeriodo, porcentajeHecho,
} from "@/lib/informes/presupuesto";
import { PlanVsFacturadoChart } from "@/components/charts/plan-vs-facturado-chart";
import { hoyEnAsuncion } from "@/lib/format";
import {
  getEstadoSyncPropio, getStockPropio, getVentasAsesor, getVentasPropias,
  hayDatosPropios,
} from "@/lib/informes/propios";
import {
  calcularCobertura, estadosDesconocidos, RITMO_MINIMO as RITMO_MINIMO_VERSION,
} from "@/lib/informes/cobertura";
import { getLeadsAsesor, normalizarNombre } from "@/lib/informes/leads-asesor";
import { getPautaMarca } from "@/lib/informes/pauta-marca";
import {
  getActualizacionDemandaBitrix, getDemandaBitrix, type DemandaBitrix,
} from "@/lib/informes/demanda-bitrix";
import { tokens as tokensNombre } from "@/lib/informes/segmento-version";
import { filtroDesdeUrl, type SearchParams } from "@/lib/periodo";
import { getI18n } from "@/lib/i18n/servidor";
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

// i18n-ignore (valor centinela que viaja como clave y se compara; se traduce al mostrarlo, con t("Sin sucursal"))
const SIN_SUCURSAL = "Sin sucursal";

export default async function OperacionPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const { t, tr, fmt, idioma } = await getI18n();
  const { formatDecimal, formatFechaHora, formatPct, formatUnidades, etiquetaPeriodo, mesCorto } = fmt;
  const cobertura = getCobertura();

  if (!(await hayDatosPropios())) {
    return (
      <Pagina>
        <PageHeader
          titulo={t("Nuestra operación")}
          descripcion={t("Facturación y stock propios, del API de Cars.")}
        />
        <EmptyState
          title={t("Todavía no llegaron los datos de Cars")}
          description={t("Los empuja Hermes cada 4 horas desde la máquina donde el API responde. Si pasaron varias horas y sigue vacío, revisá el trabajo advisor-datos-propios en Hermes.")}
        />
      </Pagina>
    );
  }

  const [
    ventasCrudas, stockCrudo, asesoresCrudos, sync, leadsCrudos, pautaCruda, demandaCruda, demandaFecha,
  ] = await Promise.all([
    getVentasPropias(),
    getStockPropio(),
    getVentasAsesor(),
    getEstadoSyncPropio(),
    getLeadsAsesor(),
    getPautaMarca(),
    getDemandaBitrix(),
    getActualizacionDemandaBitrix(),
  ]);

  // --- período: lo manda CARS, no CADAM -------------------------------
  // CADAM cierra por mes (hoy, julio) y el resto del tablero se acota a eso.
  // Esta página es la operación PROPIA y Cars llega hasta hoy: con el tope
  // de CADAM, agosto y septiembre no se podían ni elegir. Por defecto, el
  // último mes con facturas (el que está corriendo).
  const periodosCars = [...new Set(ventasCrudas.map((v) => v.periodo))].sort();
  const ultimoPeriodoCars = periodosCars[periodosCars.length - 1];
  const ultimoCars = ultimoPeriodoCars
    ? { anio: Number(ultimoPeriodoCars.slice(0, 4)), mes: Number(ultimoPeriodoCars.slice(5, 7)) }
    : cobertura.matriculacion.ultimo;
  const f = filtroDesdeUrl(sp, ultimoCars);
  const periodo = etiquetaPeriodo(f.anio, f.mesDesde, f.mesHasta);

  // CADAM se recorta a su último mes cerrado, y se DICE. Si no, "Matriculado"
  // compararía nueve meses de facturas contra siete de matriculaciones y la
  // brecha parecería un problema de registro.
  const ultimoCadam = cobertura.matriculacion.ultimo;
  const cadamRecorta =
    !!ultimoCadam && f.anio === ultimoCadam.anio && f.mesHasta > ultimoCadam.mes;
  const fCadam = cadamRecorta && ultimoCadam ? { ...f, mesHasta: ultimoCadam.mes } : f;
  const cadamDisponible =
    !!ultimoCadam &&
    (f.anio < ultimoCadam.anio || (f.anio === ultimoCadam.anio && f.mesDesde <= ultimoCadam.mes));
  const periodoCadam = etiquetaPeriodo(fCadam.anio, fCadam.mesDesde, fCadam.mesHasta);
  const hastaCadam = ultimoCadam ? mesCorto(ultimoCadam.mes) : "";

  // --- filtro de marca: cascada a TODO lo de esta página, como en el resto
  // del tablero. `f.marca` ya viaja de filtroDesdeUrl() (mismo param que
  // usan mercado/rankings/etc), así que un link "?marca=JETOUR" de otra
  // pantalla ya llegaba filtrando CADAM a medias antes de este cambio —
  // ver el porqué de `mercado` más abajo.
  const ventas = f.marca ? ventasCrudas.filter((v) => v.marca === f.marca) : ventasCrudas;
  const stock = f.marca ? stockCrudo.filter((s) => s.marca === f.marca) : stockCrudo;
  const asesoresCrudosF = f.marca
    ? asesoresCrudos.filter((a) => a.marca === f.marca)
    : asesoresCrudos;

  // --- facturación del período filtrado, y del mismo período del año anterior
  const enVentana = (periodoTxt: string, anio: number, hasta = f.mesHasta) => {
    const [a, m] = periodoTxt.split("-").map(Number);
    return a === anio && m >= f.mesDesde && m <= hasta;
  };
  const facturasPeriodo = ventas.filter((v) => enVentana(v.periodo, f.anio));
  const facturasAnterior = ventas.filter((v) => enVentana(v.periodo, f.anio - 1));
  const totalFacturas = facturasPeriodo.reduce((s, v) => s + v.unidades, 0);
  const totalFacturasAnterior = facturasAnterior.reduce((s, v) => s + v.unidades, 0);
  // Para la frase que compara con CADAM, la facturación va en la MISMA
  // ventana que CADAM (hasta su último mes cerrado): si no, 9 meses contra 7.
  const totalFacturasCadam = ventas
    .filter((v) => enVentana(v.periodo, f.anio, fCadam.mesHasta))
    .reduce((s, v) => s + v.unidades, 0);
  const totalFacturasCadamAnterior = ventas
    .filter((v) => enVentana(v.periodo, f.anio - 1, fCadam.mesHasta))
    .reduce((s, v) => s + v.unidades, 0);

  // --- matriculaciones CADAM de las marcas propias, misma ventana
  const propias = getParametros().marcas_propias.map((m) => m.marca_cadam);
  const rankingMarcas = cadamDisponible ? getRankingMarcas("matriculacion", fCadam) : [];
  const matricPorMarca = new Map(
    rankingMarcas.filter((r) => propias.includes(r.marca)).map((r) => [r.marca, r.unidades])
  );
  const totalMatric = [...matricPorMarca.values()].reduce((s, u) => s + u, 0);
  // SIEMPRE el mercado COMPLETO, nunca filtrado por marca: es el
  // denominador del share. Si se filtrara con f.marca, elegir una marca
  // dejaría el share en ~100% — no porque ganamos el mercado, sino porque
  // el mercado pasaría a ser esa sola marca.
  const mercado = cadamDisponible
    ? totalUnidades("matriculacion", { ...fCadam, marca: undefined })
    : 0;

  // Matriculaciones propias del MISMO período del año anterior. Sirven para
  // contrastar el crecimiento de facturación contra una fuente que no es
  // nuestra: si Cars dice que duplicamos y CADAM dice lo mismo con el
  // registro de la DNRA, el número deja de depender de nuestro propio
  // sistema. Si no coincidieran, eso también hay que verlo.
  const matricAnterior = cadamDisponible
    ? getRankingMarcas("matriculacion", { ...fCadam, anio: fCadam.anio - 1 })
        .filter((r) => propias.includes(r.marca))
        .reduce((s, r) => s + r.unidades, 0)
    : 0;
  const crecFacturas =
    totalFacturasAnterior > 0 ? totalFacturas / totalFacturasAnterior - 1 : null;
  const crecFacturasCadam =
    totalFacturasCadamAnterior > 0 ? totalFacturasCadam / totalFacturasCadamAnterior - 1 : null;
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

  // --- metas: plan vigente por marca y mes (Excel de Finanzas vía Hermes, o
  // la grilla de Configuración) y presupuesto anual original -------------
  const metasAnio = getMetasMensuales(f.anio);
  const hayMetas = Object.keys(metasAnio).length > 0;
  const presupuesto = getPresupuesto(f.anio);
  const hayPresupuesto = presupuesto !== null;
  const realHastaMes = presupuesto?.real_hasta_mes ?? null;
  // Siempre sobre TODAS las facturas, no las filtradas por marca: una fila
  // de grupo (GREAT WALL + HAVAL) suma sus marcas aunque el filtro sea una.
  const sumaMeses = (marcas: string[], anio: number, desde: number, hasta: number) =>
    facturadoEntre(ventasCrudas, marcas, anio, desde, hasta);
  // Proyección de cierre de año, por marca: lo facturado hasta el último
  // mes cerrado, más lo que el año pasado se vendió en los meses que
  // faltan, escalado por cómo viene este año contra el pasado en los mismos
  // meses (la estacionalidad la pone el año pasado, el nivel lo pone este).
  // Solo para el año en curso: un año cerrado no se proyecta.
  const hoyIso = hoyEnAsuncion();
  const mesCerrado = Number(hoyIso.slice(5, 7)) - 1;
  const proyectar = f.anio === Number(hoyIso.slice(0, 4)) && mesCerrado >= 1;
  const proyeccionDe = (marcas: string[]): number | null => {
    if (!proyectar) return null;
    const ytd = sumaMeses(marcas, f.anio, 1, mesCerrado);
    const lyYtd = sumaMeses(marcas, f.anio - 1, 1, mesCerrado);
    const lyResto = sumaMeses(marcas, f.anio - 1, mesCerrado + 1, 12);
    if (lyYtd > 0 && lyResto > 0) return Math.round(ytd + lyResto * (ytd / lyYtd));
    return Math.round(ytd + (ytd / mesCerrado) * (12 - mesCerrado));
  };
  // Hasta dónde llega el "YTD" del presupuesto: el último mes cerrado del
  // año en curso, o el año entero si el filtro es un año cerrado.
  const hastaYtd = proyectar ? mesCerrado : 12;

  // --- pauta de Meta por marca, mismo período (la marca sale del nombre de
  // la cuenta publicitaria; VARIAS y RENEW no se reparten, van al total).
  const pautaPeriodo = pautaCruda.filter((p) => enVentana(p.periodo, f.anio));
  const hayPauta = pautaPeriodo.length > 0;
  const pautaDe = (marca: string) =>
    pautaPeriodo.filter((p) => p.marca === marca).reduce((s, p) => s + p.gasto_usd, 0);
  const pautaTotal = pautaPeriodo.reduce((s, p) => s + p.gasto_usd, 0);
  const pautaSinMarca = pautaPeriodo
    .filter((p) => !propias.includes(p.marca))
    .reduce((s, p) => s + p.gasto_usd, 0);

  // --- unidades de la tabla: un GRUPO presupuestado (GWM = GREAT WALL +
  // HAVAL, LEAPMOTOR + JMEV) es una fila, así lo presupuesta Finanzas; las
  // marcas sin grupo, una fila cada una. Con el filtro de marca puesto se
  // muestra solo la fila que la contiene.
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
  const grupos: { marcas: string[]; plan: number[] | null; presupuestoAnual: number | null }[] = [];
  const enGrupo = new Set<string>();
  for (const g of presupuesto?.grupos ?? []) {
    grupos.push({ marcas: g.marcas, plan: g.plan, presupuestoAnual: g.presupuesto_anual });
    for (const m of g.marcas) enGrupo.add(m);
  }
  for (const m of marcas) {
    if (!esPropia(m) || enGrupo.has(m)) continue;
    const meta = metasAnio[m];
    grupos.push({
      marcas: [m],
      plan: meta?.some((v) => v !== null) ? meta.map((v) => v ?? 0) : null,
      presupuestoAnual: null,
    });
  }
  // Matriculaciones y stock por marca SIN el filtro de marca, para sumar
  // grupos enteros (`matricPorMarca` y `stockPorMarca` sí están filtrados).
  const matricTodas = new Map(
    (cadamDisponible ? getRankingMarcas("matriculacion", { ...fCadam, marca: undefined }) : [])
      .filter((r) => propias.includes(r.marca))
      .map((r) => [r.marca, r.unidades])
  );
  const stockTodas = new Map<string, { total: number; reservadas: number }>();
  for (const st of stockCrudo) {
    const x = stockTodas.get(st.marca) ?? { total: 0, reservadas: 0 };
    x.total += st.unidades;
    x.reservadas += st.reservadas;
    stockTodas.set(st.marca, x);
  }
  const filas = grupos
    .filter((g) => !f.marca || g.marcas.includes(f.marca))
    .map((g) => {
      const facturado = sumaMeses(g.marcas, f.anio, f.mesDesde, f.mesHasta);
      const matriculado = g.marcas.reduce((acc, m) => acc + (matricTodas.get(m) ?? 0), 0);
      const st = g.marcas.reduce(
        (acc, m) => {
          const x = stockTodas.get(m);
          return x ? { total: acc.total + x.total, reservadas: acc.reservadas + x.reservadas } : acc;
        },
        { total: 0, reservadas: 0 }
      );
      const ritmo = meses > 0 ? facturado / meses : 0;
      const pp = g.plan ? planPeriodo(g.plan, f.mesDesde, f.mesHasta, realHastaMes) : null;
      // Facturado de los meses ABIERTOS del filtro: lo del período menos lo
      // de los meses que el Excel ya cerró.
      const facturadoAbiertos = pp
        ? facturado -
          (realHastaMes ? sumaMeses(g.marcas, f.anio, f.mesDesde, Math.min(realHastaMes, f.mesHasta)) : 0)
        : 0;
      const facturadoYtd = sumaMeses(g.marcas, f.anio, 1, hastaYtd);
      return {
        clave: g.marcas.join("+"),
        etiqueta: g.marcas.join(" + "),
        marcas: g.marcas,
        esGrupo: g.marcas.length > 1,
        plan: g.plan,
        facturado,
        matriculado,
        share: mercado ? matriculado / mercado : 0,
        stock: st.total,
        reservadas: st.reservadas,
        // null cuando el ritmo es tan bajo que el cociente no informa nada.
        mesesStock: ritmo >= RITMO_MINIMO ? st.total / ritmo : null,
        meta: pp?.plan ?? 0,
        abiertos: pp?.abiertos ?? 0,
        cumplimiento: pp ? cumplimiento(facturadoAbiertos, pp.planAbiertos, pp.abiertos) : null,
        metaAnio: g.plan ? g.plan.reduce((acc, v) => acc + v, 0) : 0,
        presupuestoAnual: g.presupuestoAnual,
        facturadoYtd,
        hecho: porcentajeHecho(facturadoYtd, g.presupuestoAnual),
        proyeccion: proyeccionDe(g.marcas),
        pauta: g.marcas.reduce((acc, m) => acc + pautaDe(m), 0),
      };
    })
    .sort((a, b) => b.facturado - a.facturado);
  const conPresupuesto = filas.filter((r) => r.presupuestoAnual);
  const presupuestoTotal = conPresupuesto.reduce((acc, r) => acc + (r.presupuestoAnual ?? 0), 0);
  const hechoTotal = porcentajeHecho(
    conPresupuesto.reduce((acc, r) => acc + r.facturadoYtd, 0),
    presupuestoTotal
  );
  const planTotalAnio = filas.reduce((acc, r) => acc + r.metaAnio, 0);
  const metaTotal = filas.reduce((acc, r) => acc + r.meta, 0);
  const facturadoYtdTotal = filas.reduce((acc, r) => acc + r.facturadoYtd, 0);
  // Plan vs facturado por mes, para el gráfico: solo las filas con plan.
  const conPlan = filas.filter((r) => r.plan);
  const mesesPlan = hayPresupuesto
    ? Array.from({ length: 12 }, (_, i) => ({
        mes: i + 1,
        plan: conPlan.reduce((acc, r) => acc + (r.plan?.[i] ?? 0), 0),
        facturado: conPlan.reduce((acc, r) => acc + sumaMeses(r.marcas, f.anio, i + 1, i + 1), 0),
        cerrado: realHastaMes !== null && i + 1 <= realHastaMes,
      }))
    : [];
  const referenciaMensual = presupuestoTotal > 0 ? presupuestoTotal / 12 : null;
  // Canales presupuestados aparte (CDE, Wholesale): objetivo y real de
  // FINANZAS, del mismo Excel. No se cruzan con Cars: ver la nota en pantalla.
  const canales = (presupuesto?.canales ?? []).map((c) => {
    const hasta = c.real_hasta_mes ?? 0;
    const objetivoYtd = c.plan.slice(0, hasta).reduce((acc, v) => acc + v, 0);
    const realYtd = c.real.slice(0, hasta).reduce<number>((acc, v) => acc + (v ?? 0), 0);
    return {
      canal: c.canal,
      realHastaMes: c.real_hasta_mes,
      objetivoYtd,
      realYtd,
      cumplimiento: objetivoYtd > 0 && hasta > 0 ? realYtd / objetivoYtd : null,
      objetivoAnual: c.plan.reduce((acc, v) => acc + v, 0),
      meses: c.plan.map((plan, i) => ({
        mes: i + 1, plan, facturado: c.real[i] ?? 0, cerrado: false,
      })),
    };
  });

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

  // Años y tope de mes según CARS (más los años que solo CADAM tiene): el
  // último año llega hasta el último mes con facturas, no hasta el cierre
  // de CADAM.
  const aniosFiltro = [...new Set([
    ...cobertura.matriculacion.anios,
    ...periodosCars.map((p) => Number(p.slice(0, 4))),
  ])].sort((a, b) => a - b);
  const mesMax: Record<number, number> = {};
  for (const a of aniosFiltro) {
    mesMax[a] = ultimoCars && a === ultimoCars.anio ? ultimoCars.mes : 12;
  }

  // --- ranking de asesores: mismo período, ya filtrado por marca arriba.
  // Los MAYORISTAS (flotas, gerencia — lista en parametros.json) salen del
  // ranking: son otro negocio y aplastan a cualquier asesor retail. Van en
  // su propio cuadro, no desaparecen.
  const mayoristas = getAsesoresMayoristasSet();
  const asesoresTodos = asesoresCrudosF.filter((a) => enVentana(a.periodo, f.anio));
  const asesoresPeriodo = asesoresTodos.filter((a) => !mayoristas.has(a.asesor));
  const mayoristasPeriodo = [...asesoresTodos
    .filter((a) => mayoristas.has(a.asesor))
    .reduce((m, a) => m.set(a.asesor, (m.get(a.asesor) ?? 0) + a.unidades), new Map<string, number>())
    .entries()]
    .map(([asesor, unidades]) => ({ asesor, unidades }))
    .sort((a, b) => b.unidades - a.unidades);
  const unidadesMayoristas = mayoristasPeriodo.reduce((s, m) => s + m.unidades, 0);
  const rankingAsesores = [...asesoresPeriodo
    .reduce((m, a) => m.set(a.asesor, (m.get(a.asesor) ?? 0) + a.unidades), new Map<string, number>())
    .entries()]
    .map(([asesor, unidades]) => ({ asesor, unidades }))
    .sort((a, b) => b.unidades - a.unidades);
  const unidadesConAsesor = rankingAsesores.reduce((s, a) => s + a.unidades, 0);

  // Mejor asesor de cada marca: agrupa por marca y, dentro, por asesor.
  const porMarcaAsesor = new Map<string, Map<string, number>>();
  for (const a of asesoresPeriodo) {
    const m = porMarcaAsesor.get(a.marca) ?? new Map<string, number>();
    m.set(a.asesor, (m.get(a.asesor) ?? 0) + a.unidades);
    porMarcaAsesor.set(a.marca, m);
  }
  const mejorPorMarca = [...porMarcaAsesor.entries()]
    .filter(([marca]) => propias.includes(marca))
    .map(([marca, mapa]) => {
      const ordenado = [...mapa.entries()].sort((a, b) => b[1] - a[1]);
      return {
        marca,
        totalMarca: ordenado.reduce((s, [, n]) => s + n, 0),
        asesoresDistintos: ordenado.length,
        mejorNombre: ordenado[0][0],
        mejorUnidades: ordenado[0][1],
      };
    })
    .sort((a, b) => b.totalMarca - a.totalMarca);

  // "VENTAS GERENCIA" y variantes: Cars las trae en el mismo campo Vendedor
  // que un asesor real. No se pueden distinguir de forma confiable acá, así
  // que se muestran igual — la nota de la sección lo aclara.
  //
  // Razón social = termina en SA / S.A. / SRL. Se mira el FINAL del nombre,
  // no si contiene " SA": con includes(), "JUAN SANCHEZ" quedaba marcado
  // como empresa.
  const noEsPersona = (nombre: string) =>
    nombre.startsWith("VENTAS ") || /\b(S\.?A\.?|S\.?R\.?L\.?)$/.test(nombre);

  // --- pedido de stock: meses de stock por versión y qué hacer -----------
  // Sobre el stock y las ventas ya filtrados por marca: si el gerente eligió
  // JETOUR, las listas son de JETOUR.
  const pedido = calcularCobertura(stock, ventas);

  // --- demanda de Bitrix (leads y negocios) del período, por marca y modelo.
  // Es lo que Cars no puede decir: cuánta demanda entró, cuánta sigue
  // abierta y cuánta se perdió, y por qué. Solo conteos; la marca y el
  // modelo vienen deducidos por Hermes (ver lib/informes/demanda-bitrix).
  const demandaPeriodo = demandaCruda.filter(
    (d) => enVentana(d.periodo, f.anio) && (!f.marca || d.marca === f.marca)
  );
  const hayDemanda = demandaPeriodo.length > 0;
  /** Motivos que no son demanda perdida sino basura del CRM: un lead
   *  duplicado o de spam no se "perdió", nunca fue un comprador. */
  const noEraDemanda = (motivo: string) => /spam|falso|duplicad|repetid|incontactable/i.test(motivo);
  type ResumenDemanda = {
    leads: number; abiertos: number; ganados: number; perdidos: number; descartados: number;
    negocios: number; negAbiertos: number; negGanados: number; negPerdidos: number;
    motivos: Map<string, number>;
  };
  const resumenVacio = (): ResumenDemanda => ({
    leads: 0, abiertos: 0, ganados: 0, perdidos: 0, descartados: 0,
    negocios: 0, negAbiertos: 0, negGanados: 0, negPerdidos: 0, motivos: new Map(),
  });
  const sumarDemanda = (r: ResumenDemanda, d: DemandaBitrix) => {
    if (d.origen === "lead") {
      r.leads += d.cantidad;
      if (d.estado === "abierto") r.abiertos += d.cantidad;
      else if (d.estado === "ganado") r.ganados += d.cantidad;
      else if (noEraDemanda(d.motivo)) r.descartados += d.cantidad;
      else r.perdidos += d.cantidad;
    } else {
      r.negocios += d.cantidad;
      if (d.estado === "abierto") r.negAbiertos += d.cantidad;
      else if (d.estado === "ganado") r.negGanados += d.cantidad;
      else r.negPerdidos += d.cantidad;
    }
    if (d.estado === "perdido" && d.motivo && !noEraDemanda(d.motivo)) {
      r.motivos.set(d.motivo, (r.motivos.get(d.motivo) ?? 0) + d.cantidad);
    }
  };
  const demandaTotal = resumenVacio();
  const demandaPorMarca = new Map<string, ResumenDemanda>();
  const demandaPorModelo = new Map<string, ResumenDemanda & { marca: string; modelo: string }>();
  for (const d of demandaPeriodo) {
    sumarDemanda(demandaTotal, d);
    const m = demandaPorMarca.get(d.marca) ?? resumenVacio();
    sumarDemanda(m, d);
    demandaPorMarca.set(d.marca, m);
    if (d.modelo) {
      const k = `${d.marca}|${d.modelo}`;
      const x = demandaPorModelo.get(k) ?? { ...resumenVacio(), marca: d.marca, modelo: d.modelo };
      sumarDemanda(x, d);
      demandaPorModelo.set(k, x);
    }
  }
  const motivosTop = (r: ResumenDemanda, n = 3) =>
    [...r.motivos.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
  const facturadoPorMarca = new Map<string, number>();
  for (const v of facturasPeriodo) {
    facturadoPorMarca.set(v.marca, (facturadoPorMarca.get(v.marca) ?? 0) + v.unidades);
  }
  // --- contra la demanda se compara SOLO retail ------------------------
  // Las ventas mayoristas (VENTAS GERENCIA, EDUARDO VIGORITO, VENTAS
  // GERENCIA EXTERNA — la lista está en parametros.json) no las trajo
  // ningún lead: son flotas y operaciones de gerencia. Sumarlas acá hacía
  // parecer que la demanda se aprovecha mucho mejor de lo que se aprovecha,
  // sobre todo en las pickups: la L200 de Mitsubishi es el caso claro.
  //
  // Se RESTA en vez de sumar los asesores retail a propósito: una factura
  // sin vendedor cargado no aparece en venta_asesor, y sumando se perdería.
  // Restando, lo que no está marcado como mayorista queda como retail.
  const mayoristaPorMarca = new Map<string, number>();
  for (const a of asesoresTodos) {
    if (!mayoristas.has(a.asesor)) continue;
    mayoristaPorMarca.set(a.marca, (mayoristaPorMarca.get(a.marca) ?? 0) + a.unidades);
  }
  const retailPorMarca = (marca: string) =>
    Math.max(0, (facturadoPorMarca.get(marca) ?? 0) - (mayoristaPorMarca.get(marca) ?? 0));
  const filasDemandaMarca = [...demandaPorMarca.entries()]
    .map(([marca, r]) => ({
      marca, ...r,
      facturado: retailPorMarca(marca),
      mayorista: mayoristaPorMarca.get(marca) ?? 0,
    }))
    .sort((a, b) => b.leads + b.negocios - (a.leads + a.negocios));
  // Bitrix da la familia ("T2", "L200", "JOLION"); Cars la escribe a su
  // manera ("L200 TRITON", "HAVAL JOLION"). Coinciden si la palabra de
  // Bitrix está entre las del modelo de Cars, sin separar letra de número.
  const coincideFamilia = (familia: string, modeloCars: string) => tokensNombre(modeloCars).includes(familia);
  // `modelo` en venta_asesor viene del mismo campo de Cars que en
  // venta_propia (/sales/list → familia), así que cruzan por el mismo texto.
  // Vacío en los pushes anteriores al 08/09/2026: ahí no se descuenta nada
  // por modelo y el total de la marca se sigue descontando igual.
  const mayoristaDeModelo = (marca: string, familia: string) =>
    asesoresTodos
      .filter((a) =>
        mayoristas.has(a.asesor) && a.marca === marca &&
        !!a.modelo && coincideFamilia(familia, a.modelo))
      .reduce((s, a) => s + a.unidades, 0);
  const facturadoDeModelo = (marca: string, familia: string) =>
    Math.max(0, facturasPeriodo
      .filter((v) => v.marca === marca && coincideFamilia(familia, v.modelo))
      .reduce((s, v) => s + v.unidades, 0) - mayoristaDeModelo(marca, familia));
  const libresDeModelo = (marca: string, familia: string) =>
    pedido.versiones
      .filter((v) => v.marca === marca && coincideFamilia(familia, v.modelo))
      .reduce((s, v) => s + v.libres, 0);
  const senalDemanda = (r: ResumenDemanda, libres: number) => {
    const suma = (re: RegExp) =>
      [...r.motivos.entries()].filter(([m]) => re.test(m)).reduce((s, [, n]) => s + n, 0);
    const porStock = suma(/stock/i);
    const porPrecio = suma(/precio|competencia/i);
    const abiertos = r.abiertos + r.negAbiertos;
    // `corto` es lo que entra en la celda; `texto`, el porqué (tooltip).
    if (porStock > 0 && libres === 0) return { corto: t("Pedir"), texto: t("Se perdió por falta de stock y hoy no hay libres."), tono: "pedir" };
    if (porStock > 0) return { corto: t("{n} sin stock", { n: porStock }), texto: porStock === 1 ? t("Se perdió {n} vez por falta de stock; hoy hay {libres} libres.", { n: porStock, libres }) : t("Se perdió {n} veces por falta de stock; hoy hay {libres} libres.", { n: porStock, libres }), tono: "ok" };
    if (abiertos >= 5 && libres >= 5) return { corto: t("Empujar"), texto: t("Hay demanda abierta y stock libre para entregar."), tono: "empujar" };
    if (porPrecio >= 3) return { corto: t("Revisar precio"), texto: t("Se pierde por precio o por la competencia."), tono: "precio" };
    return null;
  };
  const filasDemandaModelo = [...demandaPorModelo.values()]
    .map((r) => {
      const libres = libresDeModelo(r.marca, r.modelo);
      return { ...r, facturado: facturadoDeModelo(r.marca, r.modelo), libres, senal: senalDemanda(r, libres) };
    })
    .sort((a, b) => b.leads + b.negocios - (a.leads + a.negocios))
    .slice(0, 25);
  const leadsConModelo = demandaPeriodo
    .filter((d) => d.origen === "lead" && d.modelo)
    .reduce((s, d) => s + d.cantidad, 0);
  const negociosConModelo = demandaPeriodo
    .filter((d) => d.origen === "negocio" && d.modelo)
    .reduce((s, d) => s + d.cantidad, 0);
  const mesesRitmoTxt = pedido.mesesRitmo
    .map((p) => mesCorto(Number(p.slice(5, 7))))
    .join(", ");

  // --- sucursales: quién factura dónde --------------------------------------
  const porSucursal = new Map<string, { unidades: number; asesores: Map<string, number> }>();
  for (const a of asesoresPeriodo) {
    const s = a.sucursal || SIN_SUCURSAL;
    const x = porSucursal.get(s) ?? { unidades: 0, asesores: new Map<string, number>() };
    x.unidades += a.unidades;
    x.asesores.set(a.asesor, (x.asesores.get(a.asesor) ?? 0) + a.unidades);
    porSucursal.set(s, x);
  }
  const sucursales = [...porSucursal.entries()]
    .map(([sucursal, x]) => {
      const top = [...x.asesores.entries()].sort((a, b) => b[1] - a[1])[0];
      return { sucursal, unidades: x.unidades, asesores: x.asesores.size, top };
    })
    .sort((a, b) => b.unidades - a.unidades);
  const haySucursal = sucursales.some((s) => s.sucursal !== SIN_SUCURSAL);
  // Las MARCAS que factura cada asesor, de la que más vende a la que menos.
  // Va en el ranking en lugar de la sucursal: la sucursal la carga Cars y a
  // veces está mal (06/09/2026); la marca sale de la factura y no falla.
  const unidadesPorAsesorMarca = new Map<string, Map<string, number>>();
  for (const a of asesoresPeriodo) {
    const m = unidadesPorAsesorMarca.get(a.asesor) ?? new Map<string, number>();
    m.set(a.marca, (m.get(a.marca) ?? 0) + a.unidades);
    unidadesPorAsesorMarca.set(a.asesor, m);
  }
  const marcasDe = (asesor: string): string[] =>
    [...(unidadesPorAsesorMarca.get(asesor) ?? new Map<string, number>()).entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([marca]) => marca);

  // --- leads de Bitrix por asesor, mismo período. Se cruzan por NOMBRE
  // normalizado (mayúsculas, sin acentos): Cars y Bitrix escriben distinto
  // y no comparten un id. Un asesor sin leads en Bitrix muestra "—", no 0:
  // puede que el CRM lo tenga con otro nombre.
  const leadsPeriodo = leadsCrudos.filter((l) => enVentana(l.periodo, f.anio));
  const leadsPorAsesor = new Map<string, { leads: number; sinContacto: number }>();
  for (const l of leadsPeriodo) {
    const k = normalizarNombre(l.asesor);
    const x = leadsPorAsesor.get(k) ?? { leads: 0, sinContacto: 0 };
    x.leads += l.leads;
    x.sinContacto += l.sin_contacto;
    leadsPorAsesor.set(k, x);
  }
  const hayLeads = leadsPeriodo.length > 0;
  const leadsDe = (asesor: string) => leadsPorAsesor.get(normalizarNombre(asesor));

  const detalle = (sync?.detalle ?? {}) as Record<string, unknown>;

  // --- stock por modelo, con sus versiones adentro (pestaña Stock) --------
  // Sale de la misma cobertura que «Qué pedir»: libres, reservadas y en
  // viaje ya clasificados por estado. Entran las versiones con stock y las
  // que venden sin tener stock (esas son justo las que hay que pedir).
  const modelosStockMap = new Map<string, ModeloStock>();
  for (const v of pedido.versiones) {
    if (!esPropia(v.marca)) continue;
    const total = v.libres + v.reservadas + v.enViaje + v.noVendible;
    if (total === 0 && v.ritmo === 0) continue;
    const k = `${v.marca}|${v.modelo}`;
    const m = modelosStockMap.get(k) ?? {
      marca: v.marca, modelo: v.modelo, total: 0, libres: 0, reservadas: 0, enViaje: 0,
      noVendible: 0, ritmo: 0, meses: null, precioDesde: null, versiones: [],
    };
    m.total += total;
    m.libres += v.libres;
    m.reservadas += v.reservadas;
    m.enViaje += v.enViaje;
    m.noVendible += v.noVendible;
    m.ritmo += v.ritmo;
    if (v.precio_usd) m.precioDesde = Math.min(m.precioDesde ?? v.precio_usd, v.precio_usd);
    m.versiones.push({
      version: v.version, libres: v.libres, reservadas: v.reservadas, enViaje: v.enViaje,
      noVendible: v.noVendible, ritmo: v.ritmo, meses: v.meses, precio: v.precio_usd, accion: v.accion,
    });
    modelosStockMap.set(k, m);
  }
  const unidadesDe = (x: { libres: number; reservadas: number; enViaje: number; noVendible: number }) =>
    x.libres + x.reservadas + x.enViaje + x.noVendible;
  const modelosStock: ModeloStock[] = [...modelosStockMap.values()]
    .map((m) => ({
      ...m,
      meses: m.ritmo >= RITMO_MINIMO_VERSION ? m.libres / m.ritmo : null,
      versiones: [...m.versiones].sort((a, b) => unidadesDe(b) - unidadesDe(a) || b.ritmo - a.ritmo),
    }))
    .sort((a, b) => b.total - a.total || b.ritmo - a.ritmo);
  const otrasStock = {
    marcas: new Set(stock.filter((s) => !esPropia(s.marca)).map((s) => s.marca)).size,
    unidades: stock.filter((s) => !esPropia(s.marca)).reduce((s, x) => s + x.unidades, 0),
  };

  // --- motivos de pérdida del período, todas las marcas del filtro ---------
  const motivosDemanda = [...demandaTotal.motivos.entries()].map(([nombre, valor]) => ({ nombre, valor }));

  // --- pestañas ------------------------------------------------------------
  // Nueve secciones en una tira de 13.000 px (Croman, 30/09/2026: "todo el
  // dashboard me parece muy desordenado"). Cada pestaña contesta una
  // pregunta; los filtros de arriba valen para las cuatro.
  const VISTAS = [
    { valor: "resumen", label: t("Resumen"), pista: t("Cómo venimos: facturado, mercado, stock y plan, marca por marca.") },
    { valor: "stock", label: t("Stock y pedido"), pista: t("Qué pedir, qué empujar con promoción y todo el stock por modelo.") },
    { valor: "demanda", label: t("Demanda"), pista: t("Los leads de Bitrix: cuánta demanda entró, cuánta se perdió y por qué.") },
    { valor: "equipo", label: t("Equipo"), pista: t("Quién vende y desde qué local.") },
  ];
  const vistaPedida = Array.isArray(sp.vista) ? sp.vista[0] : sp.vista;
  const vista = VISTAS.some((v) => v.valor === vistaPedida) ? (vistaPedida as string) : "resumen";

  const conPlanTabla = hayMetas || hayPresupuesto;

  return (
    <Pagina>
      <PageHeader
        titulo={t("Nuestra operación")}
        descripcion={t("Facturación, stock, demanda y equipo de venta · {periodo}.", { periodo })}
        fuente={`Cars${sync ? ` ${t("(sinc. {fecha})", { fecha: formatFechaHora(sync.actualizado_en) })}` : ""}${hayLeads || hayDemanda ? " · Bitrix" : ""}${hayPauta ? " · Meta" : ""} · CADAM${cadamRecorta ? ` ${t("hasta {mes}", { mes: hastaCadam })}` : ""}`}
      />

      <FiltroPeriodo
        anios={aniosFiltro}
        mesMaximoPorAnio={mesMax}
        opciones={[
          { param: "marca", label: t("Marca"), valores: [...propias].sort() },
        ]}
      />

      <SelectorVista
        vistas={VISTAS}
        porDefecto="resumen"
        anclas={{ marcas: "resumen", plan: "resumen", canales: "resumen", pedido: "stock", stock: "stock", demanda: "demanda", sucursales: "equipo", asesores: "equipo" }}
      />

      {vista === "resumen" && (
        <>
          <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2", hayPresupuesto || hayMetas ? "xl:grid-cols-5" : "xl:grid-cols-4")}>
            <KpiCard
              label={t("Facturado")}
              value={formatUnidades(totalFacturas)}
              valorAnimado={totalFacturas}
              formato="unidades"
              periodo={periodo}
              variacion={crecFacturas}
              tooltip={t("Vehículos facturados en Cars. Contra {n} en el mismo período de {anio}.", { n: formatUnidades(totalFacturasAnterior), anio: f.anio - 1 })}
              tono="tinta"
            />
            <KpiCard
              label={t("Matriculado (CADAM)")}
              value={cadamDisponible ? formatUnidades(totalMatric) : "—"}
              valorAnimado={totalMatric}
              formato="unidades"
              periodo={cadamDisponible ? periodoCadam : t("Sin datos de CADAM")}
              tooltip={
                cadamRecorta
                  ? t("Marcas propias registradas por la DNRA hasta {mes}, el último mes que CADAM publicó. Es otro evento, no el mismo dato.", { mes: hastaCadam })
                  : t("Marcas propias registradas por la DNRA en el mismo período. Es otro evento, no el mismo dato.")
              }
              tono="azul"
            />
            <KpiCard
              label={t("Participación de mercado")}
              value={mercado ? formatPct(totalMatric / mercado) : "—"}
              valorAnimado={mercado ? totalMatric / mercado : 0}
              formato="porcentaje"
              periodo={cadamDisponible ? periodoCadam : t("Sin datos de CADAM")}
              tooltip={t("{a} de {b} matriculaciones del país. Se mide con CADAM, no con nuestras facturas: el denominador es el mercado.", { a: formatUnidades(totalMatric), b: formatUnidades(mercado) })}
              chipIcono="market-share"
              chipTono="violet"
            />
            <KpiCard
              label={t("Unidades en stock")}
              value={formatUnidades(totalStock)}
              valorAnimado={totalStock}
              formato="unidades"
              periodo={t("Hoy")}
              tooltip={t("{n} reservadas. Incluye lo que está en viaje: el detalle está en la pestaña Stock y pedido.", { n: formatUnidades(totalReservadas) })}
              chipIcono="segmentos"
              chipTono="amber"
            />
            {(hayPresupuesto || hayMetas) && (
              <KpiCard
                label={hayPresupuesto ? t("Presupuesto {anio}", { anio: f.anio }) : t("Meta del período")}
                value={
                  hayPresupuesto && hechoTotal !== null
                    ? formatPct(hechoTotal)
                    : metaTotal
                      ? formatPct(totalFacturas / metaTotal)
                      : "—"
                }
                valorAnimado={
                  hayPresupuesto && hechoTotal !== null
                    ? hechoTotal
                    : metaTotal
                      ? totalFacturas / metaTotal
                      : undefined
                }
                formato="porcentaje"
                periodo={
                  hayPresupuesto
                    ? t("hecho · {a} de {b}", { a: formatUnidades(facturadoYtdTotal), b: formatUnidades(presupuestoTotal) })
                    : t("{a} de {b} · {periodo}", { a: formatUnidades(totalFacturas), b: formatUnidades(metaTotal), periodo })
                }
                tooltip={
                  hayPresupuesto
                    ? t("Qué parte del presupuesto original del año ({total} u., solo las marcas que lo tienen) ya se facturó, hasta {mes}. El plan vigente ({version}) suma {plan} u.", { total: formatUnidades(presupuestoTotal), mes: proyectar ? mesCorto(mesCerrado) : fmt.mesesLargos[11], version: presupuesto.version, plan: formatUnidades(planTotalAnio) })
                    : t("Vehículos facturados contra la meta cargada en Configuración para estos meses.")
                }
                chipIcono="evolucion"
                chipTono="mint"
              />
            )}
          </div>

          <NotaDato>
            {tr("<b>Facturar no es matricular.</b> Cars cuenta cada vehículo (VIN) en el mes de su primera factura; CADAM, cuándo la DNRA lo registró — y el comprador matricula después, o nunca si es flota o si registra en otra plaza. Por eso las dos cifras no coinciden y <b>ninguna de las dos está mal</b>: miden momentos distintos del mismo auto.")}
            {crecFacturasCadam !== null && crecMatric !== null && (
              <>
                {" "}{cadamRecorta
                  ? tr("Hasta {mes}, donde cierra CADAM, nuestra facturación creció <b>{a}</b> y las matriculaciones de nuestras marcas en CADAM —una fuente que no es nuestra— <b>{b}</b>.", { mes: hastaCadam, a: formatPct(crecFacturasCadam, { signed: true }), b: formatPct(crecMatric, { signed: true }) })
                  : tr("En este período nuestra facturación creció <b>{a}</b> y las matriculaciones de nuestras marcas en CADAM —una fuente que no es nuestra— <b>{b}</b>.", { a: formatPct(crecFacturasCadam, { signed: true }), b: formatPct(crecMatric, { signed: true }) })}{" "}
                {/* No afirmar que "coinciden" cuando no coinciden: la
                    matriculación va atrás de la factura, así que cuanto más
                    cerca del último mes cerrado, más se abre la brecha. */}
                {Math.abs(crecFacturasCadam - crecMatric) <= 0.2 ? (
                  <>{t("Dos caminos separados, la misma historia.")}</>
                ) : (
                  <>
                    {t("La diferencia es esperable: la matriculación va atrás de la factura, así que cuanto más cerca esté el período del último mes cerrado, más se abre la brecha. Achicá el rango de meses para compararlos con la cola ya registrada.")}
                  </>
                )}
              </>
            )}
          </NotaDato>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{t("Facturación mensual")}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {t("Vehículos facturados por mes; el año anterior, punteado.")}
                </p>
              </CardHeader>
              <CardContent>
                {serie.length ? (
                  <SerieAniosChart series={serie} />
                ) : (
                  <p className="py-16 text-center text-sm text-muted-foreground">
                    {t("Sin facturación cargada para estos años.")}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("Stock por estado — hoy")}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {t("«En viaje» y «sin despachar» no se entregan mañana: por eso no se colapsa en un solo número.")}
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

          <Seccion titulo={t("Marca por marca")} id="marcas">
            <Card>
              <CardHeader>
                <CardTitle>{t("Mercado y stock — {periodo}", { periodo })}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {t("Lo que vendimos, lo que la marca patentó en todo el país y cuánto dura el stock al ritmo de hoy.")}
                  {hayPauta && (
                    <>
                      {" "}{pautaSinMarca > 0
                        ? t("Pauta de Meta del período: US$ {total} (US$ {resto} en cuentas de usados o de varias marcas, que no se reparten).", { total: formatUnidades(Math.round(pautaTotal)), resto: formatUnidades(Math.round(pautaSinMarca)) })
                        : t("Pauta de Meta del período: US$ {total}.", { total: formatUnidades(Math.round(pautaTotal)) })}
                    </>
                  )}
                </p>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("Marca")}</TableHead>
                      <TableHead className="text-right" nota={t("vehículos, en Cars")}>{t("Facturado")}</TableHead>
                      <TableHead className="text-right" nota={`${t("chapas en todo el país · su share")}${cadamRecorta ? ` · ${t("hasta {mes}", { mes: hastaCadam })}` : ""}`}>
                        {t("Matriculado")}
                      </TableHead>
                      <TableHead className="text-right" nota={t("hoy · con seña")}>{t("Stock")}</TableHead>
                      <TableHead className="text-right" nota={t("al ritmo del período")}>{t("Meses de stock")}</TableHead>
                      {hayPauta && (
                        <TableHead className="text-right" nota={t("gasto en Meta · por vehículo")}>{t("Pauta")}</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filas.map((r) => (
                      <TableRow key={r.clave}>
                        <TableCell className="font-medium">
                          <span className="inline-flex items-center gap-2">
                            {r.marcas.map((m) => <LogoMarca key={m} marca={m} />)}
                            {r.etiqueta}
                          </span>
                          {r.esGrupo && (
                            <span className="block text-[11px] font-normal text-muted-foreground">
                              {t("meta conjunta: así la presupuesta Finanzas")}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">
                          {r.facturado ? formatUnidades(r.facturado) : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {r.matriculado ? formatUnidades(r.matriculado) : "—"}
                          {r.matriculado > 0 && (
                            <span className="block text-[11px] leading-tight text-muted-foreground">
                              {t("{pct} del mercado", { pct: formatPct(r.share) })}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {r.stock ? formatUnidades(r.stock) : "—"}
                          {r.reservadas > 0 && (
                            <span className="block text-[11px] leading-tight text-muted-foreground">
                              {t("{n} con seña", { n: formatUnidades(r.reservadas) })}
                            </span>
                          )}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right tabular-nums",
                            r.mesesStock !== null && r.mesesStock > 6 && "font-medium text-amber-700 dark:text-amber-400"
                          )}
                          title={
                            r.mesesStock === null
                              ? t("Menos de {n} facturas por mes: el cociente no informa nada.", { n: RITMO_MINIMO })
                              : undefined
                          }
                        >
                          {formatDecimal(r.mesesStock)}
                        </TableCell>
                        {hayPauta && (
                          <TableCell className="text-right tabular-nums">
                            {r.pauta ? `US$ ${formatUnidades(Math.round(r.pauta))}` : "—"}
                            {r.pauta > 0 && r.facturado > 0 && (
                              <span className="block text-[11px] leading-tight text-muted-foreground">
                                {t("US$ {n} por vehículo", { n: formatUnidades(Math.round(r.pauta / r.facturado)) })}
                              </span>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                    {resumenAjenas.marcas > 0 && (
                      <TableRow className="text-muted-foreground">
                        <TableCell className="italic" title={t("Unidades de canje y usados de marcas que la casa no distribuye, casi siempre una o dos por marca.")}>
                          {idioma === "en" && resumenAjenas.marcas === 1
                            ? t("Otras {n} marca (canje y usados)", { n: resumenAjenas.marcas })
                            : t("Otras {n} marcas (canje y usados)", { n: resumenAjenas.marcas })}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {resumenAjenas.facturado ? formatUnidades(resumenAjenas.facturado) : "—"}
                        </TableCell>
                        <TableCell className="text-right">—</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {resumenAjenas.stock ? formatUnidades(resumenAjenas.stock) : "—"}
                        </TableCell>
                        <TableCell className="text-right">—</TableCell>
                        {hayPauta && <TableCell className="text-right">—</TableCell>}
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </Seccion>

          {conPlanTabla && (
            <Seccion titulo={t("Plan y presupuesto")} id="plan">
              <Card>
                <CardHeader>
                  <CardTitle>{t("Contra el plan — {periodo}", { periodo })}</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {hayPresupuesto
                      ? t("Plan de Finanzas ({version}, archivo del {fecha}). Hasta {mes} el plan ES el real: el cumplimiento se mide sobre los meses que siguen.", { version: presupuesto.version, fecha: presupuesto.modificado.slice(0, 10), mes: realHastaMes ? mesCorto(realHastaMes) : "—" })
                      : t("Metas cargadas en Configuración.")}
                    {" "}{t("La proyección suma a lo facturado lo que el año pasado se vendió en los meses que faltan, al ritmo de este año.")}
                  </p>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("Marca")}</TableHead>
                        <TableHead className="text-right" nota={t("en el período")}>{t("Facturado")}</TableHead>
                        {hayMetas && (
                          <>
                            <TableHead className="text-right" nota={t("para estos meses")}>{t("Plan")}</TableHead>
                            <TableHead className="text-right" nota={t("facturado ÷ plan")}>{t("Cumplimiento")}</TableHead>
                          </>
                        )}
                        {hayPresupuesto && (
                          <>
                            <TableHead className="text-right" nota={t("cifra original del año")}>{t("Presupuesto")}</TableHead>
                            <TableHead className="text-right" nota={t("del presupuesto anual")}>{t("Hecho")}</TableHead>
                          </>
                        )}
                        {hayMetas && (
                          <TableHead className="text-right" nota={t("cierre estimado / plan del año")}>{t("Proyección")}</TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filas.map((r) => (
                        <TableRow key={r.clave}>
                          <TableCell className="font-medium">
                            <span className="inline-flex items-center gap-2">
                              {r.marcas.map((m) => <LogoMarca key={m} marca={m} />)}
                              {r.etiqueta}
                            </span>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {r.facturado ? formatUnidades(r.facturado) : "—"}
                          </TableCell>
                          {hayMetas && (
                            <>
                              <TableCell className="text-right tabular-nums text-muted-foreground">
                                {r.meta ? formatUnidades(r.meta) : "—"}
                                {r.meta && r.abiertos === 0 ? (
                                  <span className="block text-[11px]">{t("cerrado")}</span>
                                ) : null}
                              </TableCell>
                              <TableCell
                                className={cn(
                                  "text-right tabular-nums font-medium",
                                  r.cumplimiento !== null && r.cumplimiento < 0.85 && "text-rose-700 dark:text-rose-400",
                                  r.cumplimiento !== null && r.cumplimiento >= 1 && "text-emerald-700 dark:text-emerald-400"
                                )}
                                title={
                                  r.meta && r.abiertos === 0
                                    ? t("Todos los meses del filtro ya cerraron en el Excel: ahí el plan es el real.")
                                    : undefined
                                }
                              >
                                {r.cumplimiento !== null ? formatPct(r.cumplimiento) : "—"}
                              </TableCell>
                            </>
                          )}
                          {hayPresupuesto && (
                            <>
                              <TableCell className="text-right tabular-nums text-muted-foreground">
                                {r.presupuestoAnual ? formatUnidades(r.presupuestoAnual) : "—"}
                              </TableCell>
                              <TableCell className="text-right tabular-nums font-medium">
                                {r.hecho !== null ? formatPct(r.hecho) : "—"}
                              </TableCell>
                            </>
                          )}
                          {hayMetas && (
                            <TableCell className="text-right tabular-nums text-muted-foreground whitespace-nowrap">
                              {r.proyeccion !== null && r.metaAnio
                                ? `${formatUnidades(r.proyeccion)} / ${formatUnidades(r.metaAnio)}`
                                : r.proyeccion !== null
                                  ? formatUnidades(r.proyeccion)
                                  : "—"}
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {hayPresupuesto && (
                <Card>
                  <CardHeader>
                    <CardTitle>
                      {t("Plan vs. facturado, mes a mes — {anio}", { anio: f.anio })}
                      {f.marca ? ` · ${filas[0]?.etiqueta ?? f.marca}` : ""}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {t("Barras: plan vigente ({version}) y facturado en Cars. Los meses sombreados ya cerraron en el Excel. La línea punteada es el presupuesto anual dividido doce, solo como referencia.", { version: presupuesto.version })}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <PlanVsFacturadoChart meses={mesesPlan} referenciaMensual={referenciaMensual} />
                  </CardContent>
                </Card>
              )}

              {canales.length > 0 && (
                <div id="canales" className="flex scroll-mt-20 flex-col gap-4">
                  <NotaDato>
                    {tr(
                      "<b>CDE y Wholesale tienen objetivo propio en el Excel de Finanzas</b> (la sucursal de Ciudad del Este y las ventas mayoristas). Sus unidades ya están dentro de las marcas de arriba: es otro corte de lo mismo, no se suma. El real es el de Finanzas, del mismo Excel, hasta el mes que ellos cerraron: la sucursal que anota Cars no coincide con esta definición de canal (CDE en Cars: 79 unidades en {anio}; Finanzas: {real} hasta {mes}).",
                      { anio: f.anio, real: formatUnidades(canales[0].realYtd), mes: canales[0].realHastaMes ? mesCorto(canales[0].realHastaMes) : "—" }
                    )}
                  </NotaDato>
                  <Card>
                    <CardHeader>
                      <CardTitle>{t("Canales que Finanzas presupuesta aparte — {anio}", { anio: f.anio })}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t("Canal")}</TableHead>
                            <TableHead className="text-right" nota={t("hasta el mes cerrado")}>{t("Objetivo")}</TableHead>
                            <TableHead className="text-right" nota={t("según Finanzas")}>{t("Real")}</TableHead>
                            <TableHead className="text-right" nota={t("real ÷ objetivo")}>{t("Cumplimiento")}</TableHead>
                            <TableHead className="text-right" nota={t("todo el año")}>{t("Objetivo anual")}</TableHead>
                            <TableHead className="text-right" nota={t("del objetivo anual")}>{t("Hecho")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {canales.map((c) => (
                            <TableRow key={c.canal}>
                              <TableCell className="font-medium">
                                {c.canal === "CDE" ? t("CDE (Ciudad del Este)") : t("Wholesale (mayoristas)")}
                                <span className="block text-[11px] font-normal text-muted-foreground">
                                  {t("real hasta {mes}", { mes: c.realHastaMes ? mesCorto(c.realHastaMes) : "—" })}
                                </span>
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-muted-foreground">
                                {formatUnidades(c.objetivoYtd)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">{formatUnidades(c.realYtd)}</TableCell>
                              <TableCell
                                className={cn(
                                  "text-right tabular-nums font-medium",
                                  c.cumplimiento !== null && c.cumplimiento < 0.85 && "text-rose-700 dark:text-rose-400",
                                  c.cumplimiento !== null && c.cumplimiento >= 1 && "text-emerald-700 dark:text-emerald-400"
                                )}
                              >
                                {c.cumplimiento !== null ? formatPct(c.cumplimiento) : "—"}
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-muted-foreground">
                                {formatUnidades(c.objetivoAnual)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {c.objetivoAnual ? formatPct(c.realYtd / c.objetivoAnual) : "—"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    {canales.map((c) => (
                      <Card key={c.canal}>
                        <CardHeader>
                          <CardTitle>
                            {t("{canal} — objetivo vs. real, mes a mes", { canal: c.canal === "CDE" ? "CDE" : "Wholesale" })}
                          </CardTitle>
                          <p className="text-xs text-muted-foreground">
                            {t("Real de Finanzas hasta {mes}; de ahí en adelante solo hay objetivo.", { mes: c.realHastaMes ? mesCorto(c.realHastaMes) : "—" })}
                          </p>
                        </CardHeader>
                        <CardContent>
                          <PlanVsFacturadoChart
                            meses={c.meses}
                            referenciaMensual={null}
                            altura={260}
                            etiquetaPlan={t("Objetivo")}
                            etiquetaReal={t("Real (Finanzas)")}
                          />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </Seccion>
          )}

          <NotaDato>
            {tr("<b>Acá no hay facturación en guaraníes ni dólares, a propósito.</b> Cars devuelve importes, pero no cierran: en 2026 hay 2.936 facturas marcadas «DOLARES» con montos de 54 millones a 4,8 billones —o sea guaraníes, con basura adentro— y 54 marcadas «GUARANIES» que arrancan en 29.990. Publicar facturación con esa base sería inventar una cifra. Las unidades sí cierran, y son lo que se muestra. El precio de lista de las unidades es harina de otro costal: ese sí está en dólares y es creíble.")}
            {typeof detalle.facturas_leidas === "number" && (
              <>
                {" "}{t("Última sincronización: {facturas} facturas y {unidades} unidades leídas de Cars, agregadas antes de salir de la máquina — el Advisor nunca recibe nombres, correos, teléfonos ni VIN de clientes.", { facturas: String(detalle.facturas_leidas), unidades: String(detalle.unidades_leidas ?? "?") })}
              </>
            )}
            {typeof detalle.vehiculos === "number" && (
              <>
                {" "}{tr("<b>Una unidad es un vehículo, no una factura:</b> de esas {facturas} facturas, {vehiculos} son vehículos distintos (1 VIN = 1 unidad, contado en su primera factura; {repetidas} facturas repetían un VIN ya contado — seña, saldo o accesorios en documentos aparte). Las {usados} facturas de LOCAL USADOS quedan fuera: son usados de marcas propias, no 0km.", { facturas: String(detalle.facturas_leidas), vehiculos: String(detalle.vehiculos), repetidas: String(detalle.facturas_repetidas ?? 0), usados: String(detalle.usados_excluidos ?? 0) })}
              </>
            )}
          </NotaDato>
        </>
      )}

      {vista === "stock" && (
        <>
          <Seccion titulo={t("Pedido de stock")} id="pedido">
            {/* Qué es cada columna lo dice la columna. Acá queda la letra
                chica: qué meses entran en el ritmo, qué queda afuera de
                «libres» y desde qué ritmo el cociente deja de significar algo. */}
            <NotaDato>
              {tr("<b>El ritmo son los tres últimos meses cerrados ({meses})</b>: el mes en curso no entra porque está a medias. De <b>libres</b> quedan afuera las reservadas, lo que está en viaje y lo que anda en test drive o cortesía. Con menos de {n} autos por mes no se calculan los meses de stock: el número no significaría nada.", { meses: mesesRitmoTxt, n: RITMO_MINIMO_VERSION })}
            </NotaDato>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>{t("Qué pedir")}</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {t("Se venden y les queda menos de un mes y medio libre, aun con lo que viene en viaje. Primero las que más venden.")}
                  </p>
                </CardHeader>
                <CardContent>
                  {pedido.pedir.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      {t("Nada urgente: ninguna versión con ritmo tiene menos de un mes y medio de stock.")}
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("Versión")}</TableHead>
                          <TableHead className="text-right" nota={t("por mes")}>{t("Ritmo")}</TableHead>
                          <TableHead className="text-right" nota={t("hoy")}>{t("Libres")}</TableHead>
                          <TableHead className="text-right" nota={t("sin llegar")}>{t("En viaje")}</TableHead>
                          <TableHead className="text-right" nota={t("libres ÷ ritmo")}>{t("Meses")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pedido.pedir.slice(0, 12).map((v) => (
                          <TableRow key={`${v.marca}|${v.version}`}>
                            <TableCell>
                              <span className="font-medium">{v.version}</span>
                              <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                                <LogoMarca marca={v.marca} />
                                {v.marca}
                              </span>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{formatDecimal(v.ritmo)}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatUnidades(v.libres)}</TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">
                              {v.enViaje ? formatUnidades(v.enViaje) : "—"}
                            </TableCell>
                            <TableCell className="text-right tabular-nums font-semibold text-rose-700 dark:text-rose-400">
                              {formatDecimal(v.meses)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t("Qué empujar")}</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {t("Más de seis meses de stock, o cinco o más libres que casi no se mueven. Primero las que más plata tienen parada. Promoción, no pedido.")}
                  </p>
                </CardHeader>
                <CardContent>
                  {pedido.empujar.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      {t("Nada parado: ninguna versión pasa los seis meses de stock.")}
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("Versión")}</TableHead>
                          <TableHead className="text-right" nota={t("hoy")}>{t("Libres")}</TableHead>
                          <TableHead className="text-right" nota={t("por mes")}>{t("Ritmo")}</TableHead>
                          <TableHead className="text-right" nota={t("libres ÷ ritmo")}>{t("Meses")}</TableHead>
                          <TableHead className="text-right" nota={t("lista, US$")}>{t("Precio")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pedido.empujar.slice(0, 12).map((v) => (
                          <TableRow key={`${v.marca}|${v.version}`}>
                            <TableCell>
                              <span className="font-medium">{v.version}</span>
                              <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                                <LogoMarca marca={v.marca} />
                                {v.marca}
                              </span>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{formatUnidades(v.libres)}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatDecimal(v.ritmo)}</TableCell>
                            <TableCell className="text-right tabular-nums font-semibold text-amber-700 dark:text-amber-400">
                              {v.meses === null ? t("sin ritmo") : formatDecimal(v.meses)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {v.precio_usd ? formatUnidades(v.precio_usd) : "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          </Seccion>

          <Seccion titulo={t("Todo el stock")} id="stock">
            {estadosDesconocidos(stockCrudo).length > 0 && (
              <NotaDato>
                {tr(
                  "<b>Estados de Cars que la regla de stock no conoce: {estados}.</b> Cuentan como en piso hasta que alguien los clasifique en <code>cobertura.ts</code> (en piso, en viaje o no vendible).",
                  { estados: estadosDesconocidos(stockCrudo).join(", ") }
                )}
              </NotaDato>
            )}
            <Card>
              <CardHeader>
                <CardTitle>{t("Stock por modelo — hoy")}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {t("Una fila por modelo, del que más unidades tiene al que menos; la flecha abre sus versiones, que es donde se decide qué pedir.")}
                </p>
              </CardHeader>
              <CardContent>
                <TablaStockModelos modelos={modelosStock} otras={otrasStock} />
              </CardContent>
            </Card>
          </Seccion>
        </>
      )}

      {vista === "demanda" && (
        <>
          {!hayDemanda ? (
            <Card>
              <CardContent>
                <EmptyState
                  title={t("Todavía no hay demanda de Bitrix")}
                  description={t("La empuja Hermes (advisor-demanda-bitrix.py) una vez por semana. Si ya pasaron unos días, revisá ese trabajo.")}
                />
              </CardContent>
            </Card>
          ) : (
            <>
              <NotaDato>
                {tr(
                  "<b>Esto es demanda registrada en el CRM, no mercado.</b> Sale de Bitrix por mes de creación y se resume antes de salir de la máquina donde se lee: ningún dato del cliente llega acá. «Abierto», «convertido» y «perdido» son la semántica de cada estado de Bitrix; el motivo es el nombre del estado o de la etapa de pérdida. Los descartados (spam, datos falsos, duplicados, incontactables) no cuentan como demanda perdida: nunca fueron un comprador. La marca es la «marca de interés» del lead, salvo que el título o la campaña nombren otra marca de forma explícita («SOUEAST S09» cargado como Jetour); el modelo se acepta solo si es de esa marca en el catálogo de Bitrix. Bitrix reclasifica hacia atrás, así que estas cifras cambian en cada actualización{ultima}.",
                  { ultima: demandaFecha ? ` ${t("(última: {fecha})", { fecha: formatFechaHora(demandaFecha) })}` : "" }
                )}
              </NotaDato>

              <Seccion titulo={t("Por marca")} id="demanda">
                <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                  <Card>
                    <CardHeader>
                      <CardTitle>{t("Leads y negocios — {periodo}", { periodo })}</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {tr("Lo facturado acá es <b>solo retail</b>: las {n} unidades mayoristas (flotas y gerencia) no las trajo ningún lead.", { n: formatUnidades(unidadesMayoristas) })}
                      </p>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t("Marca")}</TableHead>
                            <TableHead className="text-right" nota={t("consultas que entraron")}>{t("Leads")}</TableHead>
                            <TableHead className="text-right" nota={t("sin cerrar ni perder")}>{t("Abiertos")}</TableHead>
                            <TableHead className="text-right" nota={t("pasaron a negociación")}>{t("Convertidos")}</TableHead>
                            <TableHead className="text-right" nota={t("se dieron de baja")}>{t("Perdidos")}</TableHead>
                            <TableHead className="text-right" nota={t("ya calificados")}>{t("Negocios")}</TableHead>
                            <TableHead className="text-right" nota={t("sin flotas ni gerencia")}>{t("Facturado retail")}</TableHead>
                            <TableHead className="text-right" nota={t("si sube, se desaprovecha")}>{t("Leads por venta")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {[...filasDemandaMarca, {
                            marca: t("Total"), ...demandaTotal,
                            facturado: Math.max(0, totalFacturas - unidadesMayoristas),
                            mayorista: unidadesMayoristas,
                          }].map((r, i) => {
                            const total = i === filasDemandaMarca.length;
                            return (
                              <TableRow key={r.marca} className={cn(total && "bg-muted/40 font-semibold hover:bg-muted/40")}>
                                <TableCell className="font-medium">
                                  {total ? r.marca : <Marca marca={r.marca} />}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {formatUnidades(r.leads)}
                                  {r.descartados > 0 && (
                                    <span className="block text-[11px] font-normal leading-tight text-muted-foreground whitespace-nowrap">
                                      {t("{n} descartados", { n: formatUnidades(r.descartados) })}
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">{formatUnidades(r.abiertos)}</TableCell>
                                <TableCell className="text-right tabular-nums">{formatUnidades(r.ganados)}</TableCell>
                                <TableCell
                                  className="text-right tabular-nums"
                                  title={motivosTop(r).map(([m, n]) => `${m}: ${formatUnidades(n)}`).join("\n") || undefined}
                                >
                                  {formatUnidades(r.perdidos)}
                                  {motivosTop(r, 1)[0] && (
                                    <span className="block max-w-[11rem] truncate text-[11px] font-normal leading-tight text-muted-foreground">
                                      {motivosTop(r, 1)[0][0]}
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {r.negocios ? formatUnidades(r.negocios) : "—"}
                                  {r.negocios > 0 && (
                                    <span className="block text-[11px] font-normal leading-tight text-muted-foreground whitespace-nowrap">
                                      {t("{g} ganados · {p} perdidos", { g: formatUnidades(r.negGanados), p: formatUnidades(r.negPerdidos) })}
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">{r.facturado ? formatUnidades(r.facturado) : "—"}</TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {r.facturado && r.leads ? formatDecimal(r.leads / r.facturado) : "—"}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>{t("Por qué se pierde")}</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {t("Motivo de baja de los leads y negocios perdidos del período, sin los descartados. Pasá el mouse por «Perdidos» para verlo por marca.")}
                      </p>
                    </CardHeader>
                    <CardContent>
                      {motivosDemanda.length ? (
                        <DistribucionChart datos={motivosDemanda} maximo={7} />
                      ) : (
                        <p className="py-10 text-center text-sm text-muted-foreground">{t("Sin pérdidas con motivo en el período.")}</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </Seccion>

              <Seccion titulo={t("Por modelo")} id="demanda-modelo">
                <Card>
                  <CardHeader>
                    <CardTitle>{t("Demanda que nombra el modelo — {periodo}", { periodo })}</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {t("Bitrix no tiene campo de modelo en los leads: se lee del título o de la campaña cuando lo dicen ({leads} de los leads) y del producto de los negocios ({negocios}). Se cruza con lo facturado retail y con el stock libre de hoy.", { leads: formatPct(leadsConModelo / (demandaTotal.leads || 1)), negocios: formatPct(negociosConModelo / (demandaTotal.negocios || 1)) })}
                    </p>
                  </CardHeader>
                  <CardContent>
                    {filasDemandaModelo.length === 0 ? (
                      <p className="py-8 text-center text-sm text-muted-foreground">
                        {t("Ningún lead ni negocio del período nombra el modelo.")}
                      </p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t("Modelo")}</TableHead>
                            <TableHead className="text-right" nota={t("leads y negocios")}>{t("Demanda")}</TableHead>
                            <TableHead className="text-right" nota={t("sin cerrar ni perder")}>{t("Abiertos")}</TableHead>
                            <TableHead className="text-right" nota={t("y el motivo principal")}>{t("Perdidos")}</TableHead>
                            <TableHead className="text-right" nota={t("sin flotas ni gerencia")}>{t("Facturado retail")}</TableHead>
                            <TableHead className="text-right" nota={t("entregables hoy")}>{t("Libres hoy")}</TableHead>
                            <TableHead nota={t("la lectura de la fila")}>{t("Qué hacer")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filasDemandaModelo.map((r) => {
                            const perdidos = r.perdidos + r.negPerdidos;
                            const motivo = motivosTop(r, 1)[0];
                            return (
                              <TableRow key={`${r.marca}|${r.modelo}`}>
                                <TableCell>
                                  <span className="flex items-center gap-2">
                                    <LogoMarca marca={r.marca} />
                                    <span className="min-w-0">
                                      <span className="block font-medium">{r.modelo}</span>
                                      <span className="block text-[11px] leading-tight text-muted-foreground">{r.marca}</span>
                                    </span>
                                  </span>
                                </TableCell>
                                <TableCell className="text-right tabular-nums font-semibold">
                                  {formatUnidades(r.leads + r.negocios)}
                                  {r.negocios > 0 && (
                                    <span className="block text-[11px] font-normal leading-tight text-muted-foreground whitespace-nowrap">
                                      {r.negocios === 1 ? t("{n} negocio", { n: formatUnidades(r.negocios) }) : t("{n} negocios", { n: formatUnidades(r.negocios) })}
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">{formatUnidades(r.abiertos + r.negAbiertos)}</TableCell>
                                <TableCell
                                  className="text-right tabular-nums"
                                  title={motivosTop(r).map(([m, n]) => `${m}: ${formatUnidades(n)}`).join("\n") || undefined}
                                >
                                  {perdidos ? formatUnidades(perdidos) : "—"}
                                  {perdidos > 0 && motivo && (
                                    <span className="block max-w-[11rem] truncate text-[11px] leading-tight text-muted-foreground">
                                      {motivo[0]}
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">{r.facturado ? formatUnidades(r.facturado) : "—"}</TableCell>
                                <TableCell className="text-right tabular-nums">{r.libres ? formatUnidades(r.libres) : "—"}</TableCell>
                                <TableCell
                                  className={cn(
                                    "text-xs font-medium",
                                    r.senal?.tono === "pedir" && "text-rose-700 dark:text-rose-400",
                                    r.senal?.tono === "empujar" && "text-emerald-700 dark:text-emerald-400",
                                    r.senal?.tono === "precio" && "text-amber-700 dark:text-amber-400",
                                    (!r.senal || r.senal.tono === "ok") && "text-muted-foreground"
                                  )}
                                  title={r.senal?.texto}
                                >
                                  {r.senal?.corto ?? "—"}
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
            </>
          )}
        </>
      )}

      {vista === "equipo" && (
        <>
          <Seccion titulo={t("Asesores")} id="asesores">
            {asesoresPeriodo.length === 0 ? (
              <Card>
                <CardContent>
                  <EmptyState
                    title={t("Todavía no hay ranking de asesores")}
                    description={t("Hace falta que Hermes corra el push de Cars para que este período tenga datos. Si ya pasaron unas horas, revisá el trabajo advisor-datos-propios.")}
                  />
                </CardContent>
              </Card>
            ) : (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>{t("Ranking retail — {periodo}", { periodo })}</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {f.marca
                        ? t("Los {n} de {total} asesores retail con más vehículos facturados de {marca}. Flotas y gerencia van aparte.", { n: Math.min(15, rankingAsesores.length), total: rankingAsesores.length, marca: f.marca })
                        : t("Los {n} de {total} asesores retail con más vehículos facturados. Flotas y gerencia van aparte.", { n: Math.min(15, rankingAsesores.length), total: rankingAsesores.length })}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>#</TableHead>
                          <TableHead>{t("Asesor")}</TableHead>
                          <TableHead nota={t("de la que más vende a la que menos")}>{t("Marcas")}</TableHead>
                          <TableHead className="text-right" nota={t("facturados en el período")}>{t("Vehículos")}</TableHead>
                          <TableHead className="text-right" nota={t("de todo lo retail")}>{t("% del total")}</TableHead>
                          {hayLeads && (
                            <>
                              <TableHead className="text-right" nota={t("los que Bitrix le asignó")}>{t("Leads")}</TableHead>
                              <TableHead className="text-right" nota={t("nadie los tocó")}>{t("Sin contactar")}</TableHead>
                              <TableHead className="text-right" nota={t("de sus leads, cuántos cerraron")}>{t("Lead → venta")}</TableHead>
                            </>
                          )}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rankingAsesores.slice(0, 15).map((a, i) => (
                          <TableRow key={a.asesor}>
                            <TableCell className="tabular-nums text-muted-foreground">{i + 1}</TableCell>
                            <TableCell
                              className={cn("font-medium", noEsPersona(a.asesor) && "italic text-muted-foreground")}
                              title={noEsPersona(a.asesor) ? t("No es una persona: bucket interno de Cars.") : undefined}
                            >
                              {a.asesor}
                            </TableCell>
                            <TableCell
                              className="text-xs text-muted-foreground"
                              title={
                                marcasDe(a.asesor).length > 1
                                  ? t("Factura {n} marcas, de la que más vende a la que menos.", { n: marcasDe(a.asesor).length })
                                  : undefined
                              }
                            >
                              {marcasDe(a.asesor).slice(0, 3).join(" · ") || "—"}
                              {marcasDe(a.asesor).length > 3 ? ` +${marcasDe(a.asesor).length - 3}` : ""}
                            </TableCell>
                            <TableCell className="text-right tabular-nums font-semibold">
                              {formatUnidades(a.unidades)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">
                              {formatPct(a.unidades / unidadesConAsesor)}
                            </TableCell>
                            {hayLeads && (() => {
                              const l = leadsDe(a.asesor);
                              return (
                                <>
                                  <TableCell className="text-right tabular-nums">{l ? formatUnidades(l.leads) : "—"}</TableCell>
                                  <TableCell
                                    className={cn(
                                      "text-right tabular-nums",
                                      l && l.leads && l.sinContacto / l.leads > 0.3
                                        ? "font-medium text-rose-700 dark:text-rose-400"
                                        : "text-muted-foreground"
                                    )}
                                  >
                                    {l ? formatUnidades(l.sinContacto) : "—"}
                                  </TableCell>
                                  <TableCell
                                    className="text-right tabular-nums"
                                    title={
                                      l && l.leads && (l.leads < 20 || a.unidades > l.leads)
                                        ? t("Bitrix le asigna pocos leads a este asesor (los recibe quien califica): la conversión no se puede calcular con sentido.")
                                        : undefined
                                    }
                                  >
                                    {l && l.leads >= 20 && a.unidades <= l.leads ? formatPct(a.unidades / l.leads) : "—"}
                                  </TableCell>
                                </>
                              );
                            })()}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>{t("El mejor de cada marca — {periodo}", { periodo })}</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {t("Quién vendió más de cada marca, y entre cuántos asesores se reparte.")}
                      </p>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t("Marca")}</TableHead>
                            <TableHead nota={t("el que más vendió de esa marca")}>{t("Asesor")}</TableHead>
                            <TableHead className="text-right" nota={t("de esa marca")}>{t("Vehículos")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {mejorPorMarca.map((m) => (
                            <TableRow key={m.marca}>
                              <TableCell className="font-medium"><Marca marca={m.marca} /></TableCell>
                              <TableCell
                                className={cn(noEsPersona(m.mejorNombre) && "italic text-muted-foreground")}
                                title={noEsPersona(m.mejorNombre) ? t("No es una persona: bucket interno de Cars.") : undefined}
                              >
                                {m.mejorNombre}
                                <span className="block text-[11px] leading-tight text-muted-foreground">
                                  {m.asesoresDistintos === 1 ? t("de {n} asesor que la venden", { n: m.asesoresDistintos }) : t("de {n} asesores que la venden", { n: m.asesoresDistintos })}
                                </span>
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatUnidades(m.mejorUnidades)}
                                <span className="block text-[11px] leading-tight text-muted-foreground">
                                  {t("de {n}", { n: formatUnidades(m.totalMarca) })}
                                </span>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>

                  {mayoristasPeriodo.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>{t("Ventas mayoristas — {periodo}", { periodo })}</CardTitle>
                        <p className="text-xs text-muted-foreground">
                          {t("Flotas y ventas de gerencia: otro negocio, fuera del ranking. La lista de quiénes son mayoristas la mantiene Sistemas.")}
                        </p>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>{t("Vendedor mayorista")}</TableHead>
                              <TableHead className="text-right" nota={t("flotas y gerencia")}>{t("Vehículos")}</TableHead>
                              <TableHead className="text-right" nota={t("de todo lo facturado")}>{t("% del total")}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {mayoristasPeriodo.map((m) => (
                              <TableRow key={m.asesor}>
                                <TableCell className="font-medium">{m.asesor}</TableCell>
                                <TableCell className="text-right tabular-nums">{formatUnidades(m.unidades)}</TableCell>
                                <TableCell className="text-right tabular-nums text-muted-foreground">
                                  {formatPct(m.unidades / (totalFacturas || 1))}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </>
            )}
            <NotaDato>
              {tr(
                "<b>Esto es desempeño individual, no un dato de mercado.</b> Sale de <code>Vendedor</code> en las facturas de Cars, ya sumado por vendedor antes de salir de la máquina — nunca viaja factura por factura. Una unidad es un vehículo (un VIN), contado en su primera factura. De los {total} vehículos del período: <b>{retail} retail</b> (el ranking), <b>{mayoristas} mayoristas</b>{sinVendedor}. Si algún nombre en cursiva no es una persona (una razón social, por ejemplo), Cars lo cargó en el mismo campo que a un asesor.",
                {
                  total: formatUnidades(totalFacturas),
                  retail: formatUnidades(unidadesConAsesor),
                  mayoristas: formatUnidades(unidadesMayoristas),
                  sinVendedor: totalFacturas - unidadesConAsesor - unidadesMayoristas > 0
                    ? ` ${t("y {n} sin vendedor cargado en Cars", { n: formatUnidades(totalFacturas - unidadesConAsesor - unidadesMayoristas) })}`
                    : "",
                }
              )}
              {hayLeads && (
                <>
                  {" "}{tr("<b>Sobre los leads:</b> son los de Bitrix, por responsable y mes. El CRM le asigna la mayoría a quienes califican (el equipo que llama primero), no a quien cierra, así que muchos vendedores aparecen con pocos leads o ninguno. «Lead → venta» solo se calcula cuando el asesor tiene al menos 20 leads asignados y no vende más de lo que le asignan; si no, sería un porcentaje sin sentido, y se muestra «—».")}
                </>
              )}
            </NotaDato>
          </Seccion>

          {haySucursal && (
            <Seccion titulo={t("Sucursales")} id="sucursales">
              <Card>
                <CardHeader>
                  <CardTitle>{t("Ventas por sucursal — {periodo}", { periodo })}</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {t("Vehículos facturados desde cada local (la sucursal que Cars registra en la factura) y quién más vendió ahí.")}
                  </p>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("Sucursal")}</TableHead>
                        <TableHead className="text-right" nota={t("facturados desde ese local")}>{t("Vehículos")}</TableHead>
                        <TableHead className="text-right" nota={t("de todo lo facturado")}>{t("% del total")}</TableHead>
                        <TableHead className="text-right" nota={t("facturaron algo ahí")}>{t("Asesores")}</TableHead>
                        <TableHead nota={t("el que más vendió en el local")}>{t("Mejor asesor")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sucursales.map((s) => (
                        <TableRow key={s.sucursal}>
                          <TableCell className="font-medium">{s.sucursal === SIN_SUCURSAL ? t("Sin sucursal") : s.sucursal}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatUnidades(s.unidades)}</TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {formatPct(s.unidades / (unidadesConAsesor || 1))}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">{s.asesores}</TableCell>
                          <TableCell className={cn(s.top && noEsPersona(s.top[0]) && "italic text-muted-foreground")}>
                            {s.top ? `${s.top[0]} · ${formatUnidades(s.top[1])}` : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </Seccion>
          )}
        </>
      )}
    </Pagina>
  );
}
