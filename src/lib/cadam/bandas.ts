import type { FilaRanking } from "./mercado";
// Ruta relativa y no "@/": este módulo se prueba con node suelto (sin el
// alias de tsconfig) contra datos reales antes de cada cambio.
import { tokens } from "../informes/segmento-version";

/**
 * Mapa del mercado por SEGMENTO × BANDA DE PRECIO: cuánto vende el mercado
 * en cada casillero y cuánto vendemos nosotros.
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

export interface PrecioCandidato {
  marca: string;
  nombre: string;
  precio: number;
}

export interface ModeloConBanda {
  marca: string;
  modelo: string;
  segmento: string;
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
 * Le pone precio (y banda) a cada modelo de CADAM con los candidatos de su
 * marca. `fuente` etiqueta de dónde salió, para decirlo en pantalla.
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
      const cand: Cand = { tokens: tokens(c.nombre), nombre: normalizar(c.nombre), precio: c.precio, fuente: grupo.fuente };
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
    const nombre = normalizar(m.modelo ?? "");
    let elegido: Cand | undefined = exacto.get(`${marca}|${nombre}`);
    if (!elegido) {
      const tm = tokens(nombre);
      const deLaMarca = porMarca.get(marca) ?? [];
      const puntuar = (lista: Cand[]) =>
        lista
          .map((c) => ({ c, comunes: c.tokens.filter((t) => tm.includes(t)).length }))
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
    return {
      marca: m.marca,
      modelo: m.modelo ?? m.marca,
      segmento: m.segmento ?? "",
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
  segmento: string;
  banda: string;
  mercado: number;
  propias: number;
  /** Modelos del casillero, del que más vende al que menos. */
  modelos: ModeloConBanda[];
}

/** Casilleros segmento × banda, con los totales por segmento y por banda. */
export function armarMapa(modelos: ModeloConBanda[]) {
  const celdas = new Map<string, Celda>();
  const clave = (s: string, b: string) => `${s}|${b}`;
  for (const m of modelos) {
    if (!m.segmento) continue;
    const k = clave(m.segmento, m.banda);
    const c = celdas.get(k) ?? { segmento: m.segmento, banda: m.banda, mercado: 0, propias: 0, modelos: [] };
    c.mercado += m.unidades;
    if (m.esPropia) c.propias += m.unidades;
    c.modelos.push(m);
    celdas.set(k, c);
  }
  for (const c of celdas.values()) c.modelos.sort((a, b) => b.unidades - a.unidades);

  const porSegmento = new Map<string, number>();
  for (const c of celdas.values()) porSegmento.set(c.segmento, (porSegmento.get(c.segmento) ?? 0) + c.mercado);
  const segmentos = [...porSegmento.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s);
  return { celdas, segmentos, celda: (s: string, b: string) => celdas.get(clave(s, b)) };
}

export interface Rival {
  marca: string;
  modelo: string;
  unidades: number;
  precio: number | null;
  deltaShare: number | null;
}

/**
 * Para cada modelo NUESTRO: los rivales que juegan en su mismo segmento y
 * banda, del que más vende al que menos. Es "contra quién compite este
 * auto", en la lectura más simple que existe: mismo tipo, mismo precio.
 */
export function rivalesDirectos(modelos: ModeloConBanda[], porModelo = 4) {
  const propios = modelos.filter((m) => m.esPropia && m.segmento).sort((a, b) => b.unidades - a.unidades);
  return propios.map((p) => {
    const rivales: Rival[] = modelos
      .filter((m) => !m.esPropia && m.segmento === p.segmento && m.banda === p.banda && m.banda !== SIN_PRECIO)
      .sort((a, b) => b.unidades - a.unidades)
      .slice(0, porModelo)
      .map((m) => ({ marca: m.marca, modelo: m.modelo, unidades: m.unidades, precio: m.precio, deltaShare: m.deltaShare }));
    return { propio: p, rivales };
  });
}

/**
 * Precio relativo de cada modelo nuestro contra la MEDIANA de los rivales
 * de su mismo segmento y banda. Positivo = estamos más caros.
 */
export function precioRelativo(modelos: ModeloConBanda[]) {
  const propios = modelos.filter((m) => m.esPropia && m.precio && m.segmento);
  return propios
    .map((p) => {
      const precios = modelos
        .filter((m) => !m.esPropia && m.segmento === p.segmento && m.banda === p.banda && m.precio)
        .map((m) => m.precio as number)
        .sort((a, b) => a - b);
      if (precios.length < 2) return { propio: p, mediana: null, diferencia: null, rivalesConPrecio: precios.length };
      const mediana = precios.length % 2 ? precios[(precios.length - 1) / 2]
        : (precios[precios.length / 2 - 1] + precios[precios.length / 2]) / 2;
      return { propio: p, mediana, diferencia: (p.precio as number) / mediana - 1, rivalesConPrecio: precios.length };
    })
    .sort((a, b) => b.propio.unidades - a.propio.unidades);
}
