/**
 * Segmento (SUV, Pick Up, Automóvil...) y tecnología (ICE, HEV, PHEV...)
 * para cada versión de la gama propia.
 *
 * Ninguna de las dos existe en Cars: viven en CADAM, que para nuestras
 * marcas guarda el nombre a nivel VERSIÓN ("X50 LUXURY", "NEW H6 PHEV 4X2"),
 * casi siempre el mismo texto que Cars. Por eso el cruce va en tres pasos,
 * del más estricto al más laxo, y lo que no cruza NO se adivina: va a
 * "Sin clasificar" / "Sin dato", que son columnas honestas y no etiquetas
 * inventadas.
 *
 *  1. Nombre completo igual, normalizado (mayúsculas, un solo espacio).
 *  2. Misma familia (modelo) y la primera palabra coincide: gana el candidato
 *     CADAM que más palabras comparte con la versión.
 *  3. Si la familia entera de Cars tiene un único segmento en CADAM, ese.
 *
 * Nunca se separa letra de número ("T2" no es ["T","2"]): mismo criterio
 * que precios-cars.ts, y por la misma razón — T1 y T2 de Jetour pasarían a
 * ser la misma cosa.
 *
 * Este módulo no importa nada: lo usa un componente de cliente (el chart) y
 * también código de servidor. Por eso el orden de tecnologías está copiado
 * de mercado.ts (TECNOLOGIAS) en vez de importado — mercado.ts arrastra
 * better-sqlite3 y no puede entrar al bundle del navegador.
 */

export const SIN_CLASIFICAR = "Sin clasificar";
export const SIN_DATO_TECNOLOGIA = "Sin dato";

/** Mismo orden que mercado.ts:TECNOLOGIAS. Si cambia allá, cambia acá. */
export const ORDEN_TECNOLOGIA = ["ICE", "MHEV", "HEV", "PHEV", "REEV", "EV"] as const;

export interface ModeloCadam {
  marca: string;
  modelo: string;
  segmento: string;
  tecnologia?: string;
}

function normalizar(s: string): string {
  return String(s).toUpperCase().replace(/\s+/g, " ").trim();
}

/** Palabras que una fuente pone adelante y la otra no: "NEW L200" en Cars,
 *  "L200 TRITON..." en CADAM. Se sacan del frente para que la primera
 *  palabra sea la familia de verdad. */
const PREFIJOS = new Set(["NEW", "NUEVO", "NUEVA", "ALL", "THE"]);

function tokens(s: string): string[] {
  const t = normalizar(s).split(/[\s\-/.]+/).filter(Boolean);
  while (t.length > 1 && PREFIJOS.has(t[0])) t.shift();
  return t;
}

/** CADAM marca "NDA" en los años sin clasificación: no es un segmento. */
function segmentoValido(s: string | undefined): s is string {
  return !!s && s.toUpperCase() !== "NDA";
}

/**
 * "PHEV,ICE" (lo que devuelve GROUP_CONCAT DISTINCT, en cualquier orden) →
 * "ICE+PHEV". Una familia con versiones de dos trenes motrices no es ni una
 * ni otra: se muestra como las dos, en el orden canónico. Vacío → Sin dato.
 */
export function normalizarTecnologias(crudo: string | null | undefined): string {
  const set = new Set(
    String(crudo ?? "")
      .split(",")
      .map((t) => t.trim().toUpperCase())
      .filter((t) => t && t !== "NDA")
  );
  if (!set.size) return SIN_DATO_TECNOLOGIA;
  const orden = new Map<string, number>(ORDEN_TECNOLOGIA.map((t, i) => [t, i]));
  return [...set].sort((a, b) => (orden.get(a) ?? 99) - (orden.get(b) ?? 99)).join("+");
}

/** Tecnología por el NOMBRE, solo si la dice explícitamente ("T2 PHEV",
 *  "C10 REEV"). Sin palabra explícita no se asume ICE: se dice que no hay
 *  dato. "EV3" no es "EV" — se compara la palabra entera. */
function tecnologiaPorNombre(nombre: string): string | undefined {
  const t = new Set(tokens(nombre));
  for (const tec of ["PHEV", "REEV", "MHEV", "HEV", "EV"]) if (t.has(tec)) return tec;
  if (t.has("HIBRIDO") || t.has("HYBRID")) return "HEV";
  if (t.has("ELECTRICO") || t.has("ELECTRIC") || t.has("BEV")) return "EV";
  return undefined;
}

export function asignarSegmento<T extends { marca: string; modelo: string; version: string }>(
  versiones: T[],
  cadam: ModeloCadam[]
): (T & { segmento: string; tecnologia: string })[] {
  type Cand = { tokens: string[]; segmento: string; tecnologia?: string };
  // Índices por marca, para no comparar Jetour contra Renault.
  const exacto = new Map<string, Cand>();
  const porMarca = new Map<string, Cand[]>();
  for (const m of cadam) {
    if (!segmentoValido(m.segmento)) continue;
    const cand: Cand = { tokens: tokens(m.modelo), segmento: m.segmento, tecnologia: m.tecnologia };
    exacto.set(`${normalizar(m.marca)}|${normalizar(m.modelo)}`, cand);
    const lista = porMarca.get(normalizar(m.marca)) ?? [];
    lista.push(cand);
    porMarca.set(normalizar(m.marca), lista);
  }

  // El nombre manda sobre CADAM cuando lo dice explícitamente: CADAM
  // clasifica "POER P500 HIGH PHEV 4X4" y "C10 REEV" como ICE, y la
  // designación del fabricante en el nombre es más confiable que esa
  // etiqueta derivada. Sin palabra explícita, vale lo que diga CADAM.
  const conTec = (v: T, segmento: string, tec: string | undefined) => ({
    ...v,
    segmento,
    tecnologia: normalizarTecnologias(tecnologiaPorNombre(v.version) ?? tec),
  });

  return versiones.map((v) => {
    const marca = normalizar(v.marca);
    const directo = exacto.get(`${marca}|${normalizar(v.version)}`);
    if (directo) return conTec(v, directo.segmento, directo.tecnologia);

    const candidatos = porMarca.get(marca) ?? [];
    const tv = tokens(v.version);
    const tf = tokens(v.modelo);

    // Paso 2: primera palabra igual (la familia), gana el que más comparte.
    const mejor = candidatos
      .filter((c) => c.tokens[0] === tv[0] || (tf[0] && c.tokens[0] === tf[0]))
      .map((c) => ({ ...c, comunes: c.tokens.filter((t) => tv.includes(t)).length }))
      .sort((a, b) => b.comunes - a.comunes)[0];
    if (mejor && mejor.comunes > 0) return conTec(v, mejor.segmento, mejor.tecnologia);

    // Paso 3: la familia entera tiene un solo segmento en CADAM.
    const deLaFamilia = new Set(
      candidatos.filter((c) => tf[0] && c.tokens[0] === tf[0]).map((c) => c.segmento)
    );
    if (deLaFamilia.size === 1) return conTec(v, [...deLaFamilia][0], undefined);

    return conTec(v, SIN_CLASIFICAR, undefined);
  });
}
