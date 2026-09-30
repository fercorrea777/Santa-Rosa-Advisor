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

// ---------------------------------------------------------------------------
// CRUCE POR VERSIÓN (Excel ↔ Cars), para la pantalla de rentabilidad
// ---------------------------------------------------------------------------
//
// Arriba se explica por qué el cruce del tablero es por familia: adivinar
// versión contra versión da cruces plausibles y equivocados. Rentabilidad
// (Fernando, 18/09/2026: "cant. vendida, ticket y margen por versión") lo
// necesita igual, así que acá se hace, con cuatro resguardos que hacen que
// un error se VEA en vez de pasar por dato:
//
//  1. Solo dentro de la misma familia (X50 con X50, nunca X50 con X70), y
//     UNO A UNO por marca: una fila de Cars alimenta una sola versión del
//     Excel. Las unidades no se cuentan dos veces.
//  2. Puntaje por las palabras del Excel que Cars repite ("GLS", "PHEV",
//     "4X4"→"4WD"), más el precio de lista cuando coincide al dólar: dos
//     versiones de la misma familia no valen lo mismo, así que el precio
//     desempata sin adivinar.
//  3. Cuando el cruce no es por nombre entero se marca «≈» y se muestra el
//     nombre de Cars, para que Fernando lo valide de un vistazo.
//  4. Lo que queda sin pareja no desaparece: se devuelve aparte con sus
//     unidades, y el total de la familia es el de Cars, exacto.
//
// Verificado el 18/09/2026 contra las 114 versiones de septiembre y las 112
// filas de Cars de 2026: 89 cruces, 78 exactos por nombre.

/** Cómo escribe una fuente lo que la otra abrevia. */
const ALIAS_TOKEN: Record<string, string> = {
  LUX: "LUXURY", PERFOMANCE: "PERFORMANCE", "4X4": "4WD", "4X2": "2WD",
  INT: "INTERMEDIA", INTER: "INTERMEDIA", BAS: "BASICA", CAB: "CABINA",
  HP: "HPE", CVT: "AT", REFRIG: "REFRIGERADO", CAMION: "REFRIGERADO",
};
/** Palabras que una fuente pone y no cambian la versión: facelift, series,
 *  mercado de destino, año-modelo. */
const RUIDO_TOKEN = new Set(["NEW", "NUEVO", "NUEVA", "ALL", "THE", "FL", "I", "II", "III", "IV", "V", "VI", "UY", "BR", "E3", "D", "DIE"]);

/** Las palabras que califican la versión: todas menos las de la familia
 *  y el ruido, con los alias aplicados. "T8 4x2 INT" → {2WD, INTERMEDIA}. */
export function calificadores(nombre: string): Set<string> {
  const t = tokensFamilia(nombre);
  const out = new Set<string>();
  for (let i = 0; i < t.length; i++) {
    const tok = t[i];
    // La familia ("TANK" + "300", "JOLION" + "PRO") no califica: es lo que
    // ya se cruzó por clave.
    if (i === 0 || (i === 1 && esApellido(tok))) continue;
    if (RUIDO_TOKEN.has(tok) || /^20\d\d$/.test(tok)) continue;
    out.add(ALIAS_TOKEN[tok] ?? tok);
  }
  return out;
}

export interface FilaCars {
  modelo: string;
  version: string;
  unidades: number;
  /** Precio de lista del stock de Cars, si lo tiene. */
  precio: number | null;
}

export interface CruceVersion {
  /** Fila de Cars que se le asignó, o null si no hay pareja. */
  cars: FilaCars | null;
  /** true cuando el nombre de Cars no repite todas las palabras del Excel
   *  (se cruzó por parte del nombre, por precio, o por ser la única de la
   *  familia): va con «≈». */
  aproximado: boolean;
}

export interface CruceVersiones {
  /** Uno por versión del Excel, en el mismo orden. */
  cruces: CruceVersion[];
  /** Filas de Cars de una familia del Excel que no se pudieron asignar a
   *  ninguna versión, por clave de familia: sus unidades cuentan en el
   *  total de la familia. */
  sinPareja: Map<string, FilaCars[]>;
  /** Filas de Cars de familias que el Excel no tiene. */
  sinPlanilla: FilaCars[];
}

