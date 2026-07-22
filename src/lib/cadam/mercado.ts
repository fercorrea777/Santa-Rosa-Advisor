import { getDb } from "./db";
import { getMarcasPropiasSet } from "./config";

/**
 * Consultas sobre las tablas row-level de CADAM (v_matriculacion,
 * v_importacion, ...), que arma CADAM/scripts/ingest.py.
 *
 * Convive con queries.ts, que lee las tablas de los informes
 * estadisticos y alimenta la pantalla Inicio. No se toca esa.
 *
 * REGLAS QUE ESTE MODULO RESPETA
 * ------------------------------
 * 1. Un mes sin datos NO se devuelve como cero: simplemente no aparece
 *    en la serie. Quien dibuja decide como mostrar el hueco (spec sec. 13).
 * 2. `importacion_nev` NUNCA se suma a `importacion`: es un subconjunto
 *    de ella. Se usa solo para el detalle de tecnologia (ver CADAM/DATOS.md).
 * 3. Las variaciones contra un periodo sin base devuelven null, no 0 ni
 *    infinito. La UI muestra "sin base comparativa".
 */

export type Fuente = "matriculacion" | "importacion";

export interface RangoMeses {
  anio: number;
  mesDesde: number;
  mesHasta: number;
}

export interface Filtro extends RangoMeses {
  segmento?: string;
  tecnologia?: string;
  marca?: string;
  empresa?: string;
  /** Modelo base ('HILUX'). En importacion es la columna `modelo`. */
  modelo?: string;
  /** Version tal como la escribe la DNRA ('HILUX D/C 4X4 SRV AUT').
   *  Solo existe en matriculacion. */
  version?: string;
}

/** Tecnologias en el orden en que se muestran. No se agrupan por defecto:
 *  MHEV no es HEV, PHEV no es HEV, REEV no es EV (spec sec. 9). */
export const TECNOLOGIAS = ["ICE", "MHEV", "HEV", "PHEV", "REEV", "EV"] as const;
export type Tecnologia = (typeof TECNOLOGIAS)[number];

/** Agrupacion OPCIONAL, solo para mostrar. Nunca reemplaza al detalle. */
export const GRUPO_TECNOLOGIA: Record<string, string> = {
  ICE: "Combustión",
  MHEV: "Híbridos",
  HEV: "Híbridos",
  PHEV: "Híbridos",
  REEV: "Eléctricos",
  EV: "Eléctricos",
};

export const SEGMENTO_SIN_CLASIFICAR = "Sin clasificar";

// ---------------------------------------------------------------- cobertura

export interface Cobertura {
  snapshot: string | null;
  fechaIngesta: string | null;
  /** Meses realmente presentes, por fuente. */
  matriculacion: { anios: number[]; ultimo: { anio: number; mes: number } | null };
  importacion: { anios: number[]; ultimo: { anio: number; mes: number } | null };
  /** Huecos detectados en el medio de la serie (ej. '2022-02'), por
   *  fuente: un hueco de matriculacion no es un hueco de importacion. */
  mesesFaltantes: { matriculacion: string[]; importacion: string[] };
  /** Primer anio con segmento clasificado (antes viene todo como NDA). */
  primerAnioConSegmento: number | null;
}

/** Extrae los meses faltantes de los mensajes de una sola fuente. */
function mesesDe(filas: { mensaje: string }[], prefijo: string): string[] {
  const propios = filas.filter((f) => f.mensaje.startsWith(prefijo));
  return [...new Set(
    propios.flatMap((f) => {
      const cola = f.mensaje.slice(f.mensaje.lastIndexOf(": ") + 2);
      return Array.from(cola.matchAll(/\b(\d{4}-\d{2})\b/g), (m) => m[1]);
    })
  )].sort();
}

