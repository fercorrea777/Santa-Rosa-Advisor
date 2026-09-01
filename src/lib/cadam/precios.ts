import { getDb } from "@/lib/cadam/db";
import { getMarcasPropiasSet } from "@/lib/cadam/config";
import type { Filtro } from "@/lib/cadam/mercado";

/**
 * Lectura de la lista de precios propia (tabla `precio_modelo`, la carga
 * CADAM/scripts/ingest_precios.py).
 *
 * ALCANCE: es la lista PROPIA, o sea que solo cubre las marcas del grupo.
 * No hay precios de competencia en CADAM — ese dato es externo. Cualquier
 * vista que use esto compara la gama propia contra si misma, nunca contra
 * el mercado.
 */

export interface ModeloConPrecio {
  marca: string;
  modelo: string;
  /** Unidades matriculadas en el periodo filtrado. */
  unidades: number;
  precio: number;
  moneda: string;
  /** Periodo de la lista de la que salio el precio (AAAA-MM). Puede no ser
   *  el periodo filtrado: se usa la lista mas reciente que no lo supere. */
  periodoPrecio: string;
}

/** true si ya se cargo alguna lista. La tabla NO existe hasta la primera
 *  ingesta, asi que preguntar por su contenido sin esto tira error. */
export function hayPrecios(): boolean {
  const r = getDb()
    .prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='precio_modelo'`
    )
    .get();
  if (!r) return false;
  const n = getDb()
    .prepare(`SELECT COUNT(*) n FROM precio_modelo`)
    .get() as { n: number };
  return n.n > 0;
}

/** Periodos de lista cargados, del mas nuevo al mas viejo. */
export function getPeriodosPrecio(): string[] {
  if (!hayPrecios()) return [];
  return (
    getDb()
      .prepare(`SELECT DISTINCT periodo FROM precio_modelo ORDER BY periodo DESC`)
      .all() as { periodo: string }[]
  ).map((r) => r.periodo);
}

/**
 * Modelos de marcas propias con su precio y sus unidades del periodo.
 *
 * El precio sale de la lista mas reciente que no supere el periodo
 * filtrado: si se mira junio y la unica lista cargada es de agosto, NO se
 * usa esa — seria anacronico, mostrando el precio de hoy junto a las
 * unidades de hace dos meses. Sin lista aplicable el modelo no aparece.
 */
export function getGamaPropiaConPrecio(f: Filtro): ModeloConPrecio[] {
  if (!hayPrecios()) return [];
  const propias = [...getMarcasPropiasSet()];
  if (!propias.length) return [];

  // El periodo tope es el ultimo mes del rango filtrado.
  const tope = `${f.anio}-${String(f.mesHasta).padStart(2, "0")}`;
  const marcasIn = propias.map(() => "?").join(",");

  const filas = getDb()
    .prepare(
      `WITH ventas AS (
         SELECT marca, modelo_base modelo, SUM(unidades) unidades
         FROM v_matriculacion
         WHERE anio = ? AND mes BETWEEN ? AND ? AND marca IN (${marcasIn})
         GROUP BY marca, modelo_base
         HAVING unidades > 0
       ),
       lista AS (
         -- Una sola fila por marca+modelo: la de la lista mas reciente que
         -- no supere el tope. El modelo puede estar en varias listas.
         SELECT marca, modelo, precio, moneda, periodo,
                ROW_NUMBER() OVER (
                  PARTITION BY marca, modelo ORDER BY periodo DESC
                ) rn
         FROM precio_modelo
         WHERE periodo <= ? AND version = ''
       )
       SELECT v.marca, v.modelo, v.unidades, l.precio, l.moneda,
              l.periodo periodoPrecio
       FROM ventas v
       JOIN lista l ON l.marca = v.marca AND l.modelo = v.modelo AND l.rn = 1
       ORDER BY v.unidades DESC`
    )
    .all(f.anio, f.mesDesde, f.mesHasta, ...propias, tope) as ModeloConPrecio[];

  return filas;
}

/** Modelos propios con ventas en el periodo pero SIN precio en ninguna lista
 *  aplicable. Se listan aparte en vez de desaparecer: un modelo que vende y
 *  no esta en la lista es un dato que falta, no un modelo que no existe. */
export function getGamaPropiaSinPrecio(f: Filtro): { marca: string; modelo: string; unidades: number }[] {
  const propias = [...getMarcasPropiasSet()];
  if (!propias.length) return [];
  const marcasIn = propias.map(() => "?").join(",");

  if (!hayPrecios()) {
    return getDb()
      .prepare(
        `SELECT marca, modelo_base modelo, SUM(unidades) unidades
         FROM v_matriculacion
         WHERE anio = ? AND mes BETWEEN ? AND ? AND marca IN (${marcasIn})
         GROUP BY marca, modelo_base HAVING unidades > 0
         ORDER BY unidades DESC`
      )
      .all(f.anio, f.mesDesde, f.mesHasta, ...propias) as {
      marca: string; modelo: string; unidades: number;
    }[];
  }

  const tope = `${f.anio}-${String(f.mesHasta).padStart(2, "0")}`;
  return getDb()
    .prepare(
      `SELECT v.marca, v.modelo, v.unidades FROM (
         SELECT marca, modelo_base modelo, SUM(unidades) unidades
         FROM v_matriculacion
         WHERE anio = ? AND mes BETWEEN ? AND ? AND marca IN (${marcasIn})
         GROUP BY marca, modelo_base HAVING unidades > 0
       ) v
       WHERE NOT EXISTS (
         SELECT 1 FROM precio_modelo p
         WHERE p.marca = v.marca AND p.modelo = v.modelo
           AND p.periodo <= ? AND p.version = ''
       )
       ORDER BY v.unidades DESC`
    )
    .all(f.anio, f.mesDesde, f.mesHasta, ...propias, tope) as {
    marca: string; modelo: string; unidades: number;
  }[];
}
