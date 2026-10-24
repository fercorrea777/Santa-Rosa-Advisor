/* i18n-ignore-file — capa de datos: consultas SQL y claves de la base (marca, segmento, tecnología…); no tiene frases de pantalla.
   Los pocos rótulos que sí se leen (GRUPO_TECNOLOGIA, SIN_REPRESENTANTE) van con N_() y se traducen donde se dibujan. */
import { getDb } from "./db";
import { getMarcasPropiasSet } from "./config";
import { GRUPO_PROPIO, repartirUnidades } from "./grupos";
import { normalizarTecnologias } from "../informes/segmento-version";
import { N_ } from "../i18n/traducir";

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
  ICE: N_("Combustión"),
  MHEV: N_("Híbridos"),
  HEV: N_("Híbridos"),
  PHEV: N_("Híbridos"),
  REEV: N_("Eléctricos"),
  EV: N_("Eléctricos"),
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

/**
 * Importador en IMPORTACIÓN. La base de importación de CADAM no trae quién
 * importa (Marca | Modelo | Tipo | Fecha | Valor | Origen | medidas); la de
 * matriculación sí (EMPRESA). Pero cada marca tiene UN representante —en
 * 2026 ninguna marca de más de 200 unidades reparte su matriculación entre
 * dos empresas—, así que "lo que importa SANTA ROSA" son las marcas que
 * SANTA ROSA matricula. La inferencia es por marca y por mayoría: entra la
 * marca si esa empresa puso al menos la mitad de sus chapas en el año del
 * filtro o el anterior (dos años, para que enero no quede sin base).
 *
 * Es una inferencia y la UI lo dice (ver marcasDeImportador): el pedido
 * de Fernando del 15/09/2026 fue "que funcione el filtro por importador",
 * que hasta entonces en las pestañas de importación no hacía nada.
 */
/** Una fila por marca: la empresa que más la matriculó en el año dado o el
 *  anterior. Binds: anio, anio. */
const REPRESENTANTE_POR_MARCA_SQL = `
  SELECT marca, empresa, u FROM (
    SELECT marca, empresa, SUM(unidades) u,
           ROW_NUMBER() OVER (PARTITION BY marca ORDER BY SUM(unidades) DESC) rn
    FROM v_matriculacion WHERE anio IN (?, ? - 1)
    GROUP BY marca, empresa
  ) WHERE rn = 1`;

/** Las marcas de un importador. Binds: anio, anio, empresa. */
const MARCAS_DEL_IMPORTADOR_SQL = `
  SELECT marca FROM (${REPRESENTANTE_POR_MARCA_SQL}) WHERE empresa = ?`;

/** Las marcas que se le atribuyen a un importador, de más a menos unidades
 *  (para que la pantalla diga cuáles son). */
export function getMarcasDeImportador(empresa: string, anio: number): string[] {
  const db = getDb();
  return (
    db
      .prepare(`${MARCAS_DEL_IMPORTADOR_SQL} ORDER BY u DESC`)
      .all(anio, anio, empresa) as { marca: string }[]
  ).map((r) => r.marca);
}

/** Etiqueta para las importaciones de marcas que nadie matriculó todavía. */
export const SIN_REPRESENTANTE = N_("Sin representante conocido");

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
  if (f.empresa) {
    if (fuente === "matriculacion") {
      cond.push(`${p}empresa = ?`);
      args.push(f.empresa);
    } else {
      cond.push(`${p}marca IN (${MARCAS_DEL_IMPORTADOR_SQL})`);
      args.push(f.anio, f.anio, f.empresa);
    }
  }
  if (fuente === "matriculacion" && f.version) {
    cond.push(`${p}modelo = ?`);
    args.push(f.version);
  }
  return { sql: cond.join(" AND "), args };
}

type Corte = { anio: number; mes: number };
const ultimoPorDb = new WeakMap<object, Map<Fuente, Corte | null>>();

