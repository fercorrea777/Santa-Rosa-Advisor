import { getDb } from "./db";
import {
  armarRanking, totalUnidades, variacion,
  type FilaDimension, type FilaRanking, type Filtro, type PuntoMensual, type RangoMeses,
} from "./mercado";

/**
 * Tecnología del lado de IMPORTACIÓN.
 *
 * La base de importación de CADAM no dice si el vehículo es híbrido o
 * eléctrico. Lo que sí manda CADAM es "import nev.xlsx": los vehículos de
 * energía nueva importados, por marca, modelo y mes, con su tecnología
 * (EV, HEV, PHEV), desde 2024. Vive en `importacion_nev` y es un
 * SUBCONJUNTO de `importacion`: cada unidad NEV también está contada en la
 * base general. Por eso las dos reglas de esta pantalla:
 *
 *   1. NEV nunca se SUMA a la importación total (duplicaría).
 *   2. Lo que no es NEV se obtiene por RESTA: total importado − NEV. Es
 *      combustión pura más los MHEV, que el archivo NEV no distingue, y se
 *      rotula así — "por diferencia" — para que nadie lo lea como un dato
 *      que CADAM publicó.
 *
 * Pedido de Fernando (15/09/2026): "que se pueda ver importaciones
 * también" en Combustibles y tecnologías. Antes la pantalla era solo
 * matriculación.
 */

const VISTA = "v_importacion_nev";

/** Rótulo del resto: lo que no está en el archivo NEV. */
export const RESTO_NEV = "ICE+MHEV (por diferencia)";

export interface CoberturaNev {
  anios: number[];
  ultimo: { anio: number; mes: number } | null;
}

export function getCoberturaNev(): CoberturaNev {
  const db = getDb();
  const anios = (
    db.prepare(`SELECT DISTINCT anio FROM ${VISTA} ORDER BY anio`).all() as { anio: number }[]
  ).map((r) => r.anio);
  const ultimo = db
    .prepare(`SELECT anio, mes FROM ${VISTA} ORDER BY anio DESC, mes DESC LIMIT 1`)
    .get() as { anio: number; mes: number } | undefined;
  return { anios, ultimo: ultimo ?? null };
}

/**
 * El archivo NEV suele llegar un mes DESPUÉS que el informe de importación
 * (hoy: importación hasta agosto, NEV hasta julio). Todo lo que compare
 * NEV contra el total tiene que usar la misma ventana, si no "el resto por
 * diferencia" se come un mes entero de NEV que todavía no llegó. Esto
 * recorta el filtro al último mes NEV; la pantalla avisa cuando pasa.
 */
export function recortarANev<T extends RangoMeses>(f: T): T & { recortado: boolean } {
  const ultimo = getCoberturaNev().ultimo;
  if (ultimo && f.anio === ultimo.anio && f.mesHasta > ultimo.mes) {
    return { ...f, mesHasta: Math.max(f.mesDesde, ultimo.mes), recortado: true };
  }
  return { ...f, recortado: false };
}

function where(f: Partial<Filtro> & RangoMeses) {
  const cond = ["anio = ?", "mes BETWEEN ? AND ?"];
  const args: (string | number)[] = [f.anio, f.mesDesde, f.mesHasta];
  if (f.tecnologia) {
    cond.push("tecnologia = ?");
    args.push(f.tecnologia);
  }
  if (f.marca) {
    cond.push("marca = ?");
    args.push(f.marca);
  }
  if (f.modelo) {
    cond.push("modelo = ?");
    args.push(f.modelo);
  }
  return { sql: cond.join(" AND "), args };
}

function totalNev(f: Partial<Filtro> & RangoMeses): number {
  const w = where(f);
  const r = getDb()
    .prepare(`SELECT COALESCE(SUM(unidades), 0) u FROM ${VISTA} WHERE ${w.sql}`)
    .get(...w.args) as { u: number };
  return r.u;
}

