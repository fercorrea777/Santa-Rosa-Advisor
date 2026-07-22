import { getDb } from "./db";
import { getMarcasPropiasSet, getParametros } from "./config";

const MESES = ["", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export interface PeriodoInfo {
  periodo: string; // "2026-06"
  archivo: string;
  anioActual: number;
  anioAnterior: number;
  mesMax: number; // ultimo mes con datos de matriculacion (1-12)
}

export interface Rango {
  desde: number; // mes 1-12
  hasta: number; // mes 1-12
}

/** Ajusta un rango pedido por el usuario a los limites de datos disponibles. */
export function clampRango(info: PeriodoInfo, desde?: number | null, hasta?: number | null): Rango {
  const d = Math.min(Math.max(desde ?? 1, 1), info.mesMax);
  const hRaw = hasta ?? info.mesMax;
  const h = Math.min(Math.max(hRaw, d), info.mesMax);
  return { desde: d, hasta: h };
}

export function rangoCompleto(info: PeriodoInfo): Rango {
  return { desde: 1, hasta: info.mesMax };
}

/** Metadatos del ultimo informe de matriculacion ingestado: anio/mes "actual" y "anterior". */
export function getPeriodoInfo(): PeriodoInfo | null {
  const db = getDb();
  const informe = db
    .prepare(
      "SELECT periodo, archivo FROM informes WHERE tipo = 'matriculacion' ORDER BY periodo DESC LIMIT 1"
    )
    .get() as { periodo: string; archivo: string } | undefined;
  if (!informe) return null;

  const anios = db
    .prepare("SELECT DISTINCT anio FROM matriculacion_tipo ORDER BY anio DESC")
    .all() as { anio: number }[];
  if (anios.length === 0) return null;

  const anioActual = anios[0].anio;
  const anioAnterior = anioActual - 1;
  const mesMaxRow = db
    .prepare("SELECT MAX(mes) as mesMax FROM matriculacion_tipo WHERE anio = ?")
    .get(anioActual) as { mesMax: number };

  return {
    periodo: informe.periodo,
    archivo: informe.archivo,
    anioActual,
    anioAnterior,
    mesMax: mesMaxRow.mesMax,
  };
}

export interface EvolucionMensualPunto {
  mes: number;
  mesLabel: string;
  actual: number | null;
  anterior: number | null;
}

/** Total de mercado (todos los tipos, livianos+pesados) mes a mes, ambos anios, recortado al rango. */
export function getEvolucionMensual(info: PeriodoInfo, rango: Rango): EvolucionMensualPunto[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT anio, mes, SUM(unidades) as total
       FROM matriculacion_tipo
       WHERE anio IN (?, ?) AND mes BETWEEN ? AND ?
       GROUP BY anio, mes
       ORDER BY mes`
    )
    .all(info.anioActual, info.anioAnterior, rango.desde, rango.hasta) as {
    anio: number;
    mes: number;
    total: number;
  }[];

  const porMes = new Map<number, { actual: number | null; anterior: number | null }>();
  for (let m = rango.desde; m <= rango.hasta; m++) porMes.set(m, { actual: null, anterior: null });
  for (const r of rows) {
    const entry = porMes.get(r.mes)!;
    if (r.anio === info.anioActual) entry.actual = r.total;
    else entry.anterior = r.total;
  }

  return Array.from(porMes.entries()).map(([mes, v]) => ({
    mes,
    mesLabel: MESES[mes],
    actual: v.actual,
    anterior: v.anterior,
  }));
}

export interface DistribucionTipoItem {
  tipo: string;
  actual: number;
  anterior: number;
  variacion: number | null;
  participacion: number;
}

/** Matriculacion por tipo (segmento a nivel CADAM), acumulado en el rango, ambos anios. */
export function getDistribucionTipo(info: PeriodoInfo, rango: Rango): DistribucionTipoItem[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT anio, tipo, SUM(unidades) as total
       FROM matriculacion_tipo
       WHERE anio IN (?, ?) AND mes BETWEEN ? AND ?
       GROUP BY anio, tipo`
    )
    .all(info.anioActual, info.anioAnterior, rango.desde, rango.hasta) as {
    anio: number;
    tipo: string;
    total: number;
  }[];

  const porTipo = new Map<string, { actual: number; anterior: number }>();
  for (const r of rows) {
    const entry = porTipo.get(r.tipo) ?? { actual: 0, anterior: 0 };
    if (r.anio === info.anioActual) entry.actual = r.total;
    else entry.anterior = r.total;
    porTipo.set(r.tipo, entry);
  }

  const totalActual = Array.from(porTipo.values()).reduce((s, v) => s + v.actual, 0);

  return Array.from(porTipo.entries())
    .map(([tipo, v]) => ({
      tipo,
      actual: v.actual,
      anterior: v.anterior,
      variacion: v.anterior > 0 ? (v.actual - v.anterior) / v.anterior : null,
      participacion: totalActual > 0 ? v.actual / totalActual : 0,
    }))
    .sort((a, b) => b.actual - a.actual);
}