/** Último mes con datos de la fuente. Se cachea por conexión: la base no
 *  cambia sin reiniciar el proceso (actualizar-datos-advisor.sh reinicia). */
function ultimoMes(fuente: Fuente): Corte | null {
  const db = getDb();
  let porFuente = ultimoPorDb.get(db);
  if (!porFuente) {
    porFuente = new Map();
    ultimoPorDb.set(db, porFuente);
  }
  if (!porFuente.has(fuente)) {
    const r = db
      .prepare(`SELECT anio, mes FROM ${vista(fuente)} ORDER BY anio DESC, mes DESC LIMIT 1`)
      .get() as Corte | undefined;
    porFuente.set(fuente, r ?? null);
  }
  return porFuente.get(fuente) ?? null;
}

/**
 * El filtro, recortado a los meses que la fuente tiene en el año pedido.
 *
 * Las dos fuentes no llegan parejas, y no siempre gana la misma: en sep-2026
 * la importación iba un mes adelante (el informe sale antes que el
 * detalle) y en oct-2026 la matriculación llegaba a septiembre con la
 * importación en agosto. Sin el recorte, «importaciones Ene–Sep 2026»
 * sumaba ocho meses y los comparaba contra nueve de 2025: una caída que no
 * existe. Se recorta ANTES de armar el año anterior, así las dos puntas de
 * la comparación tienen los mismos meses. Cada getter de abajo lo aplica.
 */
export function acotarAFuente(fuente: Fuente, f: Filtro): Filtro {
  const ult = ultimoMes(fuente);
  if (!ult || f.anio !== ult.anio || f.mesHasta <= ult.mes) return f;
  return { ...f, mesHasta: Math.max(f.mesDesde, ult.mes) };
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
  /** true cuando la fuente no tiene NINGUN mes de la ventana pedida (ej.
   *  septiembre en una fuente que llega hasta agosto). El valor viene en 0,
   *  pero eso es «todavía no publicado», no «no se vendió nada»: quien dibuja
   *  tiene que mostrar «—», no un 0 con −100%. Un cero real (la fuente tiene
   *  el mes y el filtro no deja filas) NO es sinDatos. */
  sinDatos: boolean;
}