function hayNev(anio: number, mesDesde: number, mesHasta: number): boolean {
  return (
    getDb()
      .prepare(`SELECT 1 FROM ${VISTA} WHERE anio = ? AND mes BETWEEN ? AND ? LIMIT 1`)
      .get(anio, mesDesde, mesHasta) !== undefined
  );
}

/**
 * El corte por tecnología de la importación del período: EV, HEV y PHEV
 * del archivo NEV, y el resto por diferencia contra la base general. La
 * participación es sobre el total importado (el mismo denominador que usa
 * el resto de la app), y la comparación es contra la misma ventana de
 * meses del año anterior.
 *
 * `f.marca` y `f.segmento` acotan el total; el archivo NEV no trae
 * segmento, así que con segmento puesto el resto por diferencia NO se
 * puede calcular y las filas NEV vienen solas (participación sobre el
 * total NEV en ese caso no tendría sentido: se deja sobre el total del
 * segmento, que sí existe, y el resto se omite).
 */
export function getTecnologiasImportacion(f: Filtro): FilaDimension[] {
  const fNev = { anio: f.anio, mesDesde: f.mesDesde, mesHasta: f.mesHasta, marca: f.marca };
  const q = (anio: number) =>
    (() => {
      const w = where({ ...fNev, anio });
      return getDb()
        .prepare(
          `SELECT tecnologia valor, SUM(unidades) unidades FROM ${VISTA}
           WHERE ${w.sql} GROUP BY tecnologia HAVING unidades > 0`
        )
        .all(...w.args) as { valor: string; unidades: number }[];
    })();

  // El total general sin el filtro de tecnología (que acá no aplica) y
  // sin importador ni versión: es el volumen contra el que se mide.
  const base: Filtro = { anio: f.anio, mesDesde: f.mesDesde, mesHasta: f.mesHasta, marca: f.marca, segmento: f.segmento };
  const total = totalUnidades("importacion", base);
  const totalAnt = totalUnidades("importacion", { ...base, anio: f.anio - 1 });
  const baseDisponible = hayNev(f.anio - 1, f.mesDesde, f.mesHasta) && totalAnt > 0;

  const actual = q(f.anio);
  const previo = new Map(q(f.anio - 1).map((r) => [r.valor, r.unidades]));
  const filas = actual.map((r) => ({ valor: r.valor, unidades: r.unidades, antes: previo.get(r.valor) ?? 0 }));

  if (!f.segmento) {
    const nev = filas.reduce((s, r) => s + r.unidades, 0);
    const nevAnt = [...previo.values()].reduce((s, u) => s + u, 0);
    const resto = Math.max(0, total - nev);
    const restoAnt = Math.max(0, totalAnt - nevAnt);
    if (resto > 0) filas.push({ valor: RESTO_NEV, unidades: resto, antes: restoAnt });
  }

  return filas
    .sort((a, b) => b.unidades - a.unidades)
    .map((r) => {
      const participacion = total ? r.unidades / total : 0;
      const participacionAnterior = totalAnt ? r.antes / totalAnt : 0;
      return {
        valor: r.valor,
        unidades: r.unidades,
        participacion,
        unidadesAnterior: r.antes,
        variacion: baseDisponible && r.antes ? variacion(r.unidades, r.antes) : null,
        deltaParticipacion: baseDisponible ? participacion - participacionAnterior : null,
      };
    });
}

/** Serie mensual de una tecnología NEV (o de todas, sin `tecnologia`). Los
 *  meses sin dato no vuelven. */
export function getSerieMensualNev(
  anios: number[],
  extra?: { tecnologia?: string; marca?: string }
): PuntoMensual[] {
  if (!anios.length) return [];
  const cond = [`anio IN (${anios.map(() => "?").join(",")})`];
  const args: (string | number)[] = [...anios];
  if (extra?.tecnologia) {
    cond.push("tecnologia = ?");
    args.push(extra.tecnologia);
  }
  if (extra?.marca) {
    cond.push("marca = ?");
    args.push(extra.marca);
  }
  return getDb()
    .prepare(
      `SELECT anio, mes, SUM(unidades) unidades FROM ${VISTA}
       WHERE ${cond.join(" AND ")} GROUP BY anio, mes ORDER BY anio, mes`
    )
    .all(...args) as PuntoMensual[];
}

