import type { FilaRanking } from "./mercado";
// Ruta relativa y no "@/": este módulo se prueba con node suelto (sin el
// alias de tsconfig) contra datos reales antes de cada cambio.
import { tokens } from "../informes/segmento-version";
import { claseDe, ordenClase, type Clase, type OrigenClase } from "./clases";

/**
 * Mapa del mercado por CLASE × BANDA DE PRECIO: cuánto vende el mercado en
 * cada casillero y cuánto vendemos nosotros; y contra quién compite cada
 * modelo nuestro.
 *
 * Es la generalización de lo que se hizo a mano para JETOUR contra CHERY
 * (03/09/2026): el 71% del volumen de CHERY estaba debajo de US$ 21.000, y
 * ahí JETOUR vendía la mitad. Ese cruce, para todo el mercado, es el mapa
 * de dónde falta producto o precio.
 *
 * FUENTES. Las unidades son de CADAM (matriculaciones), para las dos
 * partes. Los precios no: CADAM no trae importes. Los nuestros salen del
 * stock de Cars; los de la competencia, del catálogo de terceros que releva
 * Hermes (Datacar). Un modelo sin precio en ninguna fuente no se ubica en
 * una banda: va a la columna "sin precio", que se muestra, no se esconde.
 *
 * CRUCE DE NOMBRES. CADAM escribe la versión con su propio texto ("T2 PRO
 * MAX"), Datacar con otro ("T2 PRO MAX COMFORT"). Se cruzan por palabras,
 * dentro de la misma marca: primero el nombre entero, después el candidato
 * que más palabras comparte con la primera igual (la familia); a igualdad,
 * el más barato — es el "desde" de la familia, que es lo que corresponde
 * cuando CADAM agrupó varias versiones bajo un nombre. Nunca se separa
 * letra de número: "T2" no es ["T", "2"].
 *
 * RIVALES: MISMA CLASE (06/09/2026, tercera versión). La primera listaba
 * solo el mismo casillero (tipo Y banda): para la L200 —US$ 23.674 de
 * lista— mostraba Montana, Toro, Himla y Hunter y dejaba afuera a Hilux,
 * D-Max, Frontier, BT-50 y Ranger, una banda más arriba. La segunda listó
 * todo el segmento de CADAM, y puso a la Fortuner al lado de la X50. Ni la
 * banda ni el segmento son "contra quién compite": lo es la CLASE (SUV
 * chico / compacto / mediano / grande, pick-up compacta / mediana…), que no
 * está en ninguna fuente y vive en clases.ts. El precio se muestra al lado
 * y los de la misma banda se marcan, pero el rival lo define la clase.
 */

export interface Banda {
  clave: string;
  desde: number;
  hasta: number;
  etiqueta: string;
}

export const BANDAS: Banda[] = [
  { clave: "b1", desde: 0, hasta: 15_000, etiqueta: "Menos de 15.000" },
  { clave: "b2", desde: 15_000, hasta: 21_000, etiqueta: "15.000 a 21.000" },
  { clave: "b3", desde: 21_000, hasta: 28_000, etiqueta: "21.000 a 28.000" },
  { clave: "b4", desde: 28_000, hasta: 40_000, etiqueta: "28.000 a 40.000" },
  { clave: "b5", desde: 40_000, hasta: Infinity, etiqueta: "40.000 o más" },
];
export const SIN_PRECIO = "sin precio";

export function bandaDe(precio: number | null): string {
  if (precio === null || !(precio > 0)) return SIN_PRECIO;
  return BANDAS.find((b) => precio >= b.desde && precio < b.hasta)?.clave ?? SIN_PRECIO;
}

/** "b3" -> "21.000 a 28.000"; la clave de sin precio vuelve tal cual. */
export function etiquetaBanda(clave: string): string {
  return BANDAS.find((b) => b.clave === clave)?.etiqueta ?? clave;
}

export interface PrecioCandidato {
  marca: string;
  nombre: string;
  precio: number;
}