export function getKpi(fuente: Fuente, filtro: Filtro): Kpi {
  const f = acotarAFuente(fuente, filtro);
  const sinDatos = !hayDatos(fuente, f.anio, f.mesDesde, f.mesHasta);
  const valor = total(fuente, f);
  const anterior: Filtro = { ...f, anio: f.anio - 1 };
  const base = total(fuente, anterior);
  const disponible = !sinDatos && hayDatos(fuente, f.anio - 1, f.mesDesde, f.mesHasta);
  return {
    valor,
    variacion: disponible ? variacion(valor, base) : null,
    baseDisponible: disponible,
    baseValor: base,
    sinDatos,
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
  if (extra?.empresa) {
    if (fuente === "matriculacion") {
      cond.push("empresa = ?");
      args.push(extra.empresa);
    } else {
      // Mismo criterio que where(): las marcas que ese importador matricula,
      // tomando como año de referencia el último de la serie.
      cond.push(`marca IN (${MARCAS_DEL_IMPORTADOR_SQL})`);
      args.push(Math.max(...anios), Math.max(...anios), extra.empresa);
    }
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
  /** Share del periodo anterior, sobre el total de ESE periodo. 0 si no
   *  habia base. */
  participacionAnterior: number;
  /** Diferencia de share en PUNTOS PORCENTUALES (participacion -
   *  participacionAnterior), no en porcentaje de variacion. Es la unica
   *  medida comparable entre filas cuando el mercado entero crecio: las
   *  unidades de dos periodos con mercados de distinto tamaño no se pueden
   *  comparar, el share si. null si no hay periodo anterior contra que
   *  medir. */
  deltaShare: number | null;
  posicionAnterior: number | null;
  cambioPosicion: number | null;
  esPropia: boolean;
  /** Solo en un ranking FILTRADO (ver conPuestoDeMercado): el puesto que esta
   *  fila ocupa en el mercado ENTERO, mismo período y sin ningún otro filtro.
   *  `posicion` es el puesto dentro del filtro (la lista que se está viendo);
   *  este es el real. undefined = el ranking no está filtrado y los dos son
   *  el mismo; null = no figura en el ranking sin filtrar. */
  posicionMercado?: number | null;
  /** Lo mismo para la participación: `participacion` es sobre el total del
   *  filtro («cuánto de Santa Rosa es Jetour»); esta es sobre el mercado entero,
   *  que es el share de verdad. */
  participacionMercado?: number | null;
}

/** Unidades totales del período, sin recortes. Es el denominador honesto
 *  del share: las consultas de ranking traen LIMIT y su suma no es el
 *  mercado. Exportado tambien para /operacion, que mide nuestras
 *  matriculaciones sobre el mercado ENTERO, no sobre las marcas propias. */
export function totalUnidades(fuente: Fuente, filtro: Filtro): number {
  const w = where(fuente, acotarAFuente(fuente, filtro));
  const r = getDb()
    .prepare(`SELECT SUM(unidades) t FROM ${vista(fuente)} WHERE ${w.sql}`)
    .get(...w.args) as { t: number | null };
  return r?.t ?? 0;
}

export function armarRanking(
  filasActual: {
    clave: string; marca: string; modelo?: string; segmento?: string;
    tecnologia?: string | null; unidades: number;
  }[],
  filasAnterior: Map<string, number>,
  ordenAnterior: Map<string, number>,
  baseDisponible: boolean,
  /** Totales REALES del período, no la suma de las filas que se devuelven.
   *  Los rankings por modelo/version vienen con LIMIT: sumar solo el top-N
   *  daba un denominador chico y todos los shares salian inflados. Peor
   *  todavia, la consulta del periodo anterior NO lleva limite, asi que el
   *  share de hoy se calculaba contra un recorte y el de ayer contra el
   *  total — dos numeros que no se pueden restar. De ahi que los totales
   *  entren por parametro. */
  totalActualReal: number,
  totalAnteriorReal: number
): FilaRanking[] {
  const propias = getMarcasPropiasSet();
  const totalActual = totalActualReal || 1;
  const totalAnterior = totalAnteriorReal || 1;
  return filasActual.map((r, i) => {
    const antes = filasAnterior.get(r.clave) ?? 0;
    const posAnt = ordenAnterior.get(r.clave) ?? null;
    const partActual = r.unidades / totalActual;
    const partAnterior = baseDisponible ? antes / totalAnterior : 0;
    return {
      posicion: i + 1,
      clave: r.clave,
      marca: r.marca,
      modelo: r.modelo,
      segmento: r.segmento,
      // "ICE,PHEV" -> "ICE+PHEV", en el orden fijo de las tecnologías.
      tecnologia: r.tecnologia ? normalizarTecnologias(r.tecnologia) : undefined,
      unidades: r.unidades,
      participacion: partActual,
      variacion: baseDisponible && antes ? variacion(r.unidades, antes) : null,
      unidadesAnterior: antes,
      participacionAnterior: partAnterior,
      deltaShare: baseDisponible ? partActual - partAnterior : null,
      posicionAnterior: baseDisponible ? posAnt : null,
      cambioPosicion: baseDisponible && posAnt ? posAnt - (i + 1) : null,
      esPropia: propias.has(r.marca),
    };
  });
}

export function getRankingMarcas(fuente: Fuente, filtro: Filtro): FilaRanking[] {
  const db = getDb();
  const f = acotarAFuente(fuente, filtro);
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
    hayDatos(fuente, f.anio - 1, f.mesDesde, f.mesHasta),
    totalUnidades(fuente, f),
    totalUnidades(fuente, { ...f, anio: f.anio - 1 })
  );
}

// ---------------------------------------------------------- ranking por grupo

export interface FilaGrupo {
  posicion: number;
  /** El grupo con el nombre del Excel de Fernando (GARDEN, TOYOTOSHI, SANTA ROSA,
   *  OTROS…). Ver grupos.ts. */
  grupo: string;
  /** Sus marcas en el período, de más a menos unidades. `parte` viene solo en
   *  las marcas repartidas entre grupos (Chevrolet): la fracción que le toca a
   *  ESTE grupo. */
  marcas: { marca: string; unidades: number; parte?: number }[];
  unidades: number;
  participacion: number;
  /** null = el grupo no vendía en el período anterior (o no hay período anterior). */
  variacion: number | null;
  unidadesAnterior: number;
  participacionAnterior: number;
  /** Diferencia de participación en PUNTOS (participacion - participacionAnterior). */
  deltaShare: number | null;
  /** Dónde estaba el grupo en el mismo período del año anterior. null = no
   *  figuraba (no vendía) o no hay período anterior contra qué medir. */
  posicionAnterior: number | null;
  /** Puestos que subió (positivo) o bajó (negativo). */
  cambioPosicion: number | null;
  esPropio: boolean;
  /** Solo con segmento o tecnología puestos: el puesto y la participación del
   *  grupo en el mercado ENTERO (mismo período, sin esos filtros). Ver
   *  FilaRanking.posicionMercado. */
  posicionMercado?: number | null;
  participacionMercado?: number | null;
}

/**
 * Ranking por GRUPO: las marcas agrupadas por el importador que las representa.
 *
 * El grupo de cada marca sale de la lista de Fernando (grupos.ts): lo que no
 * está va a Otros, y Chevrolet se reparte entre Garden, De la Sobera y Otros.
 * Sirve igual para matriculación y para importación, que no trae empresa y es
 * la fuente de la base de Fernando. El reparto de Chevrolet se hace MES A MES
 * (y no sobre el total del período) para dar las mismas cifras que su Excel:
 * redondear cada mes y sumar no es lo mismo que redondear la suma.
 *
 * Respeta período, segmento y tecnología (en importación la tecnología no
 * existe). NO respeta marca, modelo, versión ni importador: un ranking de
 * grupos filtrado por uno de ellos tendría una sola fila.
 */
export function getRankingGrupos(fuente: Fuente, filtro: Filtro): FilaGrupo[] {
  const act = acotarAFuente(fuente, {
    anio: filtro.anio, mesDesde: filtro.mesDesde, mesHasta: filtro.mesHasta,
    segmento: filtro.segmento, tecnologia: filtro.tecnologia,
  });
  const ant: Filtro = { ...act, anio: act.anio - 1 };
  const hayBase = hayDatos(fuente, ant.anio, ant.mesDesde, ant.mesHasta);

  type Acum = { unidades: number; marcas: Map<string, { unidades: number; parte?: number }> };
  const porGrupo = (f: Filtro): Map<string, Acum> => {
    const w = where(fuente, f);
    const filas = getDb()
      .prepare(
        `SELECT marca, mes, SUM(unidades) unidades FROM ${vista(fuente)}
         WHERE ${w.sql} GROUP BY marca, mes HAVING unidades > 0`
      )
      .all(...w.args) as { marca: string; mes: number; unidades: number }[];
    const grupos = new Map<string, Acum>();
    for (const r of filas) {
      for (const parte of repartirUnidades(r.marca, r.unidades)) {
        if (parte.unidades <= 0) continue;
        let g = grupos.get(parte.grupo);
        if (!g) grupos.set(parte.grupo, (g = { unidades: 0, marcas: new Map() }));
        g.unidades += parte.unidades;
        const m = g.marcas.get(r.marca) ?? { unidades: 0, parte: parte.parte ?? undefined };
        m.unidades += parte.unidades;
        g.marcas.set(r.marca, m);
      }
    }
    return grupos;
  };

  const actual = porGrupo(act);
  const previo = porGrupo(ant);
  // Con segmento o tecnología puestos, además del puesto «en el segmento», el
  // del mercado entero. En importación la tecnología no recorta nada.
  const recorta = !!act.segmento || (fuente === "matriculacion" && !!act.tecnologia);
  const entero = recorta ? porGrupo({ anio: act.anio, mesDesde: act.mesDesde, mesHasta: act.mesHasta }) : null;
  const totalEntero = entero ? [...entero.values()].reduce((t, g) => t + g.unidades, 0) || 1 : 1;
  const posEntero = new Map(
    [...(entero ?? new Map<string, Acum>()).entries()]
      .map(([nombre, g]) => ({ nombre, u: g.unidades }))
      .sort((a, b) => b.u - a.u || a.nombre.localeCompare(b.nombre))
      .map((x, i) => [x.nombre, i + 1] as const)
  );
  const totalAct = [...actual.values()].reduce((t, g) => t + g.unidades, 0) || 1;
  const totalPrev = [...previo.values()].reduce((t, g) => t + g.unidades, 0) || 1;
  // Desempate por nombre: sin él, dos grupos con las mismas unidades cambiarían
  // de puesto entre una carga y la siguiente.
  const porUnidades = <T extends { nombre: string; u: number }>(a: T, b: T) =>
    b.u - a.u || a.nombre.localeCompare(b.nombre);
  const ordenAct = [...actual.entries()]
    .map(([nombre, g]) => ({ nombre, u: g.unidades, g }))
    .sort(porUnidades);
  const posPrev = new Map(
    [...previo.entries()]
      .map(([nombre, g]) => ({ nombre, u: g.unidades }))
      .sort(porUnidades)
      .map((x, i) => [x.nombre, i + 1] as const)
  );

  return ordenAct.map(({ nombre, g }, i) => {
    const antes = previo.get(nombre)?.unidades ?? 0;
    const posAnt = hayBase ? posPrev.get(nombre) ?? null : null;
    const part = g.unidades / totalAct;
    const partAnt = hayBase ? antes / totalPrev : 0;
    return {
      posicion: i + 1,
      grupo: nombre,
      marcas: [...g.marcas.entries()]
        .map(([marca, m]) => ({ marca, unidades: m.unidades, ...(m.parte !== undefined ? { parte: m.parte } : {}) }))
        .sort((a, b) => b.unidades - a.unidades || a.marca.localeCompare(b.marca)),
      unidades: g.unidades,
      participacion: part,
      variacion: hayBase && antes ? variacion(g.unidades, antes) : null,
      unidadesAnterior: antes,
      participacionAnterior: partAnt,
      deltaShare: hayBase ? part - partAnt : null,
      posicionAnterior: posAnt,
      cambioPosicion: posAnt ? posAnt - (i + 1) : null,
      esPropio: nombre === GRUPO_PROPIO,
      ...(entero
        ? {
            posicionMercado: posEntero.get(nombre) ?? null,
            participacionMercado: entero.has(nombre) ? entero.get(nombre)!.unidades / totalEntero : null,
          }
        : {}),
    };
  });
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
  filtro: Filtro,
  limite: number
): FilaRanking[] {
  const db = getDb();
  const f = acotarAFuente(fuente, filtro);
  const w = where(fuente, f);
  const actual = db
    .prepare(
      // tecnologia solo existe en matriculacion; en importacion la columna
      // no esta y el GROUP_CONCAT() rompería la consulta. Se traen TODAS las
      // tecnologías de la familia ("ICE,PHEV"), no la mínima: un T2 vende
      // naftero y enchufable, y decir solo "ICE" escondía la mitad.
      `SELECT marca || ' ' || ${columna} clave, marca, ${columna} modelo,
              MIN(segmento) segmento,
              ${fuente === "matriculacion" ? "GROUP_CONCAT(DISTINCT tecnologia) tecnologia," : "NULL tecnologia,"}
              SUM(unidades) unidades
       FROM ${vista(fuente)} WHERE ${w.sql}
       GROUP BY marca, ${columna} HAVING unidades > 0
       ORDER BY unidades DESC LIMIT ?`
    )
    .all(...w.args, limite) as {
    clave: string; marca: string; modelo: string; segmento: string;
    tecnologia: string | null; unidades: number;
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
    hayDatos(fuente, f.anio - 1, f.mesDesde, f.mesHasta),
    totalUnidades(fuente, f),
    totalUnidades(fuente, { ...f, anio: f.anio - 1 })
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

/** ¿El filtro recorta algo ADEMÁS del período? Tecnología y versión solo
 *  existen en matriculación (en importación no hacen nada, ver where()). */
export function hayRecorte(fuente: Fuente, f: Filtro): boolean {
  return !!(
    f.segmento || f.marca || f.empresa || f.modelo ||
    (fuente === "matriculacion" && (f.tecnologia || f.version))
  );
}

/**
 * A un ranking filtrado le agrega el puesto y la participación que cada fila
 * tiene en el MERCADO ENTERO (mismo período, sin ningún otro filtro).
 *
 * Por qué hace falta: con un filtro puesto, `posicion` y `participacion` son
 * relativas a lo que queda. Con «Importador: Santa Rosa» la participación de
 * Jetour es «cuánto de Santa Rosa es Jetour» (35 %), no su parte del mercado
 * (2,2 %), y su puesto es el 1 de la lista, no el 11 del mercado. El share se
 * mide sobre el mercado, así que las dos medidas conviven: la del filtro, para
 * ver cómo se reparte lo que se está mirando, y esta, para saber dónde está
 * parada de verdad.
 *
 * Sin filtro devuelve las filas tal cual (las dos medidas serían la misma).
 * `nivel` dice qué es una fila: la marca, el modelo o la versión.
 */
export function conPuestoDeMercado(
  fuente: Fuente,
  filas: FilaRanking[],
  filtro: Filtro,
  nivel: "marca" | "modelo" | "version"
): FilaRanking[] {
  if (!hayRecorte(fuente, filtro)) return filas;
  const f = acotarAFuente(fuente, { anio: filtro.anio, mesDesde: filtro.mesDesde, mesHasta: filtro.mesHasta });
  const w = where(fuente, f);
  const columna =
    nivel === "marca" ? null
    : nivel === "version" ? "modelo"
    : fuente === "matriculacion" ? "modelo_base" : "modelo";
  const clave = columna ? `marca || ' ' || ${columna}` : "marca";
  const grupo = columna ? `marca, ${columna}` : "marca";
  const base = getDb()
    .prepare(
      `SELECT ${clave} clave, SUM(unidades) u FROM ${vista(fuente)}
       WHERE ${w.sql} GROUP BY ${grupo} HAVING u > 0 ORDER BY u DESC, clave`
    )
    .all(...w.args) as { clave: string; u: number }[];
  const total = base.reduce((t, r) => t + r.u, 0) || 1;
  const puesto = new Map(base.map((r, i) => [r.clave, { posicion: i + 1, u: r.u }] as const));
  return filas.map((fila) => {
    const b = puesto.get(fila.clave);
    return { ...fila, posicionMercado: b?.posicion ?? null, participacionMercado: b ? b.u / total : null };
  });
}

/** Cuántas versiones distintas (texto de la DNRA) registró cada modelo en
 *  el período. Solo matriculación: importación no baja a versión. */
export function getVersionesPorModelo(f: Filtro): Map<string, number> {
  const w = where("matriculacion", acotarAFuente("matriculacion", f));
  const filas = getDb()
    .prepare(
      `SELECT modelo_base modelo, COUNT(DISTINCT modelo) n FROM v_matriculacion
       WHERE ${w.sql} GROUP BY modelo_base`
    )
    .all(...w.args) as { modelo: string; n: number }[];
  return new Map(filas.map((r) => [r.modelo, r.n]));
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

export interface ModeloTecnologia {
  marca: string;
  modelo: string;
  segmento: string;
  /** Código ("ICE", "PHEV"...) o "Sin dato" cuando CADAM no la informa. */
  tecnologia: string;
  unidades: number;
  esPropia: boolean;
}

/**
 * Unidades por MODELO × TECNOLOGÍA. Solo matriculación: importación no
 * trae tecnología. Quien dibuja agrupa por clase (clases.ts): la clase no
 * está en la base, así que el corte se hace afuera, modelo por modelo.
 *
 * El filtro de tecnología se ignora a propósito —es la dimensión de las
 * columnas, mismo criterio que getPorDimension—; el de segmento sí se
 * respeta, para poder mirar un solo tipo de vehículo.
 */
export function getModelosPorTecnologia(f: Filtro): ModeloTecnologia[] {
  const propias = getMarcasPropiasSet();
  const fSinTec: Filtro = { ...acotarAFuente("matriculacion", f) };
  delete fSinTec.tecnologia;
  const w = where("matriculacion", fSinTec);
  const filas = getDb()
    .prepare(
      `SELECT marca, modelo_base modelo, MIN(segmento) segmento, tecnologia, SUM(unidades) unidades
       FROM ${vista("matriculacion")} WHERE ${w.sql}
       GROUP BY marca, modelo_base, tecnologia HAVING unidades > 0`
    )
    .all(...w.args) as {
    marca: string; modelo: string | null; segmento: string | null; tecnologia: string | null; unidades: number;
  }[];
  return filas.map((r) => ({
    marca: r.marca,
    modelo: r.modelo ?? r.marca,
    segmento: r.segmento ?? SEGMENTO_SIN_CLASIFICAR,
    tecnologia: normalizarTecnologias(r.tecnologia),
    unidades: r.unidades,
    esPropia: propias.has(r.marca),
  }));
}

export function getPorDimension(
  fuente: Fuente,
  dimension: "segmento" | "tecnologia" | "empresa" | "marca" | "tipo_detalle",
  filtro: Filtro
): FilaDimension[] {
  const db = getDb();
  const f = acotarAFuente(fuente, filtro);
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

  // Importador sobre importación: la base no lo trae, se le pone a cada
  // unidad el representante de su marca (ver REPRESENTANTE_POR_MARCA_SQL).
  // Las marcas que nadie matriculó todavía quedan en una fila aparte.
  const porRepresentante = fuente === "importacion" && dimension === "empresa";
  const alias = porRepresentante ? "i" : "";
  const w = where(fuente, fSinDim, alias);
  const wp = where(fuente, { ...fSinDim, anio: fSinDim.anio - 1 }, alias);
  const baseDisp = hayDatos(fuente, f.anio - 1, f.mesDesde, f.mesHasta);

  const q = (cond: typeof w, anio: number) =>
    (porRepresentante
      ? db
          .prepare(
            `SELECT COALESCE(r.empresa, ?) valor, SUM(i.unidades) unidades
             FROM ${vista(fuente)} i
             LEFT JOIN (${REPRESENTANTE_POR_MARCA_SQL}) r ON r.marca = i.marca
             WHERE ${cond.sql}
             GROUP BY valor HAVING unidades > 0 ORDER BY unidades DESC`
          )
          .all(SIN_REPRESENTANTE, anio, anio, ...cond.args)
      : db
          .prepare(
            `SELECT ${dimension} valor, SUM(unidades) unidades FROM ${vista(fuente)}
             WHERE ${cond.sql} GROUP BY ${dimension} HAVING unidades > 0
             ORDER BY unidades DESC`
          )
          .all(...cond.args)) as { valor: string; unidades: number }[];

  const actual = q(w, f.anio);
  const previo = q(wp, f.anio - 1);
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
  const w = where("matriculacion", acotarAFuente("matriculacion", f));
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