export interface RankingMarcaItem {
  rank: number;
  marca: string;
  actual: number;
  anterior: number;
  variacion: number | null;
  participacion: number;
  esPropia: boolean;
  esCompetidorClave: boolean;
}

/** Ranking de marcas (livianos, Cuadro 2), acumulado en el rango, ambos anios. */
export function getRankingMarcas(info: PeriodoInfo, rango: Rango): RankingMarcaItem[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT anio, marca, SUM(unidades) as total
       FROM matriculacion_marca
       WHERE anio IN (?, ?) AND mes BETWEEN ? AND ?
       GROUP BY anio, marca`
    )
    .all(info.anioActual, info.anioAnterior, rango.desde, rango.hasta) as {
    anio: number;
    marca: string;
    total: number;
  }[];

  const porMarca = new Map<string, { actual: number; anterior: number }>();
  for (const r of rows) {
    const entry = porMarca.get(r.marca) ?? { actual: 0, anterior: 0 };
    if (r.anio === info.anioActual) entry.actual = r.total;
    else entry.anterior = r.total;
    porMarca.set(r.marca, entry);
  }

  const totalActual = Array.from(porMarca.values()).reduce((s, v) => s + v.actual, 0);
  const propias = getMarcasPropiasSet();
  const competidores = new Set(getParametros().competidores_clave);

  const ranked = Array.from(porMarca.entries())
    .filter(([, v]) => v.actual > 0 || v.anterior > 0)
    .map(([marca, v]) => ({
      marca,
      actual: v.actual,
      anterior: v.anterior,
      variacion: v.anterior > 0 ? (v.actual - v.anterior) / v.anterior : null,
      participacion: totalActual > 0 ? v.actual / totalActual : 0,
      esPropia: propias.has(marca),
      esCompetidorClave: competidores.has(marca),
    }))
    .sort((a, b) => b.actual - a.actual);

  return ranked.map((r, i) => ({ ...r, rank: i + 1 }));
}

/**
 * Forma comun para las 4 tablas de ranking (marcas/modelos x
 * matriculacion/importacion) -- cada una ordenada y rankeada por SU PROPIA
 * metrica, nunca mezclada con la de otra fuente (las posiciones no
 * coinciden entre matriculacion e importacion, no tiene sentido un solo #).
 */
export interface RankingItem {
  rank: number;
  label: string;
  actual: number;
  anterior: number;
  variacion: number | null;
  participacion: number;
  esPropia: boolean;
  esCompetidorClave: boolean;
}

function aRankingItem(m: RankingMarcaItem): RankingItem {
  return {
    rank: m.rank,
    label: m.marca,
    actual: m.actual,
    anterior: m.anterior,
    variacion: m.variacion,
    participacion: m.participacion,
    esPropia: m.esPropia,
    esCompetidorClave: m.esCompetidorClave,
  };
}

/** Ranking de marcas por matriculacion (wrapper de getRankingMarcas en la forma comun). */
export function getRankingMarcasMatriculacion(info: PeriodoInfo, rango: Rango): RankingItem[] {
  return getRankingMarcas(info, rango).map(aRankingItem);
}

/**
 * Ranking de marcas por importacion (Cuadro 5, livianos, solo anio en
 * curso). Sin "anterior"/variacion: CADAM no publica la serie mensual del
 * anio anterior a nivel de marca en este cuadro.
 */
export function getRankingMarcasImportacion(
  importacionInfo: ImportacionInfo,
  rango: Rango
): RankingItem[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT marca, SUM(unidades) as total
       FROM importacion_marca_mensual
       WHERE informe_periodo = ? AND anio = ? AND mes BETWEEN ? AND ?
       GROUP BY marca`
    )
    .all(importacionInfo.periodo, importacionInfo.anioActual, rango.desde, rango.hasta) as {
    marca: string;
    total: number;
  }[];

  const totalActual = rows.reduce((s, r) => s + r.total, 0);
  const propias = getMarcasPropiasSet();
  const competidores = new Set(getParametros().competidores_clave);

  return rows
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total)
    .map((r, i) => ({
      rank: i + 1,
      label: r.marca,
      actual: r.total,
      anterior: 0,
      variacion: null,
      participacion: totalActual > 0 ? r.total / totalActual : 0,
      esPropia: propias.has(r.marca),
      esCompetidorClave: competidores.has(r.marca),
    }));
}