/** Puntaje de una pareja Excel↔Cars de la misma familia. ≥ 0,4 es cruce. */
function puntaje(
  e: Set<string>, c: Set<string>,
  pvpExcel: number | null, precioCars: number | null,
  unicaPareja: boolean
): { total: number; aproximado: boolean } {
  const iguales = e.size === c.size && [...e].every((x) => c.has(x));
  if (iguales) return { total: 2, aproximado: false };
  let total: number;
  let aproximado = true;
  if (e.size === 0) {
    total = 0.4;
  } else {
    let comunes = 0;
    for (const x of e) if (c.has(x)) comunes++;
    total = comunes / e.size;
    aproximado = comunes < e.size;
  }
  if (pvpExcel && precioCars && Math.round(pvpExcel) === Math.round(precioCars)) total += 0.5;
  if (unicaPareja) total += 0.2;
  return { total, aproximado };
}

/**
 * Cruza las versiones del Excel de UNA marca con las filas de Cars de esa
 * marca (una por modelo+versión, con sus unidades del período).
 */
export function cruzarVersiones(
  marca: string,
  versiones: { version: string; pvp: number | null }[],
  filasCars: FilaCars[]
): CruceVersiones {
  // Cars agrupado por clave de familia.
  const grupos = new Map<string, FilaCars[]>();
  for (const f of filasCars) {
    const k = claveCars(marca, f) || f.version.toUpperCase();
    const g = grupos.get(k) ?? [];
    g.push(f);
    grupos.set(k, g);
  }
  const items = [...grupos.entries()].map(([clave, filas]) => ({ clave, valor: filas }));

  // Candidatas de cada versión: las filas de Cars de su familia (exacta o
  // la más parecida, con el mismo criterio del cruce por familia).
  const familiaDe = versiones.map((v) => claveFamilia(marca, v.version) || v.version.toUpperCase());
  const familiaReclamada = new Map<string, string>(); // clave Cars → clave Excel
  const califE = versiones.map((v) => calificadores(v.version));
  const califC = new Map<FilaCars, Set<string>>();
  for (const f of filasCars) califC.set(f, calificadores(f.version || f.modelo));

  type Pareja = { i: number; fila: FilaCars; total: number; aproximado: boolean };
  const parejas: Pareja[] = [];
  const candidatasDe = new Map<number, FilaCars[]>();
  for (let i = 0; i < versiones.length; i++) {
    const r = familiaMasParecida(familiaDe[i], items);
    if (!r) continue;
    const cand = r.valores.flat();
    candidatasDe.set(i, cand);
    for (const f of cand) {
      const k = claveCars(marca, f) || f.version.toUpperCase();
      if (!familiaReclamada.has(k)) familiaReclamada.set(k, familiaDe[i]);
    }
  }
  const versionesPorFamilia = new Map<string, number>();
  for (const k of familiaDe) versionesPorFamilia.set(k, (versionesPorFamilia.get(k) ?? 0) + 1);
  for (const [i, cand] of candidatasDe) {
    const unica = cand.length === 1 && versionesPorFamilia.get(familiaDe[i]) === 1;
    for (const fila of cand) {
      const p = puntaje(califE[i], califC.get(fila)!, versiones[i].pvp, fila.precio, unica);
      if (p.total >= 0.4) parejas.push({ i, fila, total: p.total, aproximado: p.aproximado });
    }
  }
  // Mejor puntaje primero; a igual puntaje, el orden del Excel y después la
  // fila de Cars con más unidades.
  parejas.sort((a, b) => b.total - a.total || a.i - b.i || b.fila.unidades - a.fila.unidades);

  const cruces: CruceVersion[] = versiones.map(() => ({ cars: null, aproximado: false }));
  const usadas = new Set<FilaCars>();
  const asignadas = new Set<number>();
  for (const p of parejas) {
    if (asignadas.has(p.i) || usadas.has(p.fila)) continue;
    cruces[p.i] = { cars: p.fila, aproximado: p.aproximado };
    asignadas.add(p.i);
    usadas.add(p.fila);
  }

  const sinPareja = new Map<string, FilaCars[]>();
  const sinPlanilla: FilaCars[] = [];
  for (const f of filasCars) {
    if (usadas.has(f)) continue;
    const k = claveCars(marca, f) || f.version.toUpperCase();
    const familiaExcel = familiaReclamada.get(k);
    if (!familiaExcel) {
      sinPlanilla.push(f);
      continue;
    }
    const l = sinPareja.get(familiaExcel) ?? [];
    l.push(f);
    sinPareja.set(familiaExcel, l);
  }
  return { cruces, sinPareja, sinPlanilla };
}