export interface ModeloConBanda {
  marca: string;
  modelo: string;
  segmento: string;
  /** Contra quién compite: "SUV chico", "Pick-up mediana"... (clases.ts). */
  clase: Clase;
  /** De dónde salió la clase: del catálogo, inferida por precio, o el
   *  segmento pelado cuando no hay ni tabla ni precio. */
  claseOrigen: OrigenClase;
  /** "ICE", "PHEV", "ICE+PHEV"... según CADAM; undefined si no la informa. */
  tecnologia?: string;
  unidades: number;
  esPropia: boolean;
  precio: number | null;
  /** De dónde salió el precio: "cars", "datacar"... o null. */
  fuentePrecio: string | null;
  banda: string;
  deltaShare: number | null;
  variacion: number | null;
}

function normalizar(s: string): string {
  return String(s).toUpperCase().replace(/\s+/g, " ").trim();
}

/**
 * Nombre listo para cruzar: sin el guion de los códigos de modelo y sin la
 * marca repetida adelante.
 *
 * CADAM escribe "CX30", "TCROSS", "XTRAIL EPOWER", "HRV"; Datacar, "CX-30",
 * "T-CROSS", "X-TRAIL E-POWER", "HR-V". Partir por guion daba ["CX","30"]
 * contra ["CX30"] y Mazda, Volkswagen, Nissan y Honda quedaban sin precio
 * teniéndolo (06/09/2026: 199 CX30, 305 T-Cross, 173 CX5, 72 X-Trail). El
 * guion entre letra y número o entre letras se borra en las dos fuentes.
 * Y CADAM a veces repite la marca en el modelo ("MG MG ZS", "BYD BYD"):
 * se saca para que la familia sea la primera palabra real.
 */
function nombreParaCruce(nombre: string, marca: string): string {
  let n = normalizar(nombre)
    .replace(/(?<=[A-Z0-9])-(?=[A-Z0-9])/g, "")
    // "RAV 4" (Datacar) es "RAV4" (CADAM): un código corto de letras seguido
    // de un número de una o dos cifras SUELTO es una sola palabra. Suelto:
    // "TERA 1.0 MPI" no es "TERA1", ese 1 es la cilindrada.
    .replace(/\b([A-Z]{2,4}) (\d{1,2})(?=\s|$)/g, "$1$2")
    // Lynk & Co: Datacar escribe "06+", CADAM "6". El "+" y el cero adelante
    // no son parte del nombre.
    .replace(/\+/g, "")
    .replace(/\b0+(\d)/g, "$1");
  const m = normalizar(marca);
  while (m && (n === m || n.startsWith(m + " "))) n = n.slice(m.length).trim();
  return n;
}

/**
 * Le pone precio (y banda) y clase a cada modelo de CADAM con los
 * candidatos de su marca. `fuente` etiqueta de dónde salió el precio, para
 * decirlo en pantalla.
 */
