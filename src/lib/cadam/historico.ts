import { getDb } from "./db";
import type { Fuente } from "./mercado";

/**
 * Analisis sobre TODO el historico cargado, no solo el periodo filtrado.
 *
 * La base tiene 8 anios de importacion (2019-2026) y 5 de matriculacion
 * (2022-2026). Con esa profundidad se puede separar lo que es
 * estacionalidad de lo que es un cambio real, que es la diferencia entre
 * "mayo fue un mes flojo" y "mayo fue flojo PARA SER un mayo".
 *
 * HONESTIDAD ESTADISTICA
 * ----------------------
 * Cada calculo declara cuantos datos necesita y se abstiene si no los
 * tiene, en vez de devolver un numero que parece preciso:
 *
 *   - Estacionalidad: minimo 2 anios COMPLETOS; se marca `confiable`
 *     solo con 3 o mas.
 *   - Anomalias: minimo 24 meses de serie.
 *   - Tendencia: minimo 6 meses.
 *
 * Los anios parciales nunca entran al calculo del patron estacional: si
 * 2026 solo llega a junio, incluirlo hundiria el indice del segundo
 * semestre.
 */

export interface Punto {
  anio: number;
  mes: number;
  unidades: number;
}

export interface Corte {
  marca?: string;
  segmento?: string;
  tecnologia?: string;
  empresa?: string;
}

const MIN_ANIOS_ESTACIONALIDAD = 2;
const MIN_ANIOS_CONFIABLE = 3;
const MIN_MESES_ANOMALIA = 24;
const MIN_MESES_TENDENCIA = 6;

// ------------------------------------------------------------- lectura

function vista(fuente: Fuente) {
  return fuente === "matriculacion" ? "v_matriculacion" : "v_importacion";
}

/** Serie mensual completa. Solo meses CON dato: los huecos no se rellenan. */
export function getSerieHistorica(fuente: Fuente, corte: Corte = {}): Punto[] {
  const db = getDb();
  const cond: string[] = [];
  const args: string[] = [];
  for (const [k, v] of Object.entries(corte)) {
    if (!v) continue;
    if (fuente === "importacion" && (k === "tecnologia" || k === "empresa")) continue;
    cond.push(`${k} = ?`);
    args.push(v);
  }
  return db
    .prepare(
      `SELECT anio, mes, SUM(unidades) unidades FROM ${vista(fuente)}
       ${cond.length ? "WHERE " + cond.join(" AND ") : ""}
       GROUP BY anio, mes ORDER BY anio, mes`
    )
    .all(...args) as Punto[];
}

/** Anios con los 12 meses presentes. Son los unicos que sirven para
 *  calcular el patron estacional. */
export function aniosCompletos(puntos: Punto[]): number[] {
  const porAnio = new Map<number, Set<number>>();
  for (const p of puntos) {
    if (!porAnio.has(p.anio)) porAnio.set(p.anio, new Set());
    porAnio.get(p.anio)!.add(p.mes);
  }
  return [...porAnio.entries()]
    .filter(([, meses]) => meses.size === 12)
    .map(([a]) => a)
    .sort();
}

// ------------------------------------------------------- estacionalidad

export interface Estacionalidad {
  /** 12 posiciones. 1.0 = un mes promedio. 1.2 = 20% por encima. */
  indice: number[];
  aniosUsados: number[];
  confiable: boolean;
  mesMasFuerte: number;
  mesMasDebil: number;
}

/**
 * Patron estacional: cuanto se desvia cada mes del promedio del anio.
 * Se calcula SOLO sobre anios completos.
 */
export function calcularEstacionalidad(puntos: Punto[]): Estacionalidad | null {
  const completos = aniosCompletos(puntos);
  if (completos.length < MIN_ANIOS_ESTACIONALIDAD) return null;

  const usables = puntos.filter((p) => completos.includes(p.anio));
  // Indice de cada mes DENTRO de su anio, para que un anio de mucho
  // volumen no pese mas que otro en el patron.
  const porAnio = new Map<number, Punto[]>();
  for (const p of usables) {
    porAnio.set(p.anio, [...(porAnio.get(p.anio) ?? []), p]);
  }
  const acumulado: number[][] = Array.from({ length: 12 }, () => []);
  for (const [, ps] of porAnio) {
    const promedio = ps.reduce((s, p) => s + p.unidades, 0) / 12;
    if (!promedio) continue;
    for (const p of ps) acumulado[p.mes - 1].push(p.unidades / promedio);
  }
  const indice = acumulado.map((vs) =>
    vs.length ? vs.reduce((s, v) => s + v, 0) / vs.length : 1
  );

  let masFuerte = 0, masDebil = 0;
  indice.forEach((v, i) => {
    if (v > indice[masFuerte]) masFuerte = i;
    if (v < indice[masDebil]) masDebil = i;
  });

  return {
    indice,
    aniosUsados: completos,
    confiable: completos.length >= MIN_ANIOS_CONFIABLE,
    mesMasFuerte: masFuerte + 1,
    mesMasDebil: masDebil + 1,
  };
}

