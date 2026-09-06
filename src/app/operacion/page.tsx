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
import { getAsesoresMayoristasSet, getMetasMensuales, getParametros } from "@/lib/cadam/config";
import { hoyEnAsuncion } from "@/lib/format";
import {
  getEstadoSyncPropio, getStockPropio, getVentasAsesor, getVentasPropias,
  hayDatosPropios,
} from "@/lib/informes/propios";
import { formatFechaHora, formatPct, formatUnidades } from "@/lib/format";
import { calcularCobertura, etiquetaAccion, RITMO_MINIMO as RITMO_MINIMO_VERSION } from "@/lib/informes/cobertura";
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

  // --- metas: vehículos por marca y mes, cargadas en Configuración -------
  const metasAnio = getMetasMensuales(f.anio);
  const hayMetas = Object.keys(metasAnio).length > 0;
  const metaPeriodoDe = (marca: string) =>
    (metasAnio[marca] ?? []).slice(f.mesDesde - 1, f.mesHasta).reduce((s: number, v) => s + (v ?? 0), 0);
  const metaAnioDe = (marca: string) =>
    (metasAnio[marca] ?? []).reduce((s: number, v) => s + (v ?? 0), 0);
  const enMeses = (periodoTxt: string, anio: number, desde: number, hasta: number) => {
    const [a, m] = periodoTxt.split("-").map(Number);
    return a === anio && m >= desde && m <= hasta;
  };
  const sumaMeses = (marca: string, anio: number, desde: number, hasta: number) =>
    ventasCrudas
      .filter((v) => v.marca === marca && enMeses(v.periodo, anio, desde, hasta))
      .reduce((s, v) => s + v.unidades, 0);
  // Proyección de cierre de año, por marca: lo facturado hasta el último
  // mes cerrado, más lo que el año pasado se vendió en los meses que
  // faltan, escalado por cómo viene este año contra el pasado en los mismos
  // meses (la estacionalidad la pone el año pasado, el nivel lo pone este).
  // Solo para el año en curso: un año cerrado no se proyecta.
  const hoyIso = hoyEnAsuncion();
  const mesCerrado = Number(hoyIso.slice(5, 7)) - 1;
  const proyectar = f.anio === Number(hoyIso.slice(0, 4)) && mesCerrado >= 1;
  const proyeccionDe = (marca: string): number | null => {
    if (!proyectar) return null;
    const ytd = sumaMeses(marca, f.anio, 1, mesCerrado);
    const lyYtd = sumaMeses(marca, f.anio - 1, 1, mesCerrado);
    const lyResto = sumaMeses(marca, f.anio - 1, mesCerrado + 1, 12);
    if (lyYtd > 0 && lyResto > 0) return Math.round(ytd + lyResto * (ytd / lyYtd));
    return Math.round(ytd + (ytd / mesCerrado) * (12 - mesCerrado));
  };
  const metaTotal = (f.marca ? [f.marca] : propias).reduce((s, m) => s + metaPeriodoDe(m), 0);

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
        meta: metaPeriodoDe(marca),
        metaAnio: metaAnioDe(marca),
        proyeccion: proyeccionDe(marca),
        pauta: pautaDe(marca),
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
  const filasDemandaMarca = [...demandaPorMarca.entries()]
    .map(([marca, r]) => ({ marca, ...r, facturado: facturadoPorMarca.get(marca) ?? 0 }))
    .sort((a, b) => b.leads + b.negocios - (a.leads + a.negocios));
  // Bitrix da la familia ("T2", "L200", "JOLION"); Cars la escribe a su
  // manera ("L200 TRITON", "HAVAL JOLION"). Coinciden si la palabra de
  // Bitrix está entre las del modelo de Cars, sin separar letra de número.
  const coincideFamilia = (familia: string, modeloCars: string) => tokensNombre(modeloCars).includes(familia);
  const facturadoDeModelo = (marca: string, familia: string) =>
    facturasPeriodo
      .filter((v) => v.marca === marca && coincideFamilia(familia, v.modelo))
      .reduce((s, v) => s + v.unidades, 0);
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
  const unidadesPorAsesorSucursal = new Map<string, Map<string, number>>();
  for (const a of asesoresPeriodo) {
    const s = a.sucursal || "Sin sucursal";
    const x = porSucursal.get(s) ?? { unidades: 0, asesores: new Map<string, number>() };
    x.unidades += a.unidades;
    x.asesores.set(a.asesor, (x.asesores.get(a.asesor) ?? 0) + a.unidades);
    porSucursal.set(s, x);
    const m = unidadesPorAsesorSucursal.get(a.asesor) ?? new Map<string, number>();
    m.set(s, (m.get(s) ?? 0) + a.unidades);
    unidadesPorAsesorSucursal.set(a.asesor, m);
  }
  const sucursales = [...porSucursal.entries()]
    .map(([sucursal, x]) => {
      const top = [...x.asesores.entries()].sort((a, b) => b[1] - a[1])[0];
      return { sucursal, unidades: x.unidades, asesores: x.asesores.size, top };
    })
    .sort((a, b) => b.unidades - a.unidades);
  // La sucursal "principal" de cada asesor: donde más facturó en el período.
  const sucursalDe = new Map(
    [...unidadesPorAsesorSucursal.entries()].map(([asesor, m]) => [
      asesor,
      [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "",
    ])
  );
  const haySucursal = sucursales.some((s) => s.sucursal !== "Sin sucursal");

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
        }.`}
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
          label="Meta del período"
          value={hayMetas && metaTotal ? formatPct(totalFacturas / metaTotal) : "—"}
          // Sin meta no hay número que animar: con 0 la tarjeta mostraba
          // "0.0%", que se lee como "no vendimos nada".
          valorAnimado={hayMetas && metaTotal ? totalFacturas / metaTotal : undefined}
          formato="porcentaje"
          periodo={
            hayMetas && metaTotal
              ? `${formatUnidades(totalFacturas)} de ${formatUnidades(metaTotal)} · ${periodo}`
              : "Sin metas cargadas"
          }
          tooltip={
            hayMetas
              ? "Vehículos facturados contra la meta cargada en Configuración para estos meses."
              : "Cargá metas por marca y mes en Configuración para ver el cumplimiento acá."
          }
          tono="tinta"
        />
      </div>

      <Seccion titulo="Pedido de stock" id="pedido">
      <NotaDato>
        <strong>Cómo leer esto.</strong> El <strong>ritmo</strong> es cuántos
        autos por mes se vendieron de cada versión en los últimos tres meses
        cerrados ({mesesRitmoTxt}); el mes en curso no entra porque está a
        medias. <strong>Libres</strong> es lo que se puede entregar hoy, sin
        las reservadas ni lo que está en viaje, en test drive o cortesía.{" "}
        <strong>Meses de stock</strong> es libres dividido ritmo. Con menos de{" "}
        {RITMO_MINIMO_VERSION} autos por mes no se calcula: el número no
        significaría nada.
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
                    <TableHead className="text-right">Ritmo</TableHead>
                    <TableHead className="text-right">Libres</TableHead>
                    <TableHead className="text-right">En viaje</TableHead>
                    <TableHead className="text-right">Meses</TableHead>
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
                    <TableHead className="text-right">Libres</TableHead>
                    <TableHead className="text-right">Ritmo</TableHead>
                    <TableHead className="text-right">Meses</TableHead>
                    <TableHead className="text-right">Precio lista</TableHead>
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
                <TableHead className="text-right">Libres</TableHead>
                <TableHead className="text-right">Reservadas</TableHead>
                <TableHead className="text-right">En viaje</TableHead>
                <TableHead className="text-right">Ritmo</TableHead>
                <TableHead className="text-right">Meses</TableHead>
                <TableHead>Qué hacer</TableHead>
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

      <Seccion titulo="Cómo venimos">
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

      <Seccion titulo="Marca por marca">
      <Card>
        <CardHeader>
          <CardTitle>Marca por marca — {periodo}</CardTitle>
          <p className="text-xs text-muted-foreground">
            Los tres números al lado: lo que facturamos (Cars), lo que se
            matriculó (CADAM) y qué parte del mercado es eso. El stock y su
            cobertura son de hoy, no del período.
            {hayMetas
              ? " La meta sale de Configuración; la proyección de cierre de año toma lo facturado hasta el último mes cerrado y le suma lo que el año pasado se vendió en los meses que faltan, al ritmo de este año."
              : " Cargá metas por marca y mes en Configuración y acá aparecen la meta, el cumplimiento y la proyección de cierre de año."}
            {hayPauta && (
              <>
                {" "}La pauta es el gasto en Meta de las cuentas de cada marca en el período
                (US$ {formatUnidades(Math.round(pautaTotal))} en total
                {pautaSinMarca > 0
                  ? `, de los cuales US$ ${formatUnidades(Math.round(pautaSinMarca))} en cuentas de usados o de varias marcas, que no se reparten`
                  : ""}
                ); «pauta por vehículo» es ese gasto dividido lo facturado — no es una atribución, es un costo promedio.
              </>
            )}
          </p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Marca</TableHead>
                <TableHead className="text-right">Facturado</TableHead>
                <TableHead className="text-right">
                  Matriculado{cadamRecorta ? ` (hasta ${hastaCadam})` : ""}
                </TableHead>
                <TableHead className="text-right">Share</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Reservadas</TableHead>
                <TableHead className="text-right">Meses de stock</TableHead>
                {hayMetas && (
                  <>
                    <TableHead className="text-right">Meta</TableHead>
                    <TableHead className="text-right">Cumplimiento</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Proyección / meta año</TableHead>
                  </>
                )}
                {hayPauta && (
                  <>
                    <TableHead className="text-right whitespace-nowrap">Pauta Meta (US$)</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Pauta por vehículo</TableHead>
                  </>
                )}
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
                  {hayMetas && (
                    <>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {r.meta ? formatUnidades(r.meta) : "—"}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right tabular-nums font-medium",
                          r.meta && r.facturado / r.meta < 0.85 && "text-rose-600 dark:text-rose-400",
                          r.meta && r.facturado / r.meta >= 1 && "text-emerald-700 dark:text-emerald-400"
                        )}
                      >
                        {r.meta ? formatPct(r.facturado / r.meta) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground whitespace-nowrap">
                        {r.proyeccion !== null && r.metaAnio
                          ? `${formatUnidades(r.proyeccion)} / ${formatUnidades(r.metaAnio)}`
                          : r.proyeccion !== null
                            ? formatUnidades(r.proyeccion)
                            : "—"}
                      </TableCell>
                    </>
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
                      <TableCell className="text-right">—</TableCell>
                    </>
                  )}
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

      </Seccion>

      <Seccion titulo="Demanda que no cerró" id="demanda">
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
            Leads de Bitrix creados en el período: cuántos siguen abiertos,
            cuántos se convirtieron en negociación y cuántos se perdieron, con
            los motivos que más se repiten. «Leads por vehículo» es cuántos
            leads entraron por cada vehículo facturado en Cars: si sube, la
            demanda se está desaprovechando. Los negocios (oportunidades ya
            calificadas) van aparte.
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Marca</TableHead>
                <TableHead className="text-right">Leads</TableHead>
                <TableHead className="text-right">Abiertos</TableHead>
                <TableHead className="text-right">Convertidos</TableHead>
                <TableHead className="text-right">Perdidos</TableHead>
                <TableHead className="min-w-56">Por qué se perdieron</TableHead>
                <TableHead className="text-right">
                  Negocios
                  <span className="block text-[10px] font-normal normal-case tracking-normal text-muted-foreground whitespace-nowrap">
                    abiertos / ganados / perdidos
                  </span>
                </TableHead>
                <TableHead className="text-right">Facturado</TableHead>
                <TableHead className="text-right">
                  Leads
                  <span className="block text-[10px] font-normal normal-case tracking-normal text-muted-foreground whitespace-nowrap">
                    por vehículo
                  </span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...filasDemandaMarca, { marca: "Total", ...demandaTotal, facturado: totalFacturas }].map((r, i) => (
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
                  <TableCell className="text-xs font-normal text-muted-foreground">
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
            Se cruza con lo facturado en Cars y con el stock libre de hoy
            para decir qué hacer.
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
                  <TableHead className="text-right whitespace-nowrap">Demanda</TableHead>
                  <TableHead className="text-right">Abiertos</TableHead>
                  <TableHead className="text-right">Perdidos</TableHead>
                  <TableHead>Por qué se perdieron</TableHead>
                  <TableHead className="text-right">Facturado</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Libres hoy</TableHead>
                  <TableHead>Qué hacer</TableHead>
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
                    <TableCell className="text-xs text-muted-foreground">
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
        cambian con cada push
        {demandaFecha ? ` (último: ${formatFechaHora(demandaFecha)})` : ""}.
      </NotaDato>
      </>
      )}
      </Seccion>

      <Seccion titulo="Stock">
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

      </Seccion>

      {haySucursal && (
        <Seccion titulo="Sucursales" id="sucursales">
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
                  <TableHead className="text-right">Vehículos</TableHead>
                  <TableHead className="text-right">% del total</TableHead>
                  <TableHead className="text-right">Asesores</TableHead>
                  <TableHead>Mejor asesor</TableHead>
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

      <Seccion titulo="Asesores" id="asesores">
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
                  {haySucursal && <TableHead>Sucursal</TableHead>}
                  <TableHead className="text-right">Vehículos</TableHead>
                  <TableHead className="text-right">% del total</TableHead>
                  {hayLeads && (
                    <>
                      <TableHead className="text-right">Leads</TableHead>
                      <TableHead className="text-right">Sin contactar</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Lead → venta</TableHead>
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
                    {haySucursal && (
                      <TableCell className="text-xs text-muted-foreground">
                        {sucursalDe.get(a.asesor) || "—"}
                      </TableCell>
                    )}
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
                  <TableHead>Asesor top</TableHead>
                  <TableHead className="text-right">Sus unidades</TableHead>
                  <TableHead className="text-right">Asesores</TableHead>
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
              quiénes son mayoristas se edita en{" "}
              <code>parametros.json</code> (<code>asesores_mayoristas</code>).
            </p>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendedor mayorista</TableHead>
                  <TableHead className="text-right">Vehículos</TableHead>
                  <TableHead className="text-right">% de lo facturado</TableHead>
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