export function getCobertura(): Cobertura {
  const db = getDb();
  const snap = db
    .prepare("SELECT periodo, fecha_ingesta FROM snapshots ORDER BY periodo DESC LIMIT 1")
    .get() as { periodo: string; fecha_ingesta: string } | undefined;

  const resumen = (tabla: string) => {
    const anios = db
      .prepare(`SELECT DISTINCT anio FROM ${tabla} ORDER BY anio`)
      .all()
      .map((r) => (r as { anio: number }).anio);
    const ultimo = db
      .prepare(`SELECT anio, mes FROM ${tabla} ORDER BY anio DESC, mes DESC LIMIT 1`)
      .get() as { anio: number; mes: number } | undefined;
    return { anios, ultimo: ultimo ?? null };
  };

  const faltantes = db
    .prepare(
      `SELECT mensaje FROM carga_log
       WHERE categoria = 'mes_sin_datos' AND snapshot = ?`
    )
    .all(snap?.periodo ?? "") as { mensaje: string }[];

  const primerAnio = db
    .prepare(
      `SELECT MIN(anio) a FROM v_matriculacion WHERE segmento <> ?`
    )
    .get(SEGMENTO_SIN_CLASIFICAR) as { a: number | null };

  return {
    snapshot: snap?.periodo ?? null,
    fechaIngesta: snap?.fecha_ingesta ?? null,
    matriculacion: resumen("v_matriculacion"),
    importacion: resumen("v_importacion"),
    // El mensaje es "<Fuente>: meses sin datos dentro del rango
    // 2022-01..2026-06: 2022-02". Los meses faltantes van despues del
    // ULTIMO ':' -- antes esta el rango, que no hay que confundir con
    // un faltante (bug detectado al mostrar 2022-01 y 2026-06 como
    // ausentes cuando en realidad son los extremos de la serie).
    mesesFaltantes: {
      matriculacion: mesesDe(faltantes, "Matriculacion"),
      importacion: mesesDe(faltantes, "Importacion"),
    },
    primerAnioConSegmento: primerAnio?.a ?? null,
  };
}

// ------------------------------------------------------------------ helpers

function vista(fuente: Fuente) {
  return fuente === "matriculacion" ? "v_matriculacion" : "v_importacion";
}

/** Construye el WHERE de un filtro. Devuelve el fragmento y los binds. */
function where(fuente: Fuente, f: Filtro, alias = "") {
  const p = alias ? `${alias}.` : "";
  const cond = [`${p}anio = ?`, `${p}mes BETWEEN ? AND ?`];
  const args: (string | number)[] = [f.anio, f.mesDesde, f.mesHasta];
  if (f.segmento) {
    cond.push(`${p}segmento = ?`);
    args.push(f.segmento);
  }
  if (f.marca) {
    cond.push(`${p}marca = ?`);
    args.push(f.marca);
  }
  if (f.modelo) {
    // En matriculacion el modelo vive en `modelo_base` (derivado); en
    // importacion la columna `modelo` YA es el modelo.
    cond.push(fuente === "matriculacion" ? `${p}modelo_base = ?` : `${p}modelo = ?`);
    args.push(f.modelo);
  }
  // tecnologia, empresa y version solo existen en matriculacion
  if (fuente === "matriculacion" && f.tecnologia) {
    cond.push(`${p}tecnologia = ?`);
    args.push(f.tecnologia);
  }
  if (fuente === "matriculacion" && f.empresa) {
    cond.push(`${p}empresa = ?`);
    args.push(f.empresa);
  }
  if (fuente === "matriculacion" && f.version) {
    cond.push(`${p}modelo = ?`);
    args.push(f.version);
  }
  return { sql: cond.join(" AND "), args };
}

/** Variacion relativa. null cuando no hay base contra la que comparar,
 *  para que la UI diga "sin base comparativa" en vez de mostrar +100%. */
export function variacion(actual: number, base: number): number | null {
  if (!base) return null;
  return (actual - base) / base;
}

function total(fuente: Fuente, f: Filtro): number {
  const db = getDb();
  const w = where(fuente, f);
  const r = db
    .prepare(`SELECT COALESCE(SUM(unidades), 0) u FROM ${vista(fuente)} WHERE ${w.sql}`)
    .get(...w.args) as { u: number };
  return r.u;
}

/** ¿Hay datos de ese anio/rango? Sirve para distinguir "cero real" de
 *  "todavia no cargado". */
