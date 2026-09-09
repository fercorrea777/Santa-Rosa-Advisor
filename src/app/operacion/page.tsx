import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { NotaDato, PageHeader } from "@/components/dashboard/page-header";
import { FiltroPeriodo } from "@/components/dashboard/filtro-periodo";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Seccion } from "@/components/dashboard/seccion";
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
import { formatFechaHora, formatPct, formatUnidades } from "@/lib/format";
import {
  calcularCobertura, estadosDesconocidos, etiquetaAccion, RITMO_MINIMO as RITMO_MINIMO_VERSION,
} from "@/lib/informes/cobertura";
import { getLeadsAsesor, normalizarNombre } from "@/lib/informes/leads-asesor";
import { getPautaMarca } from "@/lib/informes/pauta-marca";
import {
  getActualizacionDemandaBitrix, getDemandaBitrix, type DemandaBitrix,
} from "@/lib/informes/demanda-bitrix";
import { tokens as tokensNombre } from "@/lib/informes/segmento-version";
import { etiquetaPeriodo, filtroDesdeUrl, mesCorto, type SearchParams } from "@/lib/periodo";
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
    if (porStock > 0 && libres === 0) return { texto: "Pedir: se perdió por falta de stock y hoy no hay libres", tono: "pedir" };
    if (porStock > 0) return { texto: `Se perdió ${porStock} ${porStock === 1 ? "vez" : "veces"} por stock; hoy hay ${libres} libres`, tono: "ok" };
    if (abiertos >= 5 && libres >= 5) return { texto: "Empujar: hay demanda abierta y stock para entregar", tono: "empujar" };
    if (porPrecio >= 3) return { texto: "Revisar precio: se pierde por precio o competencia", tono: "precio" };
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
  const versionesTabla = pedido.versiones
    .filter((v) => v.libres + v.enViaje > 0 || v.ritmo > 0)
    .sort((a, b) => b.libres - a.libres)
    .slice(0, 40);
  const mesesRitmoTxt = pedido.mesesRitmo
    .map((p) => mesCorto(Number(p.slice(5, 7))))
    .join(", ");

  // --- sucursales: quién factura dónde --------------------------------------
  const porSucursal = new Map<string, { unidades: number; asesores: Map<string, number> }>();
  for (const a of asesoresPeriodo) {
    const s = a.sucursal || "Sin sucursal";
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
  const haySucursal = sucursales.some((s) => s.sucursal !== "Sin sucursal");
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

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        titulo="Nuestra operación"
        descripcion={`Lo que facturamos y lo que tenemos en stock · ${periodo}${
          cadamRecorta ? ` · CADAM cierra en ${hastaCadam}` : ""
        }.`}
        fuente={`Fuente: API de Cars (DMS propio)${
          sync ? ` · sincronizado ${formatFechaHora(sync.actualizado_en)}` : ""
        }${hayLeads || hayDemanda ? " · leads y demanda de Bitrix" : ""}${hayPauta ? " · pauta de Meta" : ""} · matriculaciones de CADAM.`}
      />

      <FiltroPeriodo
        anios={aniosFiltro}
        mesMaximoPorAnio={mesMax}
        opciones={[
          { param: "marca", label: "Marca", valores: [...propias].sort() },
        ]}
      />

      <NotaDato>
        <strong>Facturar no es matricular.</strong> Cars cuenta cada vehículo
        (VIN) en el mes de su primera factura; CADAM, cuándo la DNRA lo
        registró — y el comprador
        matricula después, o nunca si es flota o si registra en otra plaza. Por
        eso las dos columnas no coinciden y <strong>ninguna de las dos está
        mal</strong>: miden momentos distintos del mismo auto.
        {crecFacturasCadam !== null && crecMatric !== null && (
          <>
            {" "}{cadamRecorta ? `Hasta ${hastaCadam}, donde cierra CADAM,` : "En este período"}{" "}
            nuestra facturación creció{" "}
            <strong>{formatPct(crecFacturasCadam, { signed: true })}</strong> y las
            matriculaciones de nuestras marcas en CADAM —una fuente que no es
            nuestra—{" "}
            <strong>{formatPct(crecMatric, { signed: true })}</strong>.{" "}
            {/* No afirmar que "coinciden" cuando no coinciden. Con la ventana
                hasta julio dan +122,7% y +79,0%: la matriculación va atrás
                porque el comprador registra semanas después de la factura, así
                que cuanto más cerca del último mes cerrado, más se abre la
                brecha. Decirlo es más útil que redondear a "las dos dicen lo
                mismo". */}
            {Math.abs(crecFacturasCadam - crecMatric) <= 0.2 ? (
              <>Dos caminos separados, la misma historia.</>
            ) : (
              <>
                La diferencia entre esos dos números es esperable y no es un
                error: la matriculación va atrás de la factura, así que cuanto
                más cerca esté el período del último mes cerrado, más se abre la
                brecha. Achicá el rango de meses para compararlos con la cola ya
                registrada.
              </>
            )}
          </>
        )}
      </NotaDato>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
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
          value={cadamDisponible ? formatUnidades(totalMatric) : "—"}
          valorAnimado={totalMatric}
          formato="unidades"
          periodo={cadamDisponible ? periodoCadam : "Sin datos de CADAM"}
          tooltip={
            cadamRecorta
              ? `Marcas propias registradas por la DNRA hasta ${hastaCadam}, el último mes que CADAM publicó. Es otro evento, no el mismo dato.`
              : "Marcas propias registradas por la DNRA en el mismo período. Es otro evento, no el mismo dato."
          }
          tono="verde"
        />
        <KpiCard
          label="Participación de mercado"
          value={mercado ? formatPct(totalMatric / mercado) : "—"}
          valorAnimado={mercado ? totalMatric / mercado : 0}
          formato="porcentaje"
          periodo={cadamDisponible ? periodoCadam : "Sin datos de CADAM"}
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
        <KpiCard
          label={hayPresupuesto ? `Presupuesto ${f.anio}` : "Meta del período"}
          value={
            hayPresupuesto && hechoTotal !== null
              ? formatPct(hechoTotal)
              : hayMetas && metaTotal
                ? formatPct(totalFacturas / metaTotal)
                : "—"
          }
          // Sin meta no hay número que animar: con 0 la tarjeta mostraba
          // "0.0%", que se lee como "no vendimos nada".
          valorAnimado={
            hayPresupuesto && hechoTotal !== null
              ? hechoTotal
              : hayMetas && metaTotal
                ? totalFacturas / metaTotal
                : undefined
          }
          formato="porcentaje"
          periodo={
            hayPresupuesto
              ? `plan ${presupuesto.version}: ${formatUnidades(planTotalAnio)} · facturado a ${proyectar ? mesCorto(mesCerrado) : "dic"}: ${formatUnidades(facturadoYtdTotal)}`
              : hayMetas && metaTotal
                ? `${formatUnidades(totalFacturas)} de ${formatUnidades(metaTotal)} · ${periodo}`
                : "Sin metas cargadas"
          }
          tooltip={
            hayPresupuesto
              ? `Qué parte del presupuesto original del año (${formatUnidades(presupuestoTotal)} u., solo las marcas que lo tienen) ya se facturó. El plan vigente es el ejercicio de Finanzas mes a mes.`
              : hayMetas
                ? "Vehículos facturados contra la meta cargada en Configuración para estos meses."
                : "Cargá metas por marca y mes en Configuración para ver el cumplimiento acá."
          }
          tono="tinta"
        />
      </div>

      <Seccion titulo="Pedido de stock"
        nota="Qué falta traer y qué hay que empujar con promoción, versión por versión. Sale de cruzar las unidades libres de hoy con lo que se vendió los últimos tres meses." id="pedido">
      {/* Qué es cada columna lo dice la columna. Acá queda la letra chica:
          qué meses entran en el ritmo, qué queda afuera de «libres» y desde
          qué ritmo el cociente deja de significar algo. */}
      <NotaDato>
        El <strong>ritmo</strong> son los tres últimos meses cerrados
        ({mesesRitmoTxt}): el mes en curso no entra porque está a medias.
        De <strong>libres</strong> quedan afuera las reservadas, lo que está en
        viaje y lo que anda en test drive o cortesía. Con menos de{" "}
        {RITMO_MINIMO_VERSION} autos por mes no se calculan los meses de stock:
        el número no significaría nada.
      </NotaDato>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Qué pedir</CardTitle>
            <p className="text-xs text-muted-foreground">
              Versiones que se venden y tienen menos de un mes y medio de stock
              libre, contando también lo que viene en viaje. Primero las que
              más venden: son las que más duele no tener.
            </p>
          </CardHeader>
          <CardContent>
            {pedido.pedir.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nada urgente: ninguna versión con ritmo tiene menos de un mes y
                medio de stock.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Versión</TableHead>
                    <TableHead className="text-right" nota="ventas por mes, últimos 3 meses">Ritmo</TableHead>
                    <TableHead className="text-right" nota="entregables hoy, sin reservadas">Libres</TableHead>
                    <TableHead className="text-right" nota="compradas, todavía sin llegar">En viaje</TableHead>
                    <TableHead className="text-right" nota="libres ÷ ritmo">Meses</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pedido.pedir.slice(0, 12).map((v) => (
                    <TableRow key={`${v.marca}|${v.version}`}>
                      <TableCell>
                        <span className="font-medium">{v.version}</span>
                        <span className="block text-xs text-muted-foreground">{v.marca}</span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{v.ritmo.toFixed(1)} /mes</TableCell>
                      <TableCell className="text-right tabular-nums">{formatUnidades(v.libres)}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {v.enViaje ? formatUnidades(v.enViaje) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-semibold text-rose-600 dark:text-rose-400">
                        {v.meses === null ? "—" : v.meses.toFixed(1)}
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
            <CardTitle>Qué empujar</CardTitle>
            <p className="text-xs text-muted-foreground">
              Versiones con más de seis meses de stock, o con cinco o más
              unidades libres que casi no se mueven. Primero las que más plata
              tienen parada. Acá va promoción, no pedido.
            </p>
          </CardHeader>
          <CardContent>
            {pedido.empujar.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nada parado: ninguna versión pasa los seis meses de stock.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Versión</TableHead>
                    <TableHead className="text-right" nota="entregables hoy, sin reservadas">Libres</TableHead>
                    <TableHead className="text-right" nota="ventas por mes, últimos 3 meses">Ritmo</TableHead>
                    <TableHead className="text-right" nota="libres ÷ ritmo">Meses</TableHead>
                    <TableHead className="text-right" nota="de lista en Cars, sin descuento">Precio lista</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pedido.empujar.slice(0, 12).map((v) => (
                    <TableRow key={`${v.marca}|${v.version}`}>
                      <TableCell>
                        <span className="font-medium">{v.version}</span>
                        <span className="block text-xs text-muted-foreground">{v.marca}</span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatUnidades(v.libres)}</TableCell>
                      <TableCell className="text-right tabular-nums">{v.ritmo.toFixed(1)} /mes</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold text-amber-600 dark:text-amber-500">
                        {v.meses === null ? "sin ritmo" : v.meses.toFixed(1)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {v.precio_usd ? `US$ ${formatUnidades(v.precio_usd)}` : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Stock y ritmo por versión</CardTitle>
          <p className="text-xs text-muted-foreground">
            Las {versionesTabla.length} versiones con más unidades libres. La
            última columna dice qué hacer con cada una, en una palabra.
          </p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Marca</TableHead>
                <TableHead>Versión</TableHead>
                <TableHead className="text-right" nota="entregables hoy, sin reservadas">Libres</TableHead>
                <TableHead className="text-right" nota="con seña: no se ofrecen de nuevo">Reservadas</TableHead>
                <TableHead className="text-right" nota="compradas, todavía sin llegar">En viaje</TableHead>
                <TableHead className="text-right" nota="ventas por mes, últimos 3 meses">Ritmo</TableHead>
                <TableHead className="text-right" nota="libres ÷ ritmo">Meses</TableHead>
                <TableHead nota="la lectura de la fila">Qué hacer</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {versionesTabla.map((v) => (
                <TableRow key={`${v.marca}|${v.version}`}>
                  <TableCell className="font-medium">{v.marca}</TableCell>
                  <TableCell>{v.version}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatUnidades(v.libres)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {v.reservadas ? formatUnidades(v.reservadas) : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {v.enViaje ? formatUnidades(v.enViaje) : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {v.ritmo > 0 ? `${v.ritmo.toFixed(1)} /mes` : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {v.meses === null ? "—" : v.meses.toFixed(1)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "font-medium",
                      v.accion === "pedir" && "text-rose-600 dark:text-rose-400",
                      v.accion === "empujar" && "text-amber-600 dark:text-amber-500",
                      (v.accion === "ok" || v.accion === "llega") && "text-emerald-700 dark:text-emerald-400",
                      v.accion === "sin ritmo" && "text-muted-foreground"
                    )}
                  >
                    {etiquetaAccion(v.accion)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      </Seccion>

      <Seccion titulo="Cómo venimos"
        nota="Lo facturado del año contra el mismo período del año pasado, mes a mes.">
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

      </Seccion>

      <Seccion titulo="Marca por marca"
        nota="Cómo va cada marca: lo que vendimos nosotros, lo que la marca patentó en todo el país, qué stock queda y cuánto de lo que Finanzas planificó está hecho." id="marcas">
      <Card>
        <CardHeader>
          <CardTitle>Marca por marca — {periodo}</CardTitle>
          {/* Lo que cada columna significa ya lo dice la columna (ver el
              `nota` de cada TableHead). Acá queda SOLO lo que no entra en
              cuatro palabras al lado de un rótulo: de dónde sale el plan, el
              método de la proyección y los totales de pauta. Antes esto eran
              ocho renglones que repetían la tabla entera. */}
          <p className="text-xs text-muted-foreground">
            {hayPresupuesto
              ? `El plan es el ejercicio de Finanzas (${presupuesto.version}, archivo del ${presupuesto.modificado.slice(0, 10)}): hasta ${realHastaMes ? mesCorto(realHastaMes) : "—"} el plan ES el real, así que el cumplimiento se mide solo sobre los meses que siguen. La proyección toma lo facturado hasta el último mes cerrado y le suma lo que el año pasado se vendió en los meses que faltan, al ritmo de este año.`
              : hayMetas
                ? "La meta sale de Configuración. La proyección toma lo facturado hasta el último mes cerrado y le suma lo que el año pasado se vendió en los meses que faltan, al ritmo de este año."
                : "Cargá metas por marca y mes en Configuración y acá aparecen la meta, el cumplimiento y la proyección de cierre de año."}
            {hayPauta && (
              <>
                {" "}Pauta del período: US$ {formatUnidades(Math.round(pautaTotal))} en total
                {pautaSinMarca > 0
                  ? `, de los cuales US$ ${formatUnidades(Math.round(pautaSinMarca))} en cuentas de usados o de varias marcas, que no se reparten entre las filas`
                  : ""}
                .
              </>
            )}
          </p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Marca</TableHead>
                <TableHead className="text-right" nota="lo que vendimos nosotros, en Cars">Facturado</TableHead>
                <TableHead
                  className="text-right"
                  nota="chapas de la marca en todo el país"
                >
                  Matriculado{cadamRecorta ? ` (hasta ${hastaCadam})` : ""}
                </TableHead>
                <TableHead className="text-right" nota="su parte del mercado">Share</TableHead>
                <TableHead className="text-right" nota="unidades de hoy, no del período">Stock</TableHead>
                <TableHead className="text-right" nota="con seña; van dentro del stock">Reservadas</TableHead>
                <TableHead className="text-right" nota="meses que dura al ritmo de hoy">Meses de stock</TableHead>
                {hayMetas && (
                  <>
                    <TableHead className="text-right whitespace-nowrap" nota="lo planificado para estos meses">Plan (período)</TableHead>
                    <TableHead className="text-right" nota="facturado ÷ plan del período">Cumplimiento</TableHead>
                  </>
                )}
                {hayPresupuesto && (
                  <>
                    <TableHead className="text-right whitespace-nowrap" nota="la cifra original del año">Presupuesto anual</TableHead>
                    <TableHead className="text-right whitespace-nowrap" nota="facturado ÷ presupuesto anual">% hecho</TableHead>
                  </>
                )}
                {hayMetas && (
                  <TableHead className="text-right whitespace-nowrap" nota="cierre estimado contra el plan">Proyección / plan año</TableHead>
                )}
                {hayPauta && (
                  <>
                    <TableHead className="text-right whitespace-nowrap" nota="gasto en Meta de la marca">Pauta Meta (US$)</TableHead>
                    <TableHead className="text-right whitespace-nowrap" nota="pauta ÷ facturado; es un promedio">Pauta por vehículo</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((r) => (
                <TableRow key={r.clave}>
                  <TableCell className="font-medium">
                    {r.etiqueta}
                    {r.esGrupo && (
                      <span className="block text-[11px] font-normal text-muted-foreground">
                        meta conjunta: así la presupuesta Finanzas
                      </span>
                    )}
                  </TableCell>
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
                  {hayMetas && (
                    <>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {r.meta ? formatUnidades(r.meta) : "—"}
                        {r.meta && r.abiertos === 0 ? (
                          <span className="block text-[11px]">cerrado</span>
                        ) : null}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right tabular-nums font-medium",
                          r.cumplimiento !== null && r.cumplimiento < 0.85 && "text-rose-600 dark:text-rose-400",
                          r.cumplimiento !== null && r.cumplimiento >= 1 && "text-emerald-700 dark:text-emerald-400"
                        )}
                        title={
                          r.meta && r.abiertos === 0
                            ? "Todos los meses del filtro ya cerraron en el Excel: ahí el plan es el real."
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
                  {hayPauta && (
                    <>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {r.pauta ? `US$ ${formatUnidades(Math.round(r.pauta))}` : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {r.pauta && r.facturado ? `US$ ${formatUnidades(Math.round(r.pauta / r.facturado))}` : "—"}
                      </TableCell>
                    </>
                  )}
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
                  {hayMetas && (
                    <>
                      <TableCell className="text-right">—</TableCell>
                      <TableCell className="text-right">—</TableCell>
                    </>
                  )}
                  {hayPresupuesto && (
                    <>
                      <TableCell className="text-right">—</TableCell>
                      <TableCell className="text-right">—</TableCell>
                    </>
                  )}
                  {hayMetas && <TableCell className="text-right">—</TableCell>}
                  {hayPauta && (
                    <>
                      <TableCell className="text-right">—</TableCell>
                      <TableCell className="text-right">—</TableCell>
                    </>
                  )}
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

      {hayPresupuesto && (
        <Card>
          <CardHeader>
            <CardTitle>
              Plan vs. facturado, mes a mes — {f.anio}
              {f.marca ? ` · ${filas[0]?.etiqueta ?? f.marca}` : ""}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Barras: el plan vigente ({presupuesto.version}) y lo facturado en Cars, por
              mes. Los meses sombreados ya cerraron en el Excel: ahí el plan es el real.
              La línea punteada es el presupuesto anual dividido doce, solo como
              referencia —Finanzas no presupuestó por mes—.
            </p>
          </CardHeader>
          <CardContent>
            <PlanVsFacturadoChart meses={mesesPlan} referenciaMensual={referenciaMensual} />
          </CardContent>
        </Card>
      )}

      </Seccion>

      {canales.length > 0 && (
        <Seccion titulo="Canales que Finanzas presupuesta aparte" id="canales">
          <NotaDato>
            <strong>CDE</strong> (la sucursal de Ciudad del Este) y <strong>Wholesale</strong>{" "}
            (ventas mayoristas) tienen su propio objetivo en el Excel de Finanzas. Sus unidades ya
            están dentro de las marcas de arriba: es otro corte de lo mismo, no se suma. El real de
            acá es <strong>el de Finanzas, del mismo Excel</strong>, hasta el mes que ellos cerraron:
            la sucursal que anota Cars no coincide con esta definición de canal (CDE en Cars: 79
            unidades en {f.anio}; Finanzas: {formatUnidades(canales[0].realYtd)} hasta{" "}
            {canales[0].realHastaMes ? mesCorto(canales[0].realHastaMes) : "—"}).
          </NotaDato>
          <Card>
            <CardHeader>
              <CardTitle>Objetivo y real por canal — {f.anio}</CardTitle>
              <p className="text-xs text-muted-foreground">
                Las dos cifras salen del mismo Excel de Finanzas, no de Cars, y
                se miden hasta el mes que ellos cerraron.
              </p>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Canal</TableHead>
                    <TableHead className="text-right whitespace-nowrap" nota="lo planificado hasta el mes cerrado">Objetivo a la fecha</TableHead>
                    <TableHead className="text-right whitespace-nowrap" nota="lo vendido según Finanzas, no Cars">Real (Finanzas)</TableHead>
                    <TableHead className="text-right" nota="real ÷ objetivo a la fecha">Cumplimiento</TableHead>
                    <TableHead className="text-right whitespace-nowrap" nota="lo planificado para todo el año">Objetivo anual</TableHead>
                    <TableHead className="text-right whitespace-nowrap" nota="real ÷ objetivo anual">% del año hecho</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {canales.map((c) => (
                    <TableRow key={c.canal}>
                      <TableCell className="font-medium">
                        {c.canal === "CDE" ? "CDE (Ciudad del Este)" : "Wholesale (mayoristas)"}
                        <span className="block text-[11px] font-normal text-muted-foreground">
                          real hasta {c.realHastaMes ? mesCorto(c.realHastaMes) : "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {formatUnidades(c.objetivoYtd)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatUnidades(c.realYtd)}</TableCell>
                      <TableCell
                        className={cn(
                          "text-right tabular-nums font-medium",
                          c.cumplimiento !== null && c.cumplimiento < 0.85 && "text-rose-600 dark:text-rose-400",
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
                    {c.canal === "CDE" ? "CDE" : "Wholesale"} — objetivo vs. real, mes a mes
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Objetivo del Excel ({presupuesto?.version}) y real de Finanzas hasta{" "}
                    {c.realHastaMes ? mesCorto(c.realHastaMes) : "—"}; de ahí en adelante solo hay
                    objetivo.
                  </p>
                </CardHeader>
                <CardContent>
                  <PlanVsFacturadoChart
                    meses={c.meses}
                    referenciaMensual={null}
                    altura={260}
                    etiquetaPlan="Objetivo"
                    etiquetaReal="Real (Finanzas)"
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        </Seccion>
      )}

      <Seccion titulo="Demanda que no cerró"
        nota="Los leads de Bitrix que no terminaron en venta: por qué se cayeron, de qué modelos eran y si hoy habría stock para atenderlos." id="demanda">
      {!hayDemanda ? (
        <Card>
          <CardContent>
            <EmptyState
              title="Todavía no hay demanda de Bitrix"
              description="Se agrega el 06/09/2026: hace falta que Hermes corra advisor-demanda-bitrix.py. Si ya pasaron unas horas, revisá ese trabajo."
            />
          </CardContent>
        </Card>
      ) : (
      <>
      <Card>
        <CardHeader>
          <CardTitle>Por marca — {periodo}</CardTitle>
          <p className="text-xs text-muted-foreground">
            Leads de Bitrix creados en el período. Lo facturado acá es{" "}
            <strong>solo retail</strong>: las{" "}
            {formatUnidades(unidadesMayoristas)} unidades mayoristas del período
            (flotas y ventas de gerencia) no las trajo ningún lead, y contarlas
            haría parecer que la demanda se aprovecha mejor de lo que se
            aprovecha.
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Marca</TableHead>
                <TableHead className="text-right" nota="consultas que entraron a Bitrix">Leads</TableHead>
                <TableHead className="text-right" nota="siguen sin cerrarse ni perderse">Abiertos</TableHead>
                <TableHead className="text-right" nota="pasaron a negociación">Convertidos</TableHead>
                <TableHead className="text-right" nota="se dieron de baja">Perdidos</TableHead>
                <TableHead nota="los motivos que más se repiten">Por qué se perdieron</TableHead>
                <TableHead className="text-right" nota="ya calificados: abiertos / ganados / perdidos">
                  Negocios
                </TableHead>
                <TableHead className="text-right" nota="sin flotas ni ventas de gerencia">Facturado retail</TableHead>
                <TableHead className="text-right" nota="leads por vehículo retail: si sube, se desaprovecha">
                  Leads
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...filasDemandaMarca, {
                marca: "Total", ...demandaTotal,
                facturado: Math.max(0, totalFacturas - unidadesMayoristas),
                mayorista: unidadesMayoristas,
              }].map((r, i) => (
                <TableRow key={r.marca} className={cn(i === filasDemandaMarca.length && "font-medium")}>
                  <TableCell className="font-medium">{r.marca}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatUnidades(r.leads)}
                    {r.descartados > 0 && (
                      <span className="block text-[11px] font-normal text-muted-foreground whitespace-nowrap">
                        {formatUnidades(r.descartados)} descartados
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatUnidades(r.abiertos)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatUnidades(r.ganados)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatUnidades(r.perdidos)}</TableCell>
                  <TableCell className="max-w-72 whitespace-normal text-xs font-normal leading-snug text-muted-foreground">
                    {motivosTop(r).map(([m, n]) => `${m} ${formatUnidades(n)}`).join(" · ") || "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.negocios ? `${r.negAbiertos} / ${r.negGanados} / ${r.negPerdidos}` : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{r.facturado ? formatUnidades(r.facturado) : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.facturado && r.leads ? (r.leads / r.facturado).toFixed(1).replace(".", ",") : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Por modelo — {periodo}</CardTitle>
          <p className="text-xs text-muted-foreground">
            Solo la demanda que nombra el modelo: Bitrix no tiene campo de
            modelo en los leads, así que se lee del título o de la campaña
            cuando lo dicen ({formatPct(leadsConModelo / (demandaTotal.leads || 1))} de los
            leads del período) y del producto cargado en los negocios
            ({formatPct(negociosConModelo / (demandaTotal.negocios || 1))} de los negocios).
            Se cruza con lo facturado retail en Cars —sin flotas ni ventas de
            gerencia— y con el stock libre de hoy para decir qué hacer.
          </p>
        </CardHeader>
        <CardContent>
          {filasDemandaModelo.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Ningún lead ni negocio del período nombra el modelo.
            </p>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Modelo</TableHead>
                  <TableHead className="text-right whitespace-nowrap" nota="leads y negocios que nombran el modelo">Demanda</TableHead>
                  <TableHead className="text-right" nota="siguen sin cerrarse ni perderse">Abiertos</TableHead>
                  <TableHead className="text-right" nota="se dieron de baja">Perdidos</TableHead>
                  <TableHead nota="los motivos que más se repiten">Por qué se perdieron</TableHead>
                  <TableHead className="text-right" nota="sin flotas ni ventas de gerencia">Facturado retail</TableHead>
                  <TableHead className="text-right whitespace-nowrap" nota="entregables hoy, sin reservadas">Libres hoy</TableHead>
                  <TableHead nota="la lectura de la fila">Qué hacer</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filasDemandaModelo.map((r) => (
                  <TableRow key={`${r.marca}|${r.modelo}`}>
                    <TableCell>
                      <span className="font-medium">{r.modelo}</span>
                      <span className="block text-xs text-muted-foreground">{r.marca}</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatUnidades(r.leads + r.negocios)}
                      <span className="block text-[11px] text-muted-foreground whitespace-nowrap">
                        {formatUnidades(r.leads)} leads · {formatUnidades(r.negocios)} neg.
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatUnidades(r.abiertos + r.negAbiertos)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatUnidades(r.perdidos + r.negPerdidos)}</TableCell>
                    <TableCell className="max-w-72 whitespace-normal text-xs leading-snug text-muted-foreground">
                      {motivosTop(r).map(([m, n]) => `${m} ${formatUnidades(n)}`).join(" · ") || "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{r.facturado ? formatUnidades(r.facturado) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatUnidades(r.libres)}</TableCell>
                    <TableCell
                      className={cn(
                        "text-xs",
                        r.senal?.tono === "pedir" && "font-medium text-amber-600 dark:text-amber-500",
                        r.senal?.tono === "empujar" && "font-medium text-emerald-700 dark:text-emerald-400",
                        r.senal?.tono === "precio" && "font-medium text-amber-600 dark:text-amber-500",
                        (!r.senal || r.senal.tono === "ok") && "text-muted-foreground"
                      )}
                    >
                      {r.senal?.texto ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>
      <NotaDato>
        <strong>Esto es demanda registrada en el CRM, no mercado.</strong>{" "}
        Sale de Bitrix por mes de creación, agregado por Hermes antes de
        salir de su máquina: ningún dato del cliente llega acá. «Abierto»,
        «convertido» y «perdido» son la semántica de cada estado de Bitrix;
        el motivo es el nombre del estado o de la etapa de pérdida. Los
        descartados (spam, datos falsos, duplicados, incontactables) no
        cuentan como demanda perdida: nunca fueron un comprador. La marca de
        interés está cargada en dos de cada tres leads; cuando falta, se lee
        del título. Bitrix reclasifica hacia atrás, así que estas cifras
        cambian en cada actualización
        {demandaFecha ? ` (último: ${formatFechaHora(demandaFecha)})` : ""}.
      </NotaDato>
      </>
      )}
      </Seccion>

      <Seccion titulo="Stock"
        nota="Qué hay hoy en piso y en viaje, modelo por modelo, con su precio de lista.">
      {estadosDesconocidos(stockCrudo).length > 0 && (
        <NotaDato>
          Estados de Cars que la regla de stock no conoce:{" "}
          <strong>{estadosDesconocidos(stockCrudo).join(", ")}</strong>. Cuentan como
          en piso hasta que alguien los clasifique en <code>cobertura.ts</code>
          (en piso, en viaje o no vendible).
        </NotaDato>
      )}
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
                <TableHead className="text-right" nota="en stock hoy, todos los estados">Unidades</TableHead>
                <TableHead className="text-right" nota="mediana de lista, en US$">Precio lista</TableHead>
                <TableHead nota="cómo está cada unidad en Cars">Estados</TableHead>
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

      </Seccion>

      {haySucursal && (
        <Seccion titulo="Sucursales"
        nota="Desde qué local se factura cada vehículo y cómo se reparte la venta entre los locales." id="sucursales">
        <Card>
          <CardHeader>
            <CardTitle>Ventas por sucursal — {periodo}</CardTitle>
            <p className="text-xs text-muted-foreground">
              Vehículos facturados desde cada local, cuántos asesores
              facturaron algo ahí y quién más vendió. La sucursal es la que
              Cars registra en la factura.
            </p>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sucursal</TableHead>
                  <TableHead className="text-right" nota="facturados desde ese local">Vehículos</TableHead>
                  <TableHead className="text-right" nota="su parte de todo lo facturado">% del total</TableHead>
                  <TableHead className="text-right" nota="cuántos facturaron algo ahí">Asesores</TableHead>
                  <TableHead nota="el que más vendió en el local">Mejor asesor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sucursales.map((s) => (
                  <TableRow key={s.sucursal}>
                    <TableCell className="font-medium">{s.sucursal}</TableCell>
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

      <Seccion titulo="Asesores"
        nota="Quién vende y cuánto. El retail va aparte del mayorista: son dos negocios distintos y mezclarlos aplasta el ranking." id="asesores">
      {asesoresPeriodo.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Ranking de asesores — {periodo}</CardTitle>
          </CardHeader>
          <CardContent>
            <EmptyState
              title="Todavía no hay ranking de asesores"
              description="Se agrega el 03/09/2026: hace falta que Hermes corra el push de Cars de nuevo para que este período tenga datos. Si ya pasaron unas horas, revisá el trabajo advisor-datos-propios."
            />
          </CardContent>
        </Card>
      ) : (
      <>
        {/* A lo ancho: con las columnas de leads son ocho columnas y a media
            pantalla la tabla se corta y hay que arrastrarla. */}
        <Card>
          <CardHeader>
            <CardTitle>Ranking retail — {periodo}</CardTitle>
            <p className="text-xs text-muted-foreground">
              Los {Math.min(15, rankingAsesores.length)} de {rankingAsesores.length}{" "}
              asesores retail con más vehículos facturados
              {f.marca ? ` de ${f.marca}` : ""}. Las ventas mayoristas van
              aparte, más abajo.
            </p>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Asesor</TableHead>
                  <TableHead nota="la que más vende de las suyas">Marca</TableHead>
                  <TableHead className="text-right" nota="facturados por él en el período">Vehículos</TableHead>
                  <TableHead className="text-right" nota="su parte de todo lo facturado">% del total</TableHead>
                  {hayLeads && (
                    <>
                      <TableHead className="text-right" nota="los que Bitrix le asignó">Leads</TableHead>
                      <TableHead className="text-right" nota="nadie los tocó todavía">Sin contactar</TableHead>
                      <TableHead className="text-right whitespace-nowrap" nota="cuántos de sus leads cerraron">Lead → venta</TableHead>
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
                      title={noEsPersona(a.asesor) ? "No es una persona: bucket interno de Cars." : undefined}
                    >
                      {a.asesor}
                    </TableCell>
                    <TableCell
                      className="text-xs text-muted-foreground"
                      title={
                        marcasDe(a.asesor).length > 1
                          ? `Factura ${marcasDe(a.asesor).length} marcas, de la que más vende a la que menos.`
                          : undefined
                      }
                    >
                      {marcasDe(a.asesor).slice(0, 3).join(" · ") || "—"}
                      {marcasDe(a.asesor).length > 3 ? ` +${marcasDe(a.asesor).length - 3}` : ""}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
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
                                ? "font-medium text-rose-600 dark:text-rose-400"
                                : "text-muted-foreground"
                            )}
                          >
                            {l ? formatUnidades(l.sinContacto) : "—"}
                          </TableCell>
                          <TableCell
                            className="text-right tabular-nums"
                            title={
                              l && l.leads && (l.leads < 20 || a.unidades > l.leads)
                                ? "Bitrix le asigna pocos leads a este asesor (los recibe quien califica): la conversión no se puede calcular con sentido."
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

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>El mejor de cada marca — {periodo}</CardTitle>
            <p className="text-xs text-muted-foreground">
              Quién vendió más de cada marca en el período, y cuántos asesores
              distintos facturaron algo de esa marca.
            </p>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Marca</TableHead>
                  <TableHead nota="el que más vendió de esa marca">Asesor top</TableHead>
                  <TableHead className="text-right" nota="las que facturó él, no la marca">Sus unidades</TableHead>
                  <TableHead className="text-right" nota="cuántos facturaron algo de la marca">Asesores</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mejorPorMarca.map((m) => (
                  <TableRow key={m.marca}>
                    <TableCell className="font-medium">{m.marca}</TableCell>
                    <TableCell
                      className={cn(noEsPersona(m.mejorNombre) && "italic text-muted-foreground")}
                      title={noEsPersona(m.mejorNombre) ? "No es una persona: bucket interno de Cars." : undefined}
                    >
                      {m.mejorNombre}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatUnidades(m.mejorUnidades)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {m.asesoresDistintos}
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
            <CardTitle>Ventas mayoristas — {periodo}</CardTitle>
            <p className="text-xs text-muted-foreground">
              Flotas y ventas de gerencia. Es otro negocio: no compite con los
              asesores retail y por eso no está en el ranking. La lista de
              quiénes son mayoristas la mantiene Sistemas: hoy son Ventas
              Gerencia, Ventas Gerencia Externa y Eduardo Vigorito.
            </p>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendedor mayorista</TableHead>
                  <TableHead className="text-right" nota="flotas y ventas de gerencia">Vehículos</TableHead>
                  <TableHead className="text-right" nota="su parte de todo lo facturado">% de lo facturado</TableHead>
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
        <strong>Esto es desempeño individual, no un dato de mercado.</strong>{" "}
        Sale de <code>Vendedor</code> en las facturas de Cars, agregado por
        Hermes antes de salir de la máquina — nunca viaja factura por
        factura. Una unidad es un vehículo (un VIN), contado en su primera
        factura. De los {formatUnidades(totalFacturas)} vehículos del período:{" "}
        <strong>{formatUnidades(unidadesConAsesor)} retail</strong> (el ranking),{" "}
        <strong>{formatUnidades(unidadesMayoristas)} mayoristas</strong>
        {totalFacturas - unidadesConAsesor - unidadesMayoristas > 0
          ? ` y ${formatUnidades(totalFacturas - unidadesConAsesor - unidadesMayoristas)} sin vendedor cargado en Cars`
          : ""}
        . Si algún nombre en cursiva no es una persona (una razón social,
        por ejemplo), Cars lo cargó en el mismo campo que a un asesor.
        {hayLeads && (
          <>
            {" "}<strong>Sobre los leads:</strong> son los de Bitrix, por
            responsable y mes. El CRM le asigna la mayoría a quienes califican
            (el equipo que llama primero), no a quien cierra, así que muchos
            vendedores aparecen con pocos leads o ninguno. «Lead → venta» solo
            se calcula cuando el asesor tiene al menos 20 leads asignados y no
            vende más de lo que le asignan; si no, sería un porcentaje sin
            sentido, y se muestra «—».
          </>
        )}
      </NotaDato>
      </Seccion>

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
        {typeof detalle.vehiculos === "number" && (
          <>
            {" "}<strong>Una unidad es un vehículo, no una factura:</strong> de
            esas {String(detalle.facturas_leidas)} facturas,{" "}
            {String(detalle.vehiculos)} son vehículos distintos (1 VIN = 1
            unidad, contado en su primera factura;{" "}
            {String(detalle.facturas_repetidas ?? 0)} facturas repetían un VIN
            ya contado — seña, saldo o accesorios en documentos aparte). Las{" "}
            {String(detalle.usados_excluidos ?? 0)} facturas de LOCAL USADOS
            quedan fuera: son usados de marcas propias, no 0km.
          </>
        )}
      </NotaDato>
    </div>
  );
}