const LIMITE_MODELOS = 100;

/**
 * Ranking de modelos por matriculacion (Cuadro 17: marca+modelo, tipo y
 * pesados incluidos, solo anio en curso). Se recorta a los primeros
 * LIMITE_MODELOS por unidades -- con ~1150 modelos distintos, la cola larga
 * son 1-2 unidades y no aporta al ranking; la participacion sigue
 * calculandose sobre el total real, no sobre el recorte.
 */
export function getRankingModelosMatriculacion(info: PeriodoInfo, rango: Rango): RankingItem[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT marca, modelo, SUM(unidades) as total
       FROM matriculacion_modelo_mensual
       WHERE informe_periodo = ? AND anio = ? AND mes BETWEEN ? AND ?
       GROUP BY marca, modelo
       ORDER BY total DESC`
    )
    .all(info.periodo, info.anioActual, rango.desde, rango.hasta) as {
    marca: string;
    modelo: string;
    total: number;
  }[];

  const totalActual = rows.reduce((s, r) => s + r.total, 0);
  const propias = getMarcasPropiasSet();
  const competidores = new Set(getParametros().competidores_clave);

  return rows.slice(0, LIMITE_MODELOS).map((r, i) => ({
    rank: i + 1,
    label: `${r.marca} — ${r.modelo}`,
    actual: r.total,
    anterior: 0,
    variacion: null,
    participacion: totalActual > 0 ? r.total / totalActual : 0,
    esPropia: propias.has(r.marca),
    esCompetidorClave: competidores.has(r.marca),
  }));
}

/** Ranking de modelos por importacion (Cuadro 8, livianos, solo anio en curso). */
export function getRankingModelosImportacion(
  importacionInfo: ImportacionInfo,
  rango: Rango
): RankingItem[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT marca, modelo, SUM(unidades) as total
       FROM importacion_modelo_mensual
       WHERE informe_periodo = ? AND anio = ? AND mes BETWEEN ? AND ?
       GROUP BY marca, modelo
       ORDER BY total DESC`
    )
    .all(importacionInfo.periodo, importacionInfo.anioActual, rango.desde, rango.hasta) as {
    marca: string;
    modelo: string;
    total: number;
  }[];

  const totalActual = rows.reduce((s, r) => s + r.total, 0);
  const propias = getMarcasPropiasSet();
  const competidores = new Set(getParametros().competidores_clave);

  return rows.slice(0, LIMITE_MODELOS).map((r, i) => ({
    rank: i + 1,
    label: `${r.marca} — ${r.modelo}`,
    actual: r.total,
    anterior: 0,
    variacion: null,
    participacion: totalActual > 0 ? r.total / totalActual : 0,
    esPropia: propias.has(r.marca),
    esCompetidorClave: competidores.has(r.marca),
  }));
}