function hayDatos(fuente: Fuente, anio: number, mesDesde: number, mesHasta: number): boolean {
  const db = getDb();
  const r = db
    .prepare(
      `SELECT 1 FROM ${vista(fuente)} WHERE anio = ? AND mes BETWEEN ? AND ? LIMIT 1`
    )
    .get(anio, mesDesde, mesHasta);
  return r !== undefined;
}

// --------------------------------------------------------------------- KPIs

export interface Kpi {
  valor: number;
  variacion: number | null;
  /** false cuando el periodo comparativo no tiene datos cargados. */
  baseDisponible: boolean;
  baseValor: number;
}

export function getKpi(fuente: Fuente, f: Filtro): Kpi {
  const valor = total(fuente, f);
  const anterior: Filtro = { ...f, anio: f.anio - 1 };
  const base = total(fuente, anterior);
  const disponible = hayDatos(fuente, f.anio - 1, f.mesDesde, f.mesHasta);
  return {
    valor,
    variacion: disponible ? variacion(valor, base) : null,
    baseDisponible: disponible,
    baseValor: base,
  };
}

// ------------------------------------------------------------------- series

export interface PuntoMensual {
  anio: number;
  mes: number;
  unidades: number;
}

/**
 * Serie mensual. Solo devuelve los meses que EXISTEN en los datos --
 * nunca rellena con ceros (spec sec. 13). Un hueco en el resultado es un
 * hueco real de la fuente.
 */
export function getSerieMensual(
  fuente: Fuente,
  anios: number[],
  extra?: Pick<Filtro, "segmento" | "tecnologia" | "marca" | "empresa">
): PuntoMensual[] {
  if (!anios.length) return [];
  const db = getDb();
  const cond: string[] = [`anio IN (${anios.map(() => "?").join(",")})`];
  const args: (string | number)[] = [...anios];
  if (extra?.segmento) {
    cond.push("segmento = ?");
    args.push(extra.segmento);
  }
  if (extra?.marca) {
    cond.push("marca = ?");
    args.push(extra.marca);
  }
  if (fuente === "matriculacion" && extra?.tecnologia) {
    cond.push("tecnologia = ?");
    args.push(extra.tecnologia);
  }
  if (fuente === "matriculacion" && extra?.empresa) {
    cond.push("empresa = ?");
    args.push(extra.empresa);
  }
  return db
    .prepare(
      `SELECT anio, mes, SUM(unidades) unidades FROM ${vista(fuente)}
       WHERE ${cond.join(" AND ")}
       GROUP BY anio, mes ORDER BY anio, mes`
    )
    .all(...args) as PuntoMensual[];
}

// ----------------------------------------------------------------- rankings

export interface FilaRanking {
  posicion: number;
  clave: string;
  marca: string;
  modelo?: string;
  segmento?: string;
  tecnologia?: string;
  unidades: number;
  participacion: number;
  /** null = la marca no existia en el periodo anterior (entrante). */
  variacion: number | null;
  unidadesAnterior: number;
  posicionAnterior: number | null;
  cambioPosicion: number | null;
  esPropia: boolean;
}

function armarRanking(
  filasActual: { clave: string; marca: string; modelo?: string; segmento?: string; unidades: number }[],
  filasAnterior: Map<string, number>,
  ordenAnterior: Map<string, number>,
  baseDisponible: boolean
): FilaRanking[] {
  const propias = getMarcasPropiasSet();
  const totalActual = filasActual.reduce((s, r) => s + r.unidades, 0) || 1;
  return filasActual.map((r, i) => {
    const antes = filasAnterior.get(r.clave) ?? 0;
    const posAnt = ordenAnterior.get(r.clave) ?? null;
    return {
      posicion: i + 1,
      clave: r.clave,
      marca: r.marca,
      modelo: r.modelo,
      segmento: r.segmento,
      unidades: r.unidades,
      participacion: r.unidades / totalActual,
      variacion: baseDisponible && antes ? variacion(r.unidades, antes) : null,
      unidadesAnterior: antes,
      posicionAnterior: baseDisponible ? posAnt : null,
      cambioPosicion: baseDisponible && posAnt ? posAnt - (i + 1) : null,
      esPropia: propias.has(r.marca),
    };
  });
}

