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
 * Dos marcas NO están en el Excel de Fernando (su base es de vehículos livianos
 * importados) y las puso Croman el 20/10/2026 porque la matriculación sí las
 * trae y la DNRA las registra con esos grupos: HINO con Toyotoshi y SCANIA con
 * Diesa.
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
  "TOYOTOSHI": ["TOYOTA", "LEXUS", "JAECOO", "OMODA", "HINO"],
  "DIESA": ["AUDI", "BYD", "HONDA", "PORSCHE", "VOLKSWAGEN", "SCANIA"],
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
 * CHEVROLET: Garden 40 %, De la Sobera 35 % y Otros 25 % (lo que sobra). Es lo
 * que Fernando le escribió a Croman («garden tiene 40 %, dls 35 % y lo demás va
 * todo en otros») y lo que Croman dejó el 20/10/2026. OJO: el Excel «base
 * mercado.xlsx» de Fernando usa 30 % para De la Sobera y 30 % para Otros en los
 * catorce meses que trae (los renglones «CHEVROLET -GARDEN», «-DLS» y «-OTHER»,
 * con el total aparte como EXCLUIR), así que con este reparto Garden, De la
 * Sobera y Otros ya no dan EXACTAMENTE las cifras de ese Excel: De la Sobera
 * suma 5 puntos de Chevrolet y Otros los pierde. Es una decisión, y cambia en
 * estos tres números.
 *
 * El ÚLTIMO de cada lista recibe lo que sobra: así las partes siempre suman el
 * total y el redondeo no inventa ni pierde chapas.
 */
export const REPARTO_POR_MARCA: Record<string, PartedeMarca[]> = {
  CHEVROLET: [
    { grupo: "GARDEN", parte: 0.4 },
    { grupo: "DE LA SOBERA", parte: 0.35 },
    { grupo: GRUPO_RESTO, parte: 0.25 },
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
 *  Cada parte se redondea (mitades hacia arriba) y la última recibe el resto:
 *  mismo criterio que el Excel de Fernando, que da 168 / 126 / 125 sobre 419
 *  chapas de Chevrolet con 40 / 30 / 30. La cuenta se hace con el porcentaje
 *  entero y no con la fracción: 0,35 × 10 en punto flotante da 3,4999… o 3,5
 *  según el caso, y el redondeo de una mitad no puede depender de eso. */
export function repartirUnidades(marca: string, unidades: number): { grupo: string; unidades: number; parte: number | null }[] {
  const m = normalizarMarca(marca);
  const reparto = REPARTO_POR_MARCA[m];
  if (!reparto) return [{ grupo: GRUPO_DE_MARCA.get(m) ?? GRUPO_RESTO, unidades, parte: null }];
  let asignado = 0;
  return reparto.map((p, i) => {
    const pct = Math.round(p.parte * 100);
    const u = i === reparto.length - 1 ? unidades - asignado : Math.floor((unidades * pct + 50) / 100);
    asignado += u;
    return { grupo: p.grupo, unidades: u, parte: p.parte };
  });
}