/** Quita el efecto estacional para poder comparar meses entre si. */
export function desestacionalizar(puntos: Punto[], est: Estacionalidad | null): Punto[] {
  if (!est) return puntos;
  return puntos.map((p) => {
    const idx = est.indice[p.mes - 1] || 1;
    return { ...p, unidades: p.unidades / idx };
  });
}

// ------------------------------------------------------------ tendencia

export interface Tendencia {
  /** Meses seguidos subiendo (+) o bajando (-), ya desestacionalizado. */
  rachaMeses: number;
  /** Unidades por mes que suma o resta la recta de los ultimos 12 meses. */
  pendienteMensual: number | null;
  /** Ultimos 3 meses vs los 3 anteriores, desestacionalizado. */
  aceleracion: number | null;
  mesesDisponibles: number;
}

export function calcularTendencia(
  puntos: Punto[], est: Estacionalidad | null
): Tendencia | null {
  if (puntos.length < MIN_MESES_TENDENCIA) return null;
  const des = desestacionalizar(puntos, est);

  // Racha: se corta en el primer mes que cambia de direccion.
  let racha = 0;
  for (let i = des.length - 1; i > 0; i--) {
    const sube = des[i].unidades > des[i - 1].unidades;
    if (racha === 0) racha = sube ? 1 : -1;
    else if ((racha > 0) === sube) racha += sube ? 1 : -1;
    else break;
  }

  // Regresion lineal simple sobre los ultimos 12 meses.
  const ult = des.slice(-12);
  let pendiente: number | null = null;
  if (ult.length >= 6) {
    const n = ult.length;
    const sx = (n * (n - 1)) / 2;
    const sy = ult.reduce((s, p) => s + p.unidades, 0);
    const sxy = ult.reduce((s, p, i) => s + i * p.unidades, 0);
    const sxx = ult.reduce((s, _p, i) => s + i * i, 0);
    const den = n * sxx - sx * sx;
    pendiente = den ? (n * sxy - sx * sy) / den : null;
  }

  let aceleracion: number | null = null;
  if (des.length >= 6) {
    const a = des.slice(-3).reduce((s, p) => s + p.unidades, 0);
    const b = des.slice(-6, -3).reduce((s, p) => s + p.unidades, 0);
    aceleracion = b ? (a - b) / b : null;
  }

  return {
    rachaMeses: racha,
    pendienteMensual: pendiente,
    aceleracion,
    mesesDisponibles: puntos.length,
  };
}

// ------------------------------------------------------------ anomalias

export interface Anomalia {
  anio: number;
  mes: number;
  unidades: number;
  /** Lo que se esperaba segun el nivel reciente y la estacionalidad. */
  esperado: number;
  /** Desvios estandar respecto de lo esperado. */
  sigmas: number;
}

/**
 * Meses que se salen del propio patron historico de la serie.
 *
 * No es "el mes mas alto": es el mes que mas se desvia de lo que cabia
 * esperar, ya descontada la estacionalidad. Un mayo alto no es anomalo
 * si mayo suele ser alto.
 */
export function detectarAnomalias(
  puntos: Punto[], est: Estacionalidad | null, umbralSigmas = 2
): Anomalia[] {
  if (puntos.length < MIN_MESES_ANOMALIA) return [];
  const des = desestacionalizar(puntos, est);
  const valores = des.map((p) => p.unidades);
  const media = valores.reduce((s, v) => s + v, 0) / valores.length;
  const sd = Math.sqrt(
    valores.reduce((s, v) => s + (v - media) ** 2, 0) / valores.length
  );
  if (!sd) return [];

  const out: Anomalia[] = [];
  for (let i = 0; i < des.length; i++) {
    const z = (des[i].unidades - media) / sd;
    if (Math.abs(z) < umbralSigmas) continue;
    const idx = est ? est.indice[des[i].mes - 1] || 1 : 1;
    out.push({
      anio: puntos[i].anio,
      mes: puntos[i].mes,
      unidades: puntos[i].unidades,
      esperado: Math.round(media * idx),
      sigmas: z,
    });
  }
  return out.sort((a, b) => Math.abs(b.sigmas) - Math.abs(a.sigmas));
}

// ----------------------------------------------------------- proyeccion