export function getRankingMarcas(fuente: Fuente, f: Filtro): FilaRanking[] {
  const db = getDb();
  const w = where(fuente, f);
  const actual = db
    .prepare(
      `SELECT marca clave, marca, SUM(unidades) unidades FROM ${vista(fuente)}
       WHERE ${w.sql} GROUP BY marca HAVING unidades > 0 ORDER BY unidades DESC`
    )
    .all(...w.args) as { clave: string; marca: string; unidades: number }[];

  const wp = where(fuente, { ...f, anio: f.anio - 1 });
  const previo = db
    .prepare(
      `SELECT marca clave, SUM(unidades) unidades FROM ${vista(fuente)}
       WHERE ${wp.sql} GROUP BY marca HAVING unidades > 0 ORDER BY unidades DESC`
    )
    .all(...wp.args) as { clave: string; unidades: number }[];

  return armarRanking(
    actual,
    new Map(previo.map((r) => [r.clave, r.unidades])),
    new Map(previo.map((r, i) => [r.clave, i + 1])),
    hayDatos(fuente, f.anio - 1, f.mesDesde, f.mesHasta)
  );
}

/**
 * Ranking por MODELO o por VERSION.
 *
 * Las dos fuentes de CADAM tienen granularidad distinta:
 *   importacion  -> `modelo` ya es el modelo ('HILUX')
 *   matriculacion-> `modelo` es la VERSION ('HILUX D/C 4X4 SRV AUT') y el
 *                   modelo derivado vive en `modelo_base` (ver
 *                   ingest.py::derivar_modelo_base)
 *
 * Por eso el ranking de versiones solo existe del lado de matriculacion:
 * la base de importacion no baja a ese nivel.
 */
function rankingPorColumna(
  fuente: Fuente,
  columna: string,
  f: Filtro,
  limite: number
): FilaRanking[] {
  const db = getDb();
  const w = where(fuente, f);
  const actual = db
    .prepare(
      `SELECT marca || ' ' || ${columna} clave, marca, ${columna} modelo,
              MIN(segmento) segmento, SUM(unidades) unidades
       FROM ${vista(fuente)} WHERE ${w.sql}
       GROUP BY marca, ${columna} HAVING unidades > 0
       ORDER BY unidades DESC LIMIT ?`
    )
    .all(...w.args, limite) as {
    clave: string; marca: string; modelo: string; segmento: string; unidades: number;
  }[];

  const wp = where(fuente, { ...f, anio: f.anio - 1 });
  const previo = db
    .prepare(
      `SELECT marca || ' ' || ${columna} clave, SUM(unidades) unidades
       FROM ${vista(fuente)} WHERE ${wp.sql}
       GROUP BY marca, ${columna} HAVING unidades > 0 ORDER BY unidades DESC`
    )
    .all(...wp.args) as { clave: string; unidades: number }[];

  return armarRanking(
    actual,
    new Map(previo.map((r) => [r.clave, r.unidades])),
    new Map(previo.map((r, i) => [r.clave, i + 1])),
    hayDatos(fuente, f.anio - 1, f.mesDesde, f.mesHasta)
  );
}

export function getRankingModelos(fuente: Fuente, f: Filtro, limite = 300): FilaRanking[] {
  return rankingPorColumna(
    fuente,
    fuente === "matriculacion" ? "modelo_base" : "modelo",
    f,
    limite
  );
}

/** Ranking de versiones. Solo matriculacion: la base de importacion no
 *  tiene ese nivel de detalle. */
export function getRankingVersiones(f: Filtro, limite = 300): FilaRanking[] {
  return rankingPorColumna("matriculacion", "modelo", f, limite);
}

// -------------------------------------------------------- cortes por dimension

export interface FilaDimension {
  valor: string;
  unidades: number;
  participacion: number;
  unidadesAnterior: number;
  variacion: number | null;
  /** Diferencia de participacion en puntos porcentuales. Una marca puede
   *  crecer en unidades y perder market share (spec sec. 17). */
  deltaParticipacion: number | null;
}