// ---------------- IMPORTACIONES ----------------

export interface ImportacionInfo {
  periodo: string;
  archivo: string;
  anioActual: number;
  anioAnterior: number;
}

export function getImportacionInfo(): ImportacionInfo | null {
  const db = getDb();
  const informe = db
    .prepare(
      "SELECT periodo, archivo FROM informes WHERE tipo = 'importacion' ORDER BY periodo DESC LIMIT 1"
    )
    .get() as { periodo: string; archivo: string } | undefined;
  if (!informe) return null;
  const row = db
    .prepare(
      "SELECT anio_actual, anio_anterior FROM importacion_tipo_acum WHERE informe_periodo = ? LIMIT 1"
    )
    .get(informe.periodo) as { anio_actual: number; anio_anterior: number } | undefined;
  if (!row) return null;
  return {
    periodo: informe.periodo,
    archivo: informe.archivo,
    anioActual: row.anio_actual,
    anioAnterior: row.anio_anterior,
  };
}

export interface ImportacionTipoItem {
  tipo: string;
  actual: number;
  anterior: number;
  variacion: number | null;
  participacion: number;
  /** false cuando "actual" sale del recorte mensual (Cuadro 3: solo livianos,
   * solo anio en curso) en vez del acumulado oficial de CADAM (Cuadro 2). */
  comparacionDisponible: boolean;
}

/**
 * Importacion por tipo.
 *
 * Cuando el rango pedido es el rango completo disponible, usa el Cuadro 2 de
 * CADAM: acumulado oficial, incluye livianos + pesados, y trae comparacion
 * real contra el anio anterior.
 *
 * Cuando el rango es un recorte (ej. Ene-Mar), usa el Cuadro 3 (mensual,
 * SOLO livianos, SOLO anio en curso — CADAM no publica el detalle mensual
 * del anio anterior en este informe): el total "actual" sí queda correcto
 * para ese recorte, pero no hay "anterior" ni pesados para comparar
 * (comparacionDisponible=false).
 */
export function getImportacionPorTipo(
  info: ImportacionInfo,
  rango: Rango,
  esRangoCompleto: boolean
): ImportacionTipoItem[] {
  const db = getDb();

  if (esRangoCompleto) {
    const rows = db
      .prepare(
        `SELECT tipo, unidades_actual, unidades_anterior
         FROM importacion_tipo_acum
         WHERE informe_periodo = ?`
      )
      .all(info.periodo) as { tipo: string; unidades_actual: number; unidades_anterior: number }[];

    const totalActual = rows.reduce((s, r) => s + r.unidades_actual, 0);

    return rows
      .map((r) => ({
        tipo: r.tipo,
        actual: r.unidades_actual,
        anterior: r.unidades_anterior,
        variacion:
          r.unidades_anterior > 0 ? (r.unidades_actual - r.unidades_anterior) / r.unidades_anterior : null,
        participacion: totalActual > 0 ? r.unidades_actual / totalActual : 0,
        comparacionDisponible: true,
      }))
      .sort((a, b) => b.actual - a.actual);
  }

  const rows = db
    .prepare(
      `SELECT tipo, SUM(unidades) as total
       FROM importacion_tipo_mensual
       WHERE informe_periodo = ? AND anio = ? AND mes BETWEEN ? AND ?
       GROUP BY tipo`
    )
    .all(info.periodo, info.anioActual, rango.desde, rango.hasta) as { tipo: string; total: number }[];

  const totalActual = rows.reduce((s, r) => s + r.total, 0);

  return rows
    .map((r) => ({
      tipo: r.tipo,
      actual: r.total,
      anterior: 0,
      variacion: null,
      participacion: totalActual > 0 ? r.total / totalActual : 0,
      comparacionDisponible: false,
    }))
    .sort((a, b) => b.actual - a.actual);
}