export interface Proyeccion {
  cierreProyectado: number;
  acumuladoReal: number;
  mesesFaltantes: number;
  /** Sin estacionalidad el numero es mucho menos confiable. */
  usaEstacionalidad: boolean;
  confiable: boolean;
}

/**
 * Proyeccion de cierre de anio APLICANDO el patron estacional, que es
 * la diferencia entre proyectar bien y proyectar mal en un mercado con
 * la estacionalidad del paraguayo.
 */
export function proyectarCierre(
  puntos: Punto[], anio: number, est: Estacionalidad | null
): Proyeccion | null {
  const delAnio = puntos.filter((p) => p.anio === anio);
  if (!delAnio.length || delAnio.length >= 12) return null;

  const acumulado = delAnio.reduce((s, p) => s + p.unidades, 0);
  const mesesConDato = new Set(delAnio.map((p) => p.mes));
  const faltantes = Array.from({ length: 12 }, (_, i) => i + 1)
    .filter((m) => !mesesConDato.has(m));

  if (est) {
    // Nivel implicito del anio = promedio desestacionalizado de lo que va.
    const nivel = delAnio.reduce(
      (s, p) => s + p.unidades / (est.indice[p.mes - 1] || 1), 0
    ) / delAnio.length;
    const restante = faltantes.reduce((s, m) => s + nivel * (est.indice[m - 1] || 1), 0);
    return {
      cierreProyectado: Math.round(acumulado + restante),
      acumuladoReal: acumulado,
      mesesFaltantes: faltantes.length,
      usaEstacionalidad: true,
      confiable: est.confiable && delAnio.length >= 3,
    };
  }

  const promedio = acumulado / delAnio.length;
  return {
    cierreProyectado: Math.round(acumulado + promedio * faltantes.length),
    acumuladoReal: acumulado,
    mesesFaltantes: faltantes.length,
    usaEstacionalidad: false,
    confiable: false,
  };
}

// ------------------------------------------------- ranking de trayectoria

export interface Trayectoria {
  valor: string;
  unidadesUlt12: number;
  unidades12Previos: number;
  variacion: number | null;
  aceleracion: number | null;
  rachaMeses: number;
}

/**
 * Compara los ultimos 12 meses contra los 12 anteriores, por marca o por
 * la dimension que se pida. Es la lectura de mediano plazo: no depende
 * de donde caiga el corte del anio calendario.
 */
export function getTrayectorias(
  fuente: Fuente,
  dimension: "marca" | "segmento" | "tecnologia" | "empresa",
  minUnidades = 100
): Trayectoria[] {
  const db = getDb();
  if (fuente === "importacion" && (dimension === "tecnologia" || dimension === "empresa")) {
    return [];
  }
  const ultimo = db
    .prepare(`SELECT anio, mes FROM ${vista(fuente)} ORDER BY anio DESC, mes DESC LIMIT 1`)
    .get() as { anio: number; mes: number } | undefined;
  if (!ultimo) return [];

  // Indice absoluto de mes para poder cortar ventanas de 12 sin pelearse
  // con los cambios de anio.
  const fin = ultimo.anio * 12 + ultimo.mes;
  const filas = db
    .prepare(
      `SELECT ${dimension} valor, anio, mes, SUM(unidades) unidades
       FROM ${vista(fuente)} GROUP BY ${dimension}, anio, mes`
    )
    .all() as { valor: string; anio: number; mes: number; unidades: number }[];

  const acc = new Map<string, { ult12: number; prev12: number; puntos: Punto[] }>();
  for (const f of filas) {
    const idx = f.anio * 12 + f.mes;
    const e = acc.get(f.valor) ?? { ult12: 0, prev12: 0, puntos: [] };
    if (idx > fin - 12) e.ult12 += f.unidades;
    else if (idx > fin - 24) e.prev12 += f.unidades;
    e.puntos.push({ anio: f.anio, mes: f.mes, unidades: f.unidades });
    acc.set(f.valor, e);
  }

  const out: Trayectoria[] = [];
  for (const [valor, e] of acc) {
    if (e.ult12 < minUnidades && e.prev12 < minUnidades) continue;
    e.puntos.sort((a, b) => a.anio - b.anio || a.mes - b.mes);
    const t = calcularTendencia(e.puntos, calcularEstacionalidad(e.puntos));
    out.push({
      valor,
      unidadesUlt12: e.ult12,
      unidades12Previos: e.prev12,
      variacion: e.prev12 ? (e.ult12 - e.prev12) / e.prev12 : null,
      aceleracion: t?.aceleracion ?? null,
      rachaMeses: t?.rachaMeses ?? 0,
    });
  }
  return out.sort((a, b) => b.unidadesUlt12 - a.unidadesUlt12);
}