/** Ranking de marcas dentro de una tecnología importada. La participación
 *  es sobre esa tecnología. */
export function getRankingMarcasNev(f: Filtro): FilaRanking[] {
  const db = getDb();
  const fNev = { anio: f.anio, mesDesde: f.mesDesde, mesHasta: f.mesHasta, tecnologia: f.tecnologia, marca: f.marca };
  const w = where(fNev);
  const actual = db
    .prepare(
      `SELECT marca clave, marca, SUM(unidades) unidades FROM ${VISTA}
       WHERE ${w.sql} GROUP BY marca HAVING unidades > 0 ORDER BY unidades DESC`
    )
    .all(...w.args) as { clave: string; marca: string; unidades: number }[];
  const wp = where({ ...fNev, anio: f.anio - 1 });
  const previo = db
    .prepare(
      `SELECT marca clave, SUM(unidades) unidades FROM ${VISTA}
       WHERE ${wp.sql} GROUP BY marca HAVING unidades > 0 ORDER BY unidades DESC`
    )
    .all(...wp.args) as { clave: string; unidades: number }[];
  const sinMarca = { ...fNev, marca: undefined };
  return armarRanking(
    actual,
    new Map(previo.map((r) => [r.clave, r.unidades])),
    new Map(previo.map((r, i) => [r.clave, i + 1])),
    hayNev(f.anio - 1, f.mesDesde, f.mesHasta),
    totalNev(sinMarca),
    totalNev({ ...sinMarca, anio: f.anio - 1 })
  );
}

/** Ranking de modelos dentro de una tecnología importada. Con `f.marca`
 *  la participación es sobre esa marca (la composición de su gama en la
 *  tecnología), igual que en matriculación. */
export function getRankingModelosNev(f: Filtro, limite = 100): FilaRanking[] {
  const db = getDb();
  const fNev = { anio: f.anio, mesDesde: f.mesDesde, mesHasta: f.mesHasta, tecnologia: f.tecnologia, marca: f.marca };
  const w = where(fNev);
  const actual = db
    .prepare(
      `SELECT marca || ' ' || modelo clave, marca, modelo, tecnologia, SUM(unidades) unidades
       FROM ${VISTA} WHERE ${w.sql}
       GROUP BY marca, modelo HAVING unidades > 0 ORDER BY unidades DESC LIMIT ?`
    )
    .all(...w.args, limite) as {
    clave: string; marca: string; modelo: string; tecnologia: string; unidades: number;
  }[];
  const wp = where({ ...fNev, anio: f.anio - 1 });
  const previo = db
    .prepare(
      `SELECT marca || ' ' || modelo clave, SUM(unidades) unidades FROM ${VISTA}
       WHERE ${wp.sql} GROUP BY marca, modelo HAVING unidades > 0 ORDER BY unidades DESC`
    )
    .all(...wp.args) as { clave: string; unidades: number }[];
  return armarRanking(
    actual,
    new Map(previo.map((r) => [r.clave, r.unidades])),
    new Map(previo.map((r, i) => [r.clave, i + 1])),
    hayNev(f.anio - 1, f.mesDesde, f.mesHasta),
    totalNev(fNev),
    totalNev({ ...fNev, anio: f.anio - 1 })
  );
}

/** Mix por año completo: eléctricos (EV), híbridos (HEV+PHEV) y el resto
 *  por diferencia contra la importación total del año. Solo los años que
 *  el archivo NEV cubre. */