export function asignarPrecios(
  modelos: FilaRanking[],
  candidatos: { fuente: string; lista: PrecioCandidato[] }[]
): ModeloConBanda[] {
  type Cand = { tokens: string[]; nombre: string; precio: number; fuente: string };
  const porMarca = new Map<string, Cand[]>();
  const exacto = new Map<string, Cand>();
  for (const grupo of candidatos) {
    for (const c of grupo.lista) {
      const marca = normalizar(c.marca);
      const nombreC = nombreParaCruce(c.nombre, marca);
      const cand: Cand = { tokens: tokens(nombreC), nombre: nombreC, precio: c.precio, fuente: grupo.fuente };
      const lista = porMarca.get(marca) ?? [];
      lista.push(cand);
      porMarca.set(marca, lista);
      const k = `${marca}|${cand.nombre}`;
      // A igualdad de nombre exacto, el más barato.
      if (!exacto.has(k) || (exacto.get(k)?.precio ?? Infinity) > c.precio) exacto.set(k, cand);
    }
  }

  return modelos.map((m) => {
    const marca = normalizar(m.marca);
    const nombre = nombreParaCruce(m.modelo ?? "", marca);
    let elegido: Cand | undefined = exacto.get(`${marca}|${nombre}`);
    if (!elegido) {
      const tm = tokens(nombre);
      const deLaMarca = porMarca.get(marca) ?? [];
      // Palabras en común DISTINTAS: "RANGER RAPTOR NUEVA RANGER RAPTOR"
      // repite RANGER y contaba dos contra el "RANGER XL" que contaba una,
      // y la Ranger quedaba con el precio de la Raptor (US$ 84.150 en vez
      // de 36.810). A igual cantidad, el más barato: el "desde".
      const puntuar = (lista: Cand[]) =>
        lista
          .map((c) => ({ c, comunes: new Set(c.tokens.filter((t) => tm.includes(t))).size }))
          .sort((a, b) => b.comunes - a.comunes || a.c.precio - b.c.precio);
      // Primero, misma familia (primera palabra igual).
      elegido = puntuar(deLaMarca.filter((c) => c.tokens[0] === tm[0])).find((x) => x.comunes > 0)?.c;
      // Después, la familia puede llevar un nombre comercial adelante en una
      // fuente y no en la otra: CADAM "EMGRAND GX3 PRO", Datacar "GX3 PRO GC".
      // Se acepta si comparten DOS palabras o más: una sola ("PRO", "4X4")
      // cruzaría cualquier cosa con cualquier cosa.
      if (!elegido) {
        elegido = puntuar(deLaMarca.filter((c) => tm.includes(c.tokens[0]))).find((x) => x.comunes >= 2)?.c;
      }
    }
    const precio = elegido?.precio ?? null;
    const segmento = m.segmento ?? "";
    const clase = claseDe({ marca: m.marca, modelo: m.modelo ?? m.marca, segmento, precio });
    return {
      marca: m.marca,
      modelo: m.modelo ?? m.marca,
      segmento,
      clase: clase.clase,
      claseOrigen: clase.origen,
      tecnologia: m.tecnologia,
      unidades: m.unidades,
      esPropia: m.esPropia,
      precio,
      fuentePrecio: elegido?.fuente ?? null,
      banda: bandaDe(precio),
      deltaShare: m.deltaShare,
      variacion: m.variacion,
    };
  });
}

export interface Celda {
  clase: Clase;
  banda: string;
  mercado: number;
  propias: number;
  /** Modelos del casillero, del que más vende al que menos. */
  modelos: ModeloConBanda[];
}

/** Casilleros clase × banda. Las clases van en el orden de exhibición
 *  (por segmento, de chico a grande), no por volumen: el mapa se lee como
 *  una góndola, y una góndola se ordena por tamaño. */
export function armarMapa(modelos: ModeloConBanda[]) {
  const celdas = new Map<string, Celda>();
  const clave = (c: string, b: string) => `${c}|${b}`;
  for (const m of modelos) {
    if (!m.clase) continue;
    const k = clave(m.clase, m.banda);
    const c = celdas.get(k) ?? { clase: m.clase, banda: m.banda, mercado: 0, propias: 0, modelos: [] };
    c.mercado += m.unidades;
    if (m.esPropia) c.propias += m.unidades;
    c.modelos.push(m);
    celdas.set(k, c);
  }
  for (const c of celdas.values()) c.modelos.sort((a, b) => b.unidades - a.unidades);

  const porClase = new Map<string, number>();
  for (const c of celdas.values()) porClase.set(c.clase, (porClase.get(c.clase) ?? 0) + c.mercado);
  const clases = [...porClase.keys()].sort((a, b) => ordenClase(a) - ordenClase(b) || a.localeCompare(b));
  return {
    celdas,
    clases,
    unidadesClase: (c: string) => porClase.get(c) ?? 0,
    celda: (c: string, b: string) => celdas.get(clave(c, b)),
  };
}

export interface Rival {
  marca: string;
  modelo: string;
  unidades: number;
  precio: number | null;
  banda: string;
  tecnologia?: string;
  /** Misma banda de precio que nuestro modelo: el rival más directo. */
  mismaBanda: boolean;
  /** La clase del rival fue inferida por precio, no por catálogo. */
  claseInferida: boolean;
  deltaShare: number | null;
}

