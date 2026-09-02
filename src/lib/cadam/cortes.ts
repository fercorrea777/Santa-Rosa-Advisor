import { getDb } from "./db";
import type { FilaDimension, PuntoMensual, RangoMeses } from "./mercado";

/**
 * Los dos cortes de matriculacion que CADAM manda en archivos APARTE:
 * combustible (`matriculacion_movilidad`) y localidad
 * (`matriculacion_localidad`).
 *
 * Van juntos porque son la misma consulta con otra columna: matriculacion
 * agregada por una dimension, con el periodo anterior al lado. Lo que
 * cambia entre uno y otro es la tabla, la columna y la cobertura.
 *
 * NO SE SUMAN A `matriculacion` NI ENTRE SI. Son la MISMA matriculacion
 * cortada de otra forma; sumarlas duplicaria el mercado. Verificado mes a
 * mes contra la fuente principal (snapshot 2026-08): los tres dan
 * identico en cada mes de 2025 y 2026.
 *
 * COMBUSTIBLE NO ES TECNOLOGIA. `movilidad` clasifica lo que el auto
 * quema (nafta/gasoil/flex/hibrido/electrico); `matriculacion.tecnologia`
 * clasifica el tren motriz (ICE/MHEV/HEV/PHEV/REEV/EV). Un hibrido nafta
 * es 'HIBRIDO' aca y 'HEV' alla. Son ejes distintos, no dos nombres de lo
 * mismo, y no hay que cruzarlos como si uno explicara al otro.
 */

// Tabla y columna salen SIEMPRE de este mapa congelado, nunca de la URL:
// se interpolan en el SQL y un valor de usuario ahi seria inyeccion.
const CORTES = {
  combustible: { tabla: "matriculacion_movilidad", columna: "movilidad" },
  localidad: { tabla: "matriculacion_localidad", columna: "localidad" },
} as const;

export type Corte = keyof typeof CORTES;

// El pipeline crea vistas `v_*` para las tablas viejas pero no para estas
// dos, asi que el filtro de snapshot va a mano. Es literalmente lo que
// hacen esas vistas: quedarse con el ultimo informe cargado. Sin esto se
// suman los snapshots entre si y 2025 sale al doble.
const SNAP = "(SELECT periodo FROM v_snapshot_actual)";

/** Estas dos tablas NO existen en bases anteriores a la ingesta de
 *  2026-08, asi que preguntar por su contenido sin esto tira error. */
export function hayCorte(c: Corte): boolean {
  const { tabla } = CORTES[c];
  const existe = getDb()
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
    .get(tabla);
  if (!existe) return false;
  const n = getDb()
    .prepare(`SELECT COUNT(*) n FROM ${tabla} WHERE snapshot = ${SNAP}`)
    .get() as { n: number };
  return n.n > 0;
}

export interface CoberturaCorte {
  anios: number[];
  ultimo: { anio: number; mes: number } | null;
}

export function getCoberturaCorte(c: Corte): CoberturaCorte {
  if (!hayCorte(c)) return { anios: [], ultimo: null };
  const { tabla } = CORTES[c];
  const db = getDb();
  const anios = (
    db
      .prepare(`SELECT DISTINCT anio FROM ${tabla} WHERE snapshot = ${SNAP} ORDER BY anio`)
      .all() as { anio: number }[]
  ).map((r) => r.anio);
  const ultimo = db
    .prepare(
      `SELECT anio, mes FROM ${tabla} WHERE snapshot = ${SNAP}
       ORDER BY anio DESC, mes DESC LIMIT 1`
    )
    .get() as { anio: number; mes: number } | undefined;
  return { anios, ultimo: ultimo ?? null };
}

/** Suma del corte en una ventana de meses. */
function totalEn(c: Corte, r: RangoMeses): number {
  const { tabla } = CORTES[c];
  const row = getDb()
    .prepare(
      `SELECT COALESCE(SUM(unidades), 0) u FROM ${tabla}
       WHERE snapshot = ${SNAP} AND anio = ? AND mes BETWEEN ? AND ?`
    )
    .get(r.anio, r.mesDesde, r.mesHasta) as { u: number };
  return row.u;
}