export function getPorDimension(
  fuente: Fuente,
  dimension: "segmento" | "tecnologia" | "empresa" | "marca" | "tipo_detalle",
  f: Filtro
): FilaDimension[] {
  const db = getDb();
  // El filtro sobre la PROPIA dimension se ignora aca: si no, al elegir
  // "PHEV" el corte por tecnologia devolveria una sola fila con 100% de
  // participacion. La participacion se mide siempre contra el mercado que
  // dejan los OTROS filtros. Quien quiera resaltar la fila elegida lo hace
  // en la UI, no achicando el denominador.
  const fSinDim: Filtro = { ...f };
  if (dimension === "segmento") delete fSinDim.segmento;
  if (dimension === "tecnologia") delete fSinDim.tecnologia;
  if (dimension === "marca") delete fSinDim.marca;
  if (dimension === "empresa") delete fSinDim.empresa;

  const w = where(fuente, fSinDim);
  const wp = where(fuente, { ...fSinDim, anio: fSinDim.anio - 1 });
  const baseDisp = hayDatos(fuente, f.anio - 1, f.mesDesde, f.mesHasta);

  const q = (cond: typeof w) =>
    db
      .prepare(
        `SELECT ${dimension} valor, SUM(unidades) unidades FROM ${vista(fuente)}
         WHERE ${cond.sql} GROUP BY ${dimension} HAVING unidades > 0
         ORDER BY unidades DESC`
      )
      .all(...cond.args) as { valor: string; unidades: number }[];

  const actual = q(w);
  const previo = q(wp);
  const totalA = actual.reduce((s, r) => s + r.unidades, 0) || 1;
  const totalP = previo.reduce((s, r) => s + r.unidades, 0) || 1;
  const mapaP = new Map(previo.map((r) => [r.valor, r.unidades]));

  return actual.map((r) => {
    const antes = mapaP.get(r.valor) ?? 0;
    const partA = r.unidades / totalA;
    const partP = antes / totalP;
    return {
      valor: r.valor,
      unidades: r.unidades,
      participacion: partA,
      unidadesAnterior: antes,
      variacion: baseDisp && antes ? variacion(r.unidades, antes) : null,
      deltaParticipacion: baseDisp && previo.length ? partA - partP : null,
    };
  });
}

// ------------------------------------------------- importacion vs matriculacion

/** Matriculacion mensual excluyendo camiones y omnibus, para poder
 *  compararla contra la base de importacion (que es solo livianos). */
function getSerieMensualSinPesados(anios: number[], marca?: string): PuntoMensual[] {
  if (!anios.length) return [];
  const db = getDb();
  const cond = [`anio IN (${anios.map(() => "?").join(",")})`,
                `segmento NOT IN (${SEGMENTOS_PESADOS.map(() => "?").join(",")})`];
  const args: (string | number)[] = [...anios, ...SEGMENTOS_PESADOS];
  if (marca) {
    cond.push("marca = ?");
    args.push(marca);
  }
  return db
    .prepare(
      `SELECT anio, mes, SUM(unidades) unidades FROM v_matriculacion
       WHERE ${cond.join(" AND ")} GROUP BY anio, mes ORDER BY anio, mes`
    )
    .all(...args) as PuntoMensual[];
}

/** Unidades matriculadas por marca, SIN camiones ni omnibus. Es la unica
 *  forma de compararlas contra la base de importacion, que es de livianos. */
export function getMarcasMatriculacionLivianos(f: Filtro): Map<string, number> {
  const db = getDb();
  const w = where("matriculacion", f);
  const filas = db
    .prepare(
      `SELECT marca, SUM(unidades) u FROM v_matriculacion
       WHERE ${w.sql} AND segmento NOT IN (${SEGMENTOS_PESADOS.map(() => "?").join(",")})
       GROUP BY marca HAVING u > 0`
    )
    .all(...w.args, ...SEGMENTOS_PESADOS) as { marca: string; u: number }[];
  return new Map(filas.map((r) => [r.marca, r.u]));
}

export interface BrechaMensual {
  anio: number;
  mes: number;
  importaciones: number | null;
  matriculaciones: number | null;
  diferencia: number | null;
  /** matriculaciones / importaciones. null si no hay importaciones. */
  ratio: number | null;
}