export interface Duelo {
  propio: ModeloConBanda;
  /** TODOS los rivales de la misma clase, del que más vende al que menos.
   *  Sin recorte: quien dibuja decide cuántos mostrar de entrada. */
  rivales: Rival[];
  /** Unidades de la clase entera en el período (rivales + nuestras marcas). */
  unidadesClase: number;
  /** Cuántos rivales comparten la banda de nuestro modelo. */
  enMismaBanda: number;
}

/**
 * Para cada modelo NUESTRO: todos los rivales de su misma CLASE, del que
 * más vende al que menos, con su banda al lado. Nuestros propios modelos
 * (de cualquier marca del grupo) no son rivales entre sí.
 */
export function rivalesDirectos(modelos: ModeloConBanda[]): Duelo[] {
  const propios = modelos.filter((m) => m.esPropia && m.clase).sort((a, b) => b.unidades - a.unidades);
  const porClase = new Map<string, ModeloConBanda[]>();
  for (const m of modelos) {
    if (!m.clase) continue;
    const lista = porClase.get(m.clase) ?? [];
    lista.push(m);
    porClase.set(m.clase, lista);
  }
  return propios.map((p) => {
    const deLaClase = porClase.get(p.clase) ?? [];
    const rivales: Rival[] = deLaClase
      .filter((m) => !m.esPropia)
      .sort((a, b) => b.unidades - a.unidades)
      .map((m) => ({
        marca: m.marca,
        modelo: m.modelo,
        unidades: m.unidades,
        precio: m.precio,
        banda: m.banda,
        tecnologia: m.tecnologia,
        mismaBanda: p.banda !== SIN_PRECIO && m.banda === p.banda,
        claseInferida: m.claseOrigen !== "catalogo",
        deltaShare: m.deltaShare,
      }));
    return {
      propio: p,
      rivales,
      unidadesClase: deLaClase.reduce((s, m) => s + m.unidades, 0),
      enMismaBanda: rivales.filter((r) => r.mismaBanda).length,
    };
  });
}

function mediana(valores: number[]): number | null {
  if (valores.length < 2) return null;
  const v = [...valores].sort((a, b) => a - b);
  return v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2;
}

export interface PrecioRelativo {
  propio: ModeloConBanda;
  /** Contra los rivales de su misma clase. Positivo = estamos más caros. */
  medianaClase: number | null;
  diferenciaClase: number | null;
  rivalesClase: number;
  /** Contra TODOS los rivales con precio de su segmento de CADAM. */
  medianaTipo: number | null;
  diferenciaTipo: number | null;
  rivalesTipo: number;
}

/**
 * Precio relativo de cada modelo nuestro: contra la mediana de los rivales
 * de su misma clase (los que el comprador compara de verdad) y contra la
 * mediana de todo su segmento (dónde queda en la góndola completa). Cada
 * mediana necesita al menos dos rivales con precio.
 */
export function precioRelativo(modelos: ModeloConBanda[]): PrecioRelativo[] {
  const propios = modelos.filter((m) => m.esPropia && m.precio && m.clase);
  return propios
    .map((p) => {
      const conPrecio = modelos.filter((m) => !m.esPropia && m.precio);
      const preciosTipo = conPrecio.filter((m) => m.segmento === p.segmento).map((m) => m.precio as number);
      const preciosClase = conPrecio.filter((m) => m.clase === p.clase).map((m) => m.precio as number);
      const medianaTipo = mediana(preciosTipo);
      const medianaClase = mediana(preciosClase);
      const precio = p.precio as number;
      return {
        propio: p,
        medianaClase,
        diferenciaClase: medianaClase ? precio / medianaClase - 1 : null,
        rivalesClase: preciosClase.length,
        medianaTipo,
        diferenciaTipo: medianaTipo ? precio / medianaTipo - 1 : null,
        rivalesTipo: preciosTipo.length,
      };
    })
    .sort((a, b) => b.propio.unidades - a.propio.unidades);
}