/**
 * Importacion de livianos por mes, SOLO anio en curso (Cuadro 3 de CADAM no
 * trae la serie mensual del anio anterior) — recortado al rango pedido.
 */
export function getImportacionEvolucionMensual(
  info: ImportacionInfo,
  rango: Rango
): { mes: number; mesLabel: string; unidades: number }[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT mes, SUM(unidades) as total
       FROM importacion_tipo_mensual
       WHERE informe_periodo = ? AND anio = ? AND mes BETWEEN ? AND ?
       GROUP BY mes
       ORDER BY mes`
    )
    .all(info.periodo, info.anioActual, rango.desde, rango.hasta) as { mes: number; total: number }[];

  const porMes = new Map<number, number>();
  for (let m = rango.desde; m <= rango.hasta; m++) porMes.set(m, 0);
  for (const r of rows) porMes.set(r.mes, r.total);

  return Array.from(porMes.entries()).map(([mes, unidades]) => ({
    mes,
    mesLabel: MESES[mes],
    unidades,
  }));
}

// ---------------- COMBUSTIBLE / TECNOLOGÍA ----------------

export interface CombustibleItem {
  combustible: string;
  actual: number;
  participacion: number;
}

/**
 * Matriculacion por combustible/tecnologia (Cuadro 19), SOLO anio en curso
 * -- CADAM no publica el detalle mensual del anio anterior en este cuadro.
 * Recortado al rango pedido.
 */
export function getMatriculacionCombustible(info: PeriodoInfo, rango: Rango): CombustibleItem[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT combustible, SUM(unidades) as total
       FROM matriculacion_combustible_mensual
       WHERE informe_periodo = ? AND anio = ? AND mes BETWEEN ? AND ?
       GROUP BY combustible`
    )
    .all(info.periodo, info.anioActual, rango.desde, rango.hasta) as {
    combustible: string;
    total: number;
  }[];

  const totalActual = rows.reduce((s, r) => s + r.total, 0);
  return rows
    .map((r) => ({
      combustible: r.combustible,
      actual: r.total,
      participacion: totalActual > 0 ? r.total / totalActual : 0,
    }))
    .sort((a, b) => b.actual - a.actual);
}

/**
 * Importacion por combustible/tecnologia (Cuadro 10A), SOLO livianos y SOLO
 * anio en curso (mismas limitaciones que el resto de los cuadros mensuales
 * de importacion). Recortado al rango pedido.
 */
