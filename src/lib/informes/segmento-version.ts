/**
 * Segmento (SUV, Pick Up, Automóvil...) para cada versión de la gama propia.
 *
 * El segmento no existe en Cars: vive en CADAM, que para nuestras marcas
 * guarda el nombre a nivel VERSIÓN ("X50 LUXURY", "NEW H6 PHEV 4X2"), casi
 * siempre el mismo texto que Cars. Por eso el cruce va en tres pasos, del
 * más estricto al más laxo, y lo que no cruza NO se adivina: va a
 * "Sin clasificar", que es una columna honesta y no una etiqueta inventada.
 *
 *  1. Nombre completo igual, normalizado (mayúsculas, un solo espacio).
 *  2. Misma familia (modelo) y la primera palabra coincide: gana el candidato
 *     CADAM que más palabras comparte con la versión.
 *  3. Si la familia entera de Cars tiene un único segmento en CADAM, ese.
 *
 * Nunca se separa letra de número ("T2" no es ["T","2"]): mismo criterio
 * que precios-cars.ts, y por la misma razón — T1 y T2 de Jetour pasarían a
 * ser la misma cosa.
 */

export const SIN_CLASIFICAR = "Sin clasificar";

export interface ModeloCadam {
  marca: string;
  modelo: string;
  segmento: string;
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

export function asignarSegmento<T extends { marca: string; modelo: string; version: string }>(
  versiones: T[],
  cadam: ModeloCadam[]
): (T & { segmento: string })[] {
  // Índices por marca, para no comparar Jetour contra Renault.
  const exacto = new Map<string, string>();
  const porMarca = new Map<string, { tokens: string[]; segmento: string }[]>();
  for (const m of cadam) {
    if (!segmentoValido(m.segmento)) continue;
    exacto.set(`${normalizar(m.marca)}|${normalizar(m.modelo)}`, m.segmento);
    const lista = porMarca.get(normalizar(m.marca)) ?? [];
    lista.push({ tokens: tokens(m.modelo), segmento: m.segmento });
    porMarca.set(normalizar(m.marca), lista);
  }

  return versiones.map((v) => {
    const marca = normalizar(v.marca);
    const directo = exacto.get(`${marca}|${normalizar(v.version)}`);
    if (directo) return { ...v, segmento: directo };

    const candidatos = porMarca.get(marca) ?? [];
    const tv = tokens(v.version);
    const tf = tokens(v.modelo);

    // Paso 2: primera palabra igual (la familia), gana el que más comparte.
    const mejor = candidatos
      .filter((c) => c.tokens[0] === tv[0] || (tf[0] && c.tokens[0] === tf[0]))
      .map((c) => ({ ...c, comunes: c.tokens.filter((t) => tv.includes(t)).length }))
      .sort((a, b) => b.comunes - a.comunes)[0];
    if (mejor && mejor.comunes > 0) return { ...v, segmento: mejor.segmento };

    // Paso 3: la familia entera tiene un solo segmento en CADAM.
    const deLaFamilia = new Set(
      candidatos.filter((c) => tf[0] && c.tokens[0] === tf[0]).map((c) => c.segmento)
    );
    if (deLaFamilia.size === 1) return { ...v, segmento: [...deLaFamilia][0] };

    return { ...v, segmento: SIN_CLASIFICAR };
  });
}
