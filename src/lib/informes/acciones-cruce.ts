/**
 * Cruce de las versiones del Excel de acciones comerciales con el mercado
 * (CADAM: matriculaciones e importaciones) y con la facturación propia
 * (Cars), POR FAMILIA.
 *
 * Por qué por familia y no por versión: las tres fuentes escriben la
 * versión distinto —"X50 LUX AT" (Excel) es "X50 LUXURY" en Cars y "X50"
 * en CADAM; "L200 DC 4X4 GLS HP MT" es "L200 TRITON SPORT 4WD MT GLS HPE"
 * en Cars y "L200 TRITON" en CADAM— y adivinar versión contra versión
 * (GLS vs GLX, 4x2 vs 4x4, HP vs Low Power) produce cruces plausibles y
 * equivocados, que es lo peor que puede pasar en un tablero. La FAMILIA
 * (X50, JOLION PRO, TANK 300, L200) sí se lee igual en las tres, y es el
 * nivel al que CADAM cuenta de todos modos.
 *
 * La clave de familia es la primera palabra del nombre —sin los prefijos
 * NEW/NUEVO/NUEVA/HAVAL, que una fuente pone y otra no— más la segunda
 * cuando es un número de modelo ("TANK 300", no "T1 1.5") o un apellido
 * (GT, PRO, PLUS, CROSS), pegadas y sin espacios para que "X70 PLUS" y
 * "X70PLUS" sean lo mismo. Cuando ninguna fila tiene la clave exacta se
 * prueban sus sub-familias ("S07 PLUS" para "S07") y después la madre ("H6"
 * para "H6 GT" en importación, donde CADAM no separa el GT), y se dice cuál
 * se usó: un número aproximado sin rótulo es un número equivocado.
 *
 * Verificado el 15/09/2026 contra los nombres reales de las tres fuentes:
 * 114 versiones → 71 familias, 68 con cruce en al menos una fuente. Las
 * tres sin cruce son un modelo que todavía no se vendió (F700), uno sin
 * precio (G6) y un camión sin ventas (G15EA).
 *
 * Sin imports: se prueba con node suelto sobre casos fijos.
 */

const PREFIJOS = new Set(["NEW", "NUEVO", "NUEVA", "ALL", "THE", "HAVAL", "LEAP", "ZEEKR", "ZEERK"]);
const APELLIDOS = new Set(["GT", "PRO", "PLUS", "CROSS", "MAX"]);

/** Cómo escribe el Excel una familia que en CADAM/Cars se llama distinto. */
const ALIAS_FAMILIA: Record<string, string> = {
  "JAC|RF8": "REFINE",
  "JAC|X501Q": "REFRIGERADO",
  "JAC|JS41": "JS4",
  "JAC|LD250T": "LD250",
};

export function tokensFamilia(nombre: string): string[] {
  const t = String(nombre)
    .toUpperCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/(\d),(\d)/g, "$1.$2")
    .split(/[\s\-/.,+]+/)
    .filter(Boolean);
  while (t.length > 1 && PREFIJOS.has(t[0])) t.shift();
  return t;
}

/** true si la segunda palabra es parte del nombre del modelo y no de la
 *  versión: un número de tres cifras o más ("TANK 300", no "T1 1.5" ni
 *  "SUNRAY 16+1") o un apellido (PRO, GT, PLUS, CROSS). */
function esApellido(t: string): boolean {
  return /^\d{3,}$/.test(t) || APELLIDOS.has(t);
}

/** "TANK 300 HEV ELITE" → "TANK300"; "JOLION Pro High" → "JOLIONPRO";
 *  "NEW H6 PHEV 4X2" → "H6"; "Eclipse Cross 4x2 UY" → "ECLIPSECROSS";
 *  "T1 1.5 4x2 COMFORT" → "T1". */
export function claveFamilia(marca: string, nombre: string): string {
  const t = tokensFamilia(nombre);
  if (!t.length) return "";
  let clave = t[0];
  if (t.length > 1 && esApellido(t[1])) clave += t[1];
  return ALIAS_FAMILIA[`${marca.toUpperCase()}|${clave}`] ?? clave;
}