export interface ResultadoCorte {
  filas: FilaDimension[];
  total: number;
  totalAnterior: number;
  /** false = el año anterior no tiene esa ventana cargada. Con esto en
   *  false toda variacion y todo delta vienen en null, no en 0. */
  baseDisponible: boolean;
}

/**
 * El corte del periodo, con el MISMO rango de meses del año anterior al
 * lado.
 *
 * La ventana comparable no es un detalle: 2026 llega hasta julio y 2025
 * esta completo, asi que comparar "2026" contra "2025" a secas restaria
 * siete meses contra doce. Todo lo que devuelve esta funcion compara
 * ene–jul contra ene–jul.
 */
export function getPorCorte(c: Corte, r: RangoMeses): ResultadoCorte {
  if (!hayCorte(c)) {
    return { filas: [], total: 0, totalAnterior: 0, baseDisponible: false };
  }
  const { tabla, columna } = CORTES[c];
  const db = getDb();

  const q = (anio: number) =>
    db
      .prepare(
        `SELECT ${columna} valor, SUM(unidades) unidades FROM ${tabla}
         WHERE snapshot = ${SNAP} AND anio = ? AND mes BETWEEN ? AND ?
         GROUP BY ${columna} HAVING unidades > 0
         ORDER BY unidades DESC`
      )
      .all(anio, r.mesDesde, r.mesHasta) as { valor: string; unidades: number }[];

  const actual = q(r.anio);
  const anterior = q(r.anio - 1);
  const previo = new Map(anterior.map((f) => [f.valor, f.unidades]));

  const total = actual.reduce((s, f) => s + f.unidades, 0);
  const totalAnterior = anterior.reduce((s, f) => s + f.unidades, 0);
  const baseDisponible = totalAnterior > 0;

  const filas: FilaDimension[] = actual.map((f) => {
    const antes = previo.get(f.valor) ?? 0;
    const participacion = total ? f.unidades / total : 0;
    const participacionAnterior = totalAnterior ? antes / totalAnterior : 0;
    return {
      valor: f.valor,
      unidades: f.unidades,
      participacion,
      unidadesAnterior: antes,
      // Sin base, o entrante (no existia antes): null, no un +∞ disfrazado
      // de porcentaje gigante.
      variacion: !baseDisponible || antes === 0 ? null : f.unidades / antes - 1,
      deltaParticipacion: baseDisponible
        ? participacion - participacionAnterior
        : null,
    };
  });

  return { filas, total, totalAnterior, baseDisponible };
}

/** Serie mensual del corte. `valor` acota a una sola categoria (una
 *  localidad, un combustible); sin el, es el total del corte.
 *
 *  Los meses sin dato NO vuelven como cero: no vuelven. Quien dibuja
 *  decide como mostrar el hueco. */
export function getSerieCorte(
  c: Corte,
  anios: number[],
  valor?: string
): PuntoMensual[] {
  if (!hayCorte(c) || !anios.length) return [];
  const { tabla, columna } = CORTES[c];
  const marcas = anios.map(() => "?").join(",");
  const args: (string | number)[] = [...anios];
  let extra = "";
  if (valor) {
    extra = ` AND ${columna} = ?`;
    args.push(valor);
  }
  return getDb()
    .prepare(
      `SELECT anio, mes, SUM(unidades) unidades FROM ${tabla}
       WHERE snapshot = ${SNAP} AND anio IN (${marcas})${extra}
       GROUP BY anio, mes HAVING unidades > 0
       ORDER BY anio, mes`
    )
    .all(...args) as PuntoMensual[];
}

/**
 * Evolucion del corte año contra año, SIEMPRE sobre la misma ventana de
 * meses. Sirve para el apilado: cada año es una barra y cada categoria
 * una capa.
 *
 * Se pide la ventana explicita en vez de tomar el año completo justamente
 * porque el ultimo año esta a medias: apilar doce meses al lado de siete
 * dibuja una caida que no existe.
 */
