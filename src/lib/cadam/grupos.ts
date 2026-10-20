/**
 * Los GRUPOS: qué marcas representa cada importador.
 *
 * Es la lista de la base de mercado de Fernando («base mercado.xlsx», que Croman
 * pasó el 20/10/2026): una fila por marca y mes con el grupo al que va. Está
 * escrita acá y no sacada de la base de CADAM por dos razones:
 *
 *  1. La base de IMPORTACIÓN de CADAM no dice quién importa (Marca | Modelo |
 *     Tipo | Fecha | Valor | Origen). La matriculación sí trae EMPRESA, pero
 *     agrupa distinto en lo chico (BAIC, Subaru, Iveco y Foton tienen empresa
 *     propia en la DNRA y para Fernando son «Otros»).
 *  2. Chevrolet no tiene un solo dueño: ver REPARTO_POR_MARCA.
 *
 * Regla de Fernando: lo que no está en la lista va TODO a Otros. Las marcas
 * nuevas, entonces, caen en Otros hasta que alguien las ponga acá; la pantalla
 * nombra las marcas de Otros para que se vea cuándo falta asignar una.
 *
 * Los nombres de marca son los de CADAM (VOLKSWAGEN y no VW, LYNK&CO sin
 * espacios), que es contra lo que se cruza.
 */

/** El grupo propio, con el nombre del Excel. */
export const GRUPO_PROPIO = "SANTA ROSA";

/** Adonde va todo lo que no está en la lista (y la parte de Chevrolet que no
 *  es de Garden ni de De la Sobera). */
export const GRUPO_RESTO = "OTROS";

export const MARCAS_POR_GRUPO: Record<string, string[]> = {
  "GARDEN": ["CHERY", "FIAT", "ICAUR", "JEEP", "KIA", "MAZDA", "MINI", "NISSAN", "RAM", "VOLVO"],
  "AUTOMOTOR": ["GEELY", "HYUNDAI", "ISUZU", "KGM", "LYNK&CO", "LOTUS", "MAHINDRA", "MASERATI"],
  "TOYOTOSHI": ["TOYOTA", "LEXUS", "JAECOO", "OMODA"],
  "DIESA": ["AUDI", "BYD", "HONDA", "PORSCHE", "VOLKSWAGEN"],
  "CHACOMER": ["DFSK", "JIM", "JMC", "SUZUKI"],
  [GRUPO_PROPIO]: [
    "GREAT WALL", "JAC", "JETOUR", "JMEV", "LEAPMOTOR", "MITSUBISHI", "RENAULT", "SOUEAST", "XPENG", "ZEEKR",
  ],
  "CONDOR": ["MAXUS", "MERCEDES BENZ", "MG"],
  "GOROSTIAGA": ["AVATR", "CHANGAN", "DEEPAL"],
  "TAPE RUVICHA": ["FORD"],
  "AUTOMAQ": ["CITROEN", "KAIYI", "PEUGEOT"],
  "PERFECTA": ["BMW"],
  "DE LA SOBERA": ["AION", "GAC"],
};

export interface PartedeMarca {
  grupo: string;
  parte: number;
}

/**
 * Marcas que no tienen un solo grupo: se reparten por porcentaje.
 *
 * CHEVROLET: el Excel de Fernando la parte en Garden 40 %, De la Sobera 30 % y
 * Otros 30 % (los renglones «CHEVROLET -GARDEN», «-DLS» y «-OTHER»; el total
 * viene aparte, como EXCLUIR). Fernando le escribió a Croman «Garden 40 %, DLS
 * 35 % y lo demás a Otros»; el Excel usa 30 % para De la Sobera en los catorce
 * meses que trae (39,7 a 40,2 / 29,6 a 30,2 / 29,7 a 30,6), así que acá va 30 %
 * hasta que lo confirme. Es un número, y cambia en una línea.
 *
 * El ÚLTIMO de cada lista recibe lo que sobra: así las partes siempre suman el
 * total y el redondeo no inventa ni pierde chapas.
 */
export const REPARTO_POR_MARCA: Record<string, PartedeMarca[]> = {
  CHEVROLET: [
    { grupo: "GARDEN", parte: 0.4 },
    { grupo: "DE LA SOBERA", parte: 0.3 },
    { grupo: GRUPO_RESTO, parte: 0.3 },
  ],
};

/** Los nombres con los que aparece una marca en otras fuentes → el de CADAM. */
const ALIAS_DE_MARCA: Record<string, string> = {
  "VW": "VOLKSWAGEN",
  "GREATWALL": "GREAT WALL",
  "LYNK & CO": "LYNK&CO",
  "LYNKCO": "LYNK&CO",
};

export function normalizarMarca(marca: string): string {
  const m = marca.trim().toUpperCase().replace(/\s+/g, " ");
  return ALIAS_DE_MARCA[m] ?? m;
}

const GRUPO_DE_MARCA = new Map<string, string>(
  Object.entries(MARCAS_POR_GRUPO).flatMap(([grupo, marcas]) => marcas.map((m) => [m, grupo] as const))
);

/** El grupo entero de una marca. Para una marca repartida (Chevrolet) devuelve
 *  el que más se lleva; para calcular unidades usar `partesDeMarca`. */
export function grupoDeMarca(marca: string): string {
  const m = normalizarMarca(marca);
  const reparto = REPARTO_POR_MARCA[m];
  if (reparto) return reparto[0].grupo;
  return GRUPO_DE_MARCA.get(m) ?? GRUPO_RESTO;
}

/** Cómo se reparten las unidades de UN mes de una marca entre grupos.
 *  Cada parte se redondea y la última recibe el resto (mismo criterio que el
 *  Excel de Fernando, que da 168 / 126 / 125 sobre 419 chapas de Chevrolet). */
export function repartirUnidades(marca: string, unidades: number): { grupo: string; unidades: number; parte: number | null }[] {
  const m = normalizarMarca(marca);
  const reparto = REPARTO_POR_MARCA[m];
  if (!reparto) return [{ grupo: GRUPO_DE_MARCA.get(m) ?? GRUPO_RESTO, unidades, parte: null }];
  let asignado = 0;
  return reparto.map((p, i) => {
    const u = i === reparto.length - 1 ? unidades - asignado : Math.round(unidades * p.parte);
    asignado += u;
    return { grupo: p.grupo, unidades: u, parte: p.parte };
  });
}