/** Segmentos pesados: existen en matriculacion pero NO en la base de
 *  importacion, que es solo de vehiculos livianos. */
export const SEGMENTOS_PESADOS = ["Camion", "Omnibus"];

/**
 * Serie comparada. Un mes que solo tiene una de las dos fuentes deja la
 * otra en null (no en cero): la spec pide tratar la brecha como una
 * SEÑAL orientativa, no como stock real (sec. 18).
 *
 * IMPORTANTE: se comparan solo LIVIANOS. `v_importacion` sale de la base
 * de importacion de autos (24.047 en 2026 = Cuadro 3 de CADAM, que es de
 * vehiculos livianos), mientras que `v_matriculacion` incluye camiones y
 * omnibus. Compararlas enteras inflaba la brecha con 1.509 unidades de
 * pesados y hacia aparecer marcas como JMC con 0 importaciones y 241
 * matriculaciones. Los camiones importados viven en `v_importacion_camion`,
 * que es otra fuente y otro universo.
 */
export function getBrecha(anios: number[], marca?: string): BrechaMensual[] {
  const imp = getSerieMensual("importacion", anios, { marca });
  const mat = getSerieMensualSinPesados(anios, marca);
  const clave = (a: number, m: number) => `${a}-${m}`;
  const mapaImp = new Map(imp.map((p) => [clave(p.anio, p.mes), p.unidades]));
  const mapaMat = new Map(mat.map((p) => [clave(p.anio, p.mes), p.unidades]));
  const todas = [...new Set([...mapaImp.keys(), ...mapaMat.keys()])].sort((a, b) => {
    const [aa, am] = a.split("-").map(Number);
    const [ba, bm] = b.split("-").map(Number);
    return aa - ba || am - bm;
  });
  return todas.map((k) => {
    const [anio, mes] = k.split("-").map(Number);
    const i = mapaImp.get(k) ?? null;
    const m = mapaMat.get(k) ?? null;
    return {
      anio,
      mes,
      importaciones: i,
      matriculaciones: m,
      diferencia: i !== null && m !== null ? i - m : null,
      ratio: i !== null && m !== null && i > 0 ? m / i : null,
    };
  });
}

// ------------------------------------------------------------------ opciones

export function getOpcionesFiltro() {
  const db = getDb();
  const col = (sql: string) =>
    db.prepare(sql).all().map((r) => (r as { v: string }).v);
  return {
    segmentos: col(
      `SELECT segmento v, SUM(unidades) u FROM v_matriculacion
       GROUP BY segmento ORDER BY u DESC`
    ),
    marcas: col(
      `SELECT marca v, SUM(unidades) u FROM v_matriculacion
       GROUP BY marca ORDER BY u DESC`
    ),
    empresas: col(
      `SELECT empresa v, SUM(unidades) u FROM v_matriculacion
       GROUP BY empresa ORDER BY u DESC`
    ),
  };
}

// --------------------------------------------------------- calidad de datos

export interface EntradaLog {
  nivel: "info" | "aviso" | "error";
  categoria: string;
  mensaje: string;
  archivo: string | null;
  n: number;
}

export function getCargaLog(): EntradaLog[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT nivel, categoria, mensaje, archivo, n FROM carga_log
       WHERE snapshot = (SELECT periodo FROM v_snapshot_actual)
       ORDER BY CASE nivel WHEN 'error' THEN 0 WHEN 'aviso' THEN 1 ELSE 2 END,
                categoria`
    )
    .all() as EntradaLog[];
}

export function getArchivos() {
  const db = getDb();
  return db
    .prepare(
      `SELECT a.nombre, a.tipo, a.filas_leidas, a.filas_cargadas, a.unidades,
              a.fecha_ingesta, a.snapshot
       FROM archivos a ORDER BY a.snapshot DESC, a.nombre`
    )
    .all() as {
    nombre: string; tipo: string; filas_leidas: number; filas_cargadas: number;
    unidades: number; fecha_ingesta: string; snapshot: string;
  }[];
}