export function getCorteHistorico(
  c: Corte,
  anios: number[],
  mesDesde: number,
  mesHasta: number
): { anio: number; porValor: Record<string, number>; total: number }[] {
  if (!hayCorte(c) || !anios.length) return [];
  const { tabla, columna } = CORTES[c];
  const marcas = anios.map(() => "?").join(",");
  const filas = getDb()
    .prepare(
      `SELECT anio, ${columna} valor, SUM(unidades) unidades FROM ${tabla}
       WHERE snapshot = ${SNAP} AND anio IN (${marcas}) AND mes BETWEEN ? AND ?
       GROUP BY anio, ${columna} HAVING unidades > 0`
    )
    .all(...anios, mesDesde, mesHasta) as {
    anio: number;
    valor: string;
    unidades: number;
  }[];

  return anios.map((anio) => {
    const porValor: Record<string, number> = {};
    let total = 0;
    for (const f of filas) {
      if (f.anio !== anio) continue;
      porValor[f.valor] = (porValor[f.valor] ?? 0) + f.unidades;
      total += f.unidades;
    }
    return { anio, porValor, total };
  });
}

// ------------------------------------------------------- solo combustible

export interface FilaMarcaCombustible {
  marca: string;
  unidades: number;
  /** Sobre el total de ESE combustible, no sobre el mercado entero. */
  participacion: number;
}

/**
 * Quien lidera un combustible. Solo existe para combustible: el archivo de
 * localidad no trae marca ni modelo, llega hasta el municipio.
 */
export function getMarcasPorCombustible(
  combustible: string,
  r: RangoMeses,
  tope = 10
): FilaMarcaCombustible[] {
  if (!hayCorte("combustible")) return [];
  const filas = getDb()
    .prepare(
      `SELECT marca, SUM(unidades) unidades FROM matriculacion_movilidad
       WHERE snapshot = ${SNAP} AND movilidad = ?
         AND anio = ? AND mes BETWEEN ? AND ?
       GROUP BY marca HAVING unidades > 0
       ORDER BY unidades DESC`
    )
    .all(combustible, r.anio, r.mesDesde, r.mesHasta) as {
    marca: string;
    unidades: number;
  }[];
  const total = filas.reduce((s, f) => s + f.unidades, 0);
  return filas.slice(0, tope).map((f) => ({
    marca: f.marca,
    unidades: f.unidades,
    participacion: total ? f.unidades / total : 0,
  }));
}

// ---------------------------------------------------------- solo localidad

/** La capital, tratada aparte en la vista de concentracion. Es la unica
 *  categoria con nombre propio en todo el modulo: se reparte 8 de cada 10
 *  registros del pais y esconderla dentro de un "top N" borra la unica
 *  historia que cuenta este corte. */
export const CAPITAL = "ASUNCION";

export interface Concentracion {
  anio: number;
  capital: number;
  interior: number;
  total: number;
  /** Share de la capital sobre el total de ese año, misma ventana de meses. */
  pctCapital: number;
  /** Cuantas localidades registraron al menos una unidad. */
  localidades: number;
}

export function getConcentracion(
  anios: number[],
  mesDesde: number,
  mesHasta: number
): Concentracion[] {
  return getCorteHistorico("localidad", anios, mesDesde, mesHasta).map((a) => {
    const capital = a.porValor[CAPITAL] ?? 0;
    return {
      anio: a.anio,
      capital,
      interior: a.total - capital,
      total: a.total,
      pctCapital: a.total ? capital / a.total : 0,
      localidades: Object.keys(a.porValor).length,
    };
  });
}

/** Suma del corte en la ventana pedida. Se exporta para los KPIs, que
 *  necesitan el total sin recorrer todas las categorias. */
export function getTotalCorte(c: Corte, r: RangoMeses): number {
  return hayCorte(c) ? totalEn(c, r) : 0;
}