/** Rótulo legible de una clave: "TANK300" → "TANK 300", "JOLIONPRO" →
 *  "JOLION PRO", "H6GT" → "H6 GT". */
export function nombreDeClave(clave: string): string {
  const m = /^(.{2,}?)(\d{3,}|GT|PRO|PLUS|CROSS|MAX)$/.exec(clave);
  return m ? `${m[1]} ${m[2]}` : clave;
}

/** Rótulo legible de la familia de un nombre ("TANK 300 HEV ELITE" →
 *  "TANK 300"). */
export function nombreFamilia(marca: string, nombre: string): string {
  const clave = claveFamilia(marca, nombre);
  return clave ? nombreDeClave(clave) : nombre;
}

export interface UnidadesModelo {
  modelo: string;
  unidades: number;
}

export interface CruceFamilia {
  unidades: number;
  /** Los nombres de la fuente que se sumaron. */
  modelos: string[];
  /** Cuando se usó un prefijo y no la clave exacta: "H6" para "H6GT". */
  aproximado: string | null;
}

/** "X70PLUS" es sub-familia de "X70"; "TANK300" de "TANK"; "S07" no lo es
 *  de "S0". El resto tiene que ser un apellido o un número de modelo. */
function esSubfamilia(clave: string, familia: string): boolean {
  return clave !== familia && clave.startsWith(familia) && esApellido(clave.slice(familia.length));
}

/**
 * Los elementos de una familia en una lista ya clasificada por clave:
 *
 *  1. Los que tienen la clave EXACTA. Es el caso normal.
 *  2. Si no hay, sus sub-familias: el Excel dice "S07 1.6T" y Cars la tiene
 *     como "S07 PLUS 1.6". Se juntan y se dice cuáles.
 *  3. Si tampoco, la familia madre: el Excel dice "H6 GT" e importación
 *     solo tiene "H6". Se muestra y se dice que es la madre.
 *
 * null si no hay nada que se le parezca (un modelo nuevo, o un camión que
 * CADAM nombra de otra forma).
 */
export function familiaMasParecida<T>(
  clave: string,
  items: { clave: string; valor: T }[]
): { valores: T[]; aproximado: string | null } | null {
  if (!clave) return null;
  const exactos = items.filter((x) => x.clave === clave);
  if (exactos.length) return { valores: exactos.map((x) => x.valor), aproximado: null };
  const sub = items.filter((x) => esSubfamilia(x.clave, clave));
  if (sub.length) {
    return { valores: sub.map((x) => x.valor), aproximado: [...new Set(sub.map((x) => x.clave))].join(" + ") };
  }
  let madre: string | null = null;
  for (const { clave: k } of items) {
    if (k.length >= 2 && esSubfamilia(clave, k) && (!madre || k.length > madre.length)) madre = k;
  }
  if (!madre) return null;
  const m = madre;
  return { valores: items.filter((x) => x.clave === m).map((x) => x.valor), aproximado: m };
}

/** Unidades de una familia en una lista de modelos (de CADAM o de Cars),
 *  con la misma búsqueda de `familiaMasParecida`. */
export function cruzarFamilia(
  marca: string,
  clave: string,
  modelos: UnidadesModelo[],
  claveDe: (m: UnidadesModelo) => string = (m) => claveFamilia(marca, m.modelo)
): CruceFamilia | null {
  const r = familiaMasParecida(clave, modelos.map((m) => ({ clave: claveDe(m), valor: m })));
  if (!r) return null;
  return {
    unidades: r.valores.reduce((s, m) => s + m.unidades, 0),
    modelos: [...new Set(r.valores.map((m) => m.modelo))],
    aproximado: r.aproximado,
  };
}

/**
 * Cars guarda familia ("TRAVELLER") y versión ("T2 PHEV") y a veces la
 * familia es un invento del DMS ("ZEERK 7X", "H6 GT DELUXE HÍBRIDO
 * ENCHUFABL"). La clave de una fila de Cars sale de la VERSIÓN; si la
 * versión no da clave, de la familia.
 */
export function claveCars(marca: string, fila: { modelo: string; version: string }): string {
  return claveFamilia(marca, fila.version) || claveFamilia(marca, fila.modelo);
}