export function getImportacionCombustible(info: ImportacionInfo, rango: Rango): CombustibleItem[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT combustible, SUM(unidades) as total
       FROM importacion_combustible_mensual
       WHERE informe_periodo = ? AND anio = ? AND mes BETWEEN ? AND ?
       GROUP BY combustible`
    )
    .all(info.periodo, info.anioActual, rango.desde, rango.hasta) as {
    combustible: string;
    total: number;
  }[];

  const totalActual = rows.reduce((s, r) => s + r.total, 0);
  return rows
    .map((r) => ({
      combustible: r.combustible,
      actual: r.total,
      participacion: totalActual > 0 ? r.total / totalActual : 0,
    }))
    .sort((a, b) => b.actual - a.actual);
}

// ---------------- KPIs ----------------

export interface KpiSummary {
  periodoInfo: PeriodoInfo;
  rango: Rango;
  matriculacionesYtdActual: number;
  matriculacionesYtdAnterior: number;
  varMatriculacionesYtd: number | null;
  marcaLider: RankingMarcaItem | null;
  segmentoLider: DistribucionTipoItem | null;
  participacionPropiaLivianos: number | null;
  unidadesPropiasLivianos: number;
  importacion: {
    info: ImportacionInfo;
    totalActual: number;
    totalAnterior: number;
    variacion: number | null;
    comparacionDisponible: boolean;
    incluyePesados: boolean;
    // livianos vs. livianos, siempre -- unica forma de que esto sea
    // comparable Y filtrable por rango a la vez (importacion no tiene
    // desagregado mensual de pesados, solo el acumulado completo del Cuadro 2)
    diferenciaVsMatriculacion: number;
    matriculacionLivianosRango: number;
    importacionLivianosRango: number;
  } | null;
}

export function getKpiSummary(rango?: Rango): KpiSummary | null {
  const info = getPeriodoInfo();
  if (!info) return null;
  const rangoEfectivo = rango ?? rangoCompleto(info);
  const esRangoCompleto = rangoEfectivo.desde === 1 && rangoEfectivo.hasta === info.mesMax;

  const tipos = getDistribucionTipo(info, rangoEfectivo);
  const marcas = getRankingMarcas(info, rangoEfectivo);

  const totalActual = tipos.reduce((s, t) => s + t.actual, 0);
  const totalAnterior = tipos.reduce((s, t) => s + t.anterior, 0);
  const propias = getMarcasPropiasSet();
  const unidadesPropias = marcas.filter((m) => propias.has(m.marca)).reduce((s, m) => s + m.actual, 0);
  const totalLivianos = marcas.reduce((s, m) => s + m.actual, 0);

  const importacionInfo = getImportacionInfo();
  let importacion: KpiSummary["importacion"] = null;
  if (importacionInfo) {
    const porTipo = getImportacionPorTipo(importacionInfo, rangoEfectivo, esRangoCompleto);
    const totalImportActual = porTipo.reduce((s, t) => s + t.actual, 0);
    const totalImportAnterior = porTipo.reduce((s, t) => s + t.anterior, 0);

    // Livianos vs. livianos en el MISMO rango elegido: matriculacion_marca ya
    // es livianos-only (totalLivianos), e importacion_tipo_mensual tambien
    // (Cuadro 3) -- a diferencia del acumulado de arriba, esto si es
    // consistente en cualquier rango, no solo el completo.
    const importacionLivianosRango = getDb()
      .prepare(
        `SELECT COALESCE(SUM(unidades), 0) as total
         FROM importacion_tipo_mensual
         WHERE informe_periodo = ? AND anio = ? AND mes BETWEEN ? AND ?`
      )
      .get(importacionInfo.periodo, importacionInfo.anioActual, rangoEfectivo.desde, rangoEfectivo.hasta) as {
      total: number;
    };

    importacion = {
      info: importacionInfo,
      totalActual: totalImportActual,
      totalAnterior: totalImportAnterior,
      variacion:
        esRangoCompleto && totalImportAnterior > 0
          ? (totalImportActual - totalImportAnterior) / totalImportAnterior
          : null,
      comparacionDisponible: esRangoCompleto,
      incluyePesados: esRangoCompleto,
      diferenciaVsMatriculacion: totalLivianos - importacionLivianosRango.total,
      matriculacionLivianosRango: totalLivianos,
      importacionLivianosRango: importacionLivianosRango.total,
    };
  }

  return {
    periodoInfo: info,
    rango: rangoEfectivo,
    matriculacionesYtdActual: totalActual,
    matriculacionesYtdAnterior: totalAnterior,
    varMatriculacionesYtd: totalAnterior > 0 ? (totalActual - totalAnterior) / totalAnterior : null,
    marcaLider: marcas[0] ?? null,
    segmentoLider: tipos[0] ?? null,
    participacionPropiaLivianos: totalLivianos > 0 ? unidadesPropias / totalLivianos : null,
    unidadesPropiasLivianos: unidadesPropias,
    importacion,
  };
}