export function getMixNevPorAnio(anios: number[]): Record<string, number>[] {
  const db = getDb();
  return anios.map((anio) => {
    const filas = db
      .prepare(`SELECT tecnologia, SUM(unidades) u FROM ${VISTA} WHERE anio = ? GROUP BY tecnologia`)
      .all(anio) as { tecnologia: string; u: number }[];
    const hibridos = filas.filter((r) => r.tecnologia !== "EV").reduce((s, r) => s + r.u, 0);
    const electricos = filas.filter((r) => r.tecnologia === "EV").reduce((s, r) => s + r.u, 0);
    // Misma ventana que el archivo NEV para ese año (ver recortarANev).
    const ventana = recortarANev({ anio, mesDesde: 1, mesHasta: 12 });
    const total = totalUnidades("importacion", ventana);
    return {
      "Combustión": Math.max(0, total - hibridos - electricos),
      "Híbridos": hibridos,
      "Eléctricos": electricos,
    };
  });
}

// ------------------------------------------------------------ combustible

/**
 * Combustible del lado de importación: Cuadro 10 del informe estadístico
 * (Nafta, Diesel, Flex, Híbrido, Eléctrico por mes). No hay archivo por
 * unidad como en matriculación, así que no se puede abrir por marca, y
 * como el informe solo trae el año en curso, tampoco hay año anterior
 * contra el que comparar. Se toma el informe más reciente que cubra el
 * año pedido.
 */
export interface CoberturaCombustibleImportacion {
  anios: number[];
  ultimo: { anio: number; mes: number } | null;
}

const TABLA_COMB = "importacion_combustible_mensual";

function hayTablaComb(): boolean {
  return (
    getDb()
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
      .get(TABLA_COMB) !== undefined
  );
}

export function getCoberturaCombustibleImportacion(): CoberturaCombustibleImportacion {
  if (!hayTablaComb()) return { anios: [], ultimo: null };
  const db = getDb();
  const anios = (
    db.prepare(`SELECT DISTINCT anio FROM ${TABLA_COMB} ORDER BY anio`).all() as { anio: number }[]
  ).map((r) => r.anio);
  const ultimo = db
    .prepare(`SELECT anio, mes FROM ${TABLA_COMB} ORDER BY anio DESC, mes DESC LIMIT 1`)
    .get() as { anio: number; mes: number } | undefined;
  return { anios, ultimo: ultimo ?? null };
}

export interface CombustibleImportacion {
  filas: FilaDimension[];
  total: number;
  /** Período del informe del que salió ("2026-08"), para citarlo. */
  informe: string | null;
}

/** Sin acentos y en mayúsculas, como los rótulos del archivo de
 *  matriculación (HIBRIDO, ELECTRICO): los dos cortes se leen igual. */
function rotulo(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
}

export function getCombustibleImportacion(r: RangoMeses): CombustibleImportacion {
  if (!hayTablaComb()) return { filas: [], total: 0, informe: null };
  const db = getDb();
  const informe = (
    db
      .prepare(`SELECT MAX(informe_periodo) p FROM ${TABLA_COMB} WHERE anio = ?`)
      .get(r.anio) as { p: string | null }
  ).p;
  if (!informe) return { filas: [], total: 0, informe: null };
  const filas = db
    .prepare(
      `SELECT combustible valor, SUM(unidades) unidades FROM ${TABLA_COMB}
       WHERE informe_periodo = ? AND anio = ? AND mes BETWEEN ? AND ?
       GROUP BY combustible HAVING unidades > 0 ORDER BY unidades DESC`
    )
    .all(informe, r.anio, r.mesDesde, r.mesHasta) as { valor: string; unidades: number }[];
  const total = filas.reduce((s, f) => s + f.unidades, 0);
  return {
    informe,
    total,
    filas: filas.map((f) => ({
      valor: rotulo(f.valor),
      unidades: f.unidades,
      participacion: total ? f.unidades / total : 0,
      unidadesAnterior: 0,
      variacion: null,
      deltaParticipacion: null,
    })),
  };
}
