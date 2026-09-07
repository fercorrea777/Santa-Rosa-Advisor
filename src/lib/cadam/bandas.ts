import type { FilaRanking } from "./mercado";
// Ruta relativa y no "@/": este módulo se prueba con node suelto (sin el
// alias de tsconfig) contra datos reales antes de cada cambio.
import { tokens } from "../informes/segmento-version";
import { claseDe, ordenClase, type Clase, type OrigenClase } from "./clases";
import { transmisionDe } from "../informes/transmision";

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
  /** Del mismo período del año anterior. Para la ficha del modelo. */
  unidadesAnterior?: number;
  esPropia: boolean;
  precio: number | null;
  /** "Desde" mecánico y "desde" automático de la misma familia, leídos del
   *  nombre de cada versión (Fernando, 07/09/2026: comparar el desde de uno
   *  con el desde del otro no es justo si uno es MT y el otro AT). null si
   *  ninguna versión con precio dice su transmisión. */
  precioMT: number | null;
  precioAT: number | null;
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
  // HAVAL es la LÍNEA de GWM, no el modelo: CADAM registra "HAVAL JOLION" y
  // "HAVAL H6 GT DELUXE PHEV", Cars vende "JOLION PRO HEV DELUXE" y "NEW H6
  // HEV". Con el prefijo puesto no cruzan —comparten una sola palabra— y 180
  // unidades nuestras quedaban sin precio de lista (06/09/2026).
  if (m === "GREAT WALL" && n.startsWith("HAVAL ")) n = n.slice(6).trim();
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
    // Precio por transmisión: entre los candidatos de la misma FAMILIA
    // (primera palabra), el más barato que diga MT y el más barato que diga
    // AT / CVT / DCT o sea híbrido o eléctrico. Lo que no dice nada cuenta
    // para el "desde" y para ninguno de los dos.
    const familiaTok = elegido?.tokens[0] ?? tokens(nombre)[0];
    const familia = familiaTok
      ? (porMarca.get(marca) ?? []).filter((c) => c.tokens[0] === familiaTok)
      : [];
    const masBarato = (t: "MT" | "AT") =>
      familia
        .filter((c) => transmisionDe(c.nombre, marca) === t)
        .reduce<number | null>((min, c) => (min === null || c.precio < min ? c.precio : min), null);
    const precioMT = masBarato("MT");
    const precioAT = masBarato("AT");
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
      unidadesAnterior: m.unidadesAnterior,
      esPropia: m.esPropia,
      precio,
      precioMT,
      precioAT,
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

/**
 * Qué hacer en un casillero. El mapa tiñe según nuestra participación, pero
 * un color no es una decisión: un casillero claro de 15 unidades no es una
 * oportunidad y uno oscuro de 20 tampoco es una fortaleza. La acción sale
 * de cruzar CUÁNTO PESA el casillero en el mercado con CUÁNTO es nuestro.
 *
 *   pesa en el mercado y no estamos   -> entrar
 *   pesa en NUESTRO negocio y mandamos -> defender
 *   el resto                          -> nada que decir
 *
 * LAS DOS VARAS NO SON LA MISMA, Y ESO IMPORTA. "Entrar" se mide contra el
 * mercado: un casillero que mueve el 13% de todo lo que se vendió y donde
 * tenemos el 0,6% es una oportunidad, aunque para nosotros hoy no exista.
 * "Defender" NO se puede medir así: el grupo tiene el 5,9% del mercado
 * paraguayo, con lo cual jamás va a tener el 20% de un casillero que pese el
 * 3% del mercado, y con esa vara la mitad "fuerte" del mapa quedaba siempre
 * vacía (06/09/2026). Lo que hay que defender es donde está NUESTRO volumen
 * y además mandamos: 248 unidades de las 1.990 del período, con el 48% del
 * casillero, es una fortaleza aunque el casillero sea chico para el mercado.
 */
export type AccionCasillero = "entrar" | "defender";

/** Un casillero "pesa" cuando es al menos esto del mercado del mapa. */
export const PESO_RELEVANTE = 0.03;
/** ...y pesa para nosotros cuando es al menos esto de lo que vendemos. */
export const PESO_PROPIO = 0.05;
/** Debajo de esta participación, no estamos en el casillero. */
export const SHARE_AUSENTE = 0.05;
/** Desde esta participación, mandamos. */
export const SHARE_FUERTE = 0.2;

export interface LecturaCasillero {
  celda: Celda;
  /** Qué parte del mercado del mapa es este casillero. */
  peso: number;
  /** Qué parte de NUESTRO volumen del mapa sale de este casillero. */
  pesoPropio: number;
  /** Qué parte del casillero es nuestra. */
  share: number;
  accion: AccionCasillero | null;
  /** Los que más venden ahí y no son nuestros: qué habría que traer. */
  rivales: ModeloConBanda[];
  /** Nuestros modelos en el casillero. */
  propios: ModeloConBanda[];
  /**
   * Mediana de precio adentro del casillero. Acá alcanza UN precio: el
   * casillero es una lista corta y concreta, y decir "—" mientras la tabla
   * de abajo muestra el precio de nuestro único modelo es mentirle al que
   * mira. Cuántos precios la sostienen va al lado, en `nPrecios*`.
   */
  precioNuestro: number | null;
  precioRival: number | null;
  nPreciosNuestros: number;
  nPreciosRivales: number;
  /** Positivo = estamos caros contra la mediana del casillero. */
  diferencia: number | null;
}

export function lecturaCasillero(
  celda: Celda,
  totalMercado: number,
  totalPropias = 0
): LecturaCasillero {
  const peso = totalMercado ? celda.mercado / totalMercado : 0;
  const pesoPropio = totalPropias ? celda.propias / totalPropias : 0;
  const share = celda.mercado ? celda.propias / celda.mercado : 0;
  const rivales = celda.modelos.filter((m) => !m.esPropia);
  const propios = celda.modelos.filter((m) => m.esPropia);
  const preciosNuestros = propios.map((m) => m.precio).filter((p): p is number => !!p);
  const preciosRivales = rivales.map((m) => m.precio).filter((p): p is number => !!p);
  const precioNuestro = medianaDe(preciosNuestros);
  const precioRival = medianaDe(preciosRivales);
  const accion: AccionCasillero | null =
    peso >= PESO_RELEVANTE && share < SHARE_AUSENTE ? "entrar"
      : pesoPropio >= PESO_PROPIO && share >= SHARE_FUERTE ? "defender"
      : null;
  return {
    celda, peso, pesoPropio, share, accion, rivales, propios, precioNuestro, precioRival,
    nPreciosNuestros: preciosNuestros.length,
    nPreciosRivales: preciosRivales.length,
    diferencia: precioNuestro && precioRival ? precioNuestro / precioRival - 1 : null,
  };
}

/** Mediana con un solo valor permitido: el de una lista de uno es ese. */
function medianaDe(valores: number[]): number | null {
  if (!valores.length) return null;
  const v = [...valores].sort((a, b) => a - b);
  return v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2;
}

/**
 * La ficha de un modelo para abrirla desde un gráfico: qué es, contra quién
 * compite y a qué precio. Es lo mismo que muestra el detalle de un casillero
 * del mapa, pero centrado en un modelo, para que una burbuja se pueda tocar
 * y contestar "¿y este quién es?" sin cambiar de pantalla.
 */
export interface CompetidorModelo {
  marca: string;
  modelo: string;
  unidades: number;
  precio: number | null;
  precioMT: number | null;
  precioAT: number | null;
  tecnologia?: string;
  esPropia: boolean;
}

export interface DetalleModelo {
  marca: string;
  modelo: string;
  clase: Clase;
  claseInferida: boolean;
  tecnologia?: string;
  esPropia: boolean;
  unidades: number;
  unidadesAnterior: number;
  variacion: number | null;
  deltaShare: number | null;
  precio: number | null;
  precioMT: number | null;
  precioAT: number | null;
  banda: string;
  /** La clase entera en el período, y qué parte de ella es este modelo. */
  unidadesClase: number;
  parteClase: number;
  /** Mediana de precio de los OTROS de su clase, y cuántos la sostienen. */
  medianaClase: number | null;
  nPreciosClase: number;
  diferencia: number | null;
  /** Lo mismo, pero mecánico contra mecánico y automático contra
   *  automático: la comparación justa (Fernando, 07/09/2026). */
  medianaClaseMT: number | null;
  nPreciosMT: number;
  medianaClaseAT: number | null;
  nPreciosAT: number;
  /** Los que más venden en su clase, sin contarlo a él. */
  competidores: CompetidorModelo[];
  competidoresTotal: number;
}

export const claveModelo = (marca: string, modelo: string) =>
  `${normalizar(marca)}|${normalizar(modelo)}`;

/**
 * Un modelo, plano, para viajar al navegador.
 *
 * POR QUÉ PLANO Y NO LA FICHA ARMADA. La ficha lleva hasta doce rivales
 * adentro, y en un ranking de 500 modelos eso repite cada rival decenas de
 * veces: la página pasó de 550 KB a 2,2 MB (06/09/2026). Con la lista plana
 * viaja cada modelo UNA vez y la ficha se arma en el navegador, solo para
 * el que se toca. La cuenta es la misma; lo que cambia es qué se manda.
 */
export interface ModeloFicha {
  clave: string;
  marca: string;
  modelo: string;
  clase: Clase;
  claseInferida: boolean;
  tecnologia?: string;
  esPropia: boolean;
  unidades: number;
  unidadesAnterior: number;
  variacion: number | null;
  deltaShare: number | null;
  precio: number | null;
  precioMT: number | null;
  precioAT: number | null;
  banda: string;
}

export function fichasDeModelos(universo: ModeloConBanda[]): ModeloFicha[] {
  const vistos = new Set<string>();
  const salida: ModeloFicha[] = [];
  for (const m of universo) {
    const clave = claveModelo(m.marca, m.modelo);
    if (!m.clase || vistos.has(clave)) continue;
    vistos.add(clave);
    salida.push({
      clave,
      marca: m.marca,
      modelo: m.modelo,
      clase: m.clase,
      claseInferida: m.claseOrigen !== "catalogo",
      tecnologia: m.tecnologia,
      esPropia: m.esPropia,
      unidades: m.unidades,
      unidadesAnterior: m.unidadesAnterior ?? 0,
      variacion: m.variacion,
      deltaShare: m.deltaShare,
      precio: m.precio,
      precioMT: m.precioMT,
      precioAT: m.precioAT,
      banda: m.banda,
    });
  }
  return salida;
}

/** La ficha de UN modelo, armada al momento de tocarlo. */
export function detalleDeFicha(
  fichas: ModeloFicha[],
  clave: string,
  topCompetidores = 12
): DetalleModelo | undefined {
  const m = fichas.find((x) => x.clave === clave);
  if (!m) return undefined;
  const deLaClase = fichas.filter((x) => x.clase === m.clase);
  const otros = deLaClase
    .filter((x) => x.clave !== clave)
    .sort((a, b) => b.unidades - a.unidades);
  const precios = otros.map((x) => x.precio).filter((p): p is number => !!p);
  const medianaClase = medianaDe(precios);
  const preciosMT = otros.map((x) => x.precioMT).filter((p): p is number => !!p);
  const preciosAT = otros.map((x) => x.precioAT).filter((p): p is number => !!p);
  const unidadesClase = deLaClase.reduce((s, x) => s + x.unidades, 0);
  return {
    marca: m.marca,
    modelo: m.modelo,
    clase: m.clase,
    claseInferida: m.claseInferida,
    tecnologia: m.tecnologia,
    esPropia: m.esPropia,
    unidades: m.unidades,
    unidadesAnterior: m.unidadesAnterior,
    variacion: m.variacion,
    deltaShare: m.deltaShare,
    precio: m.precio,
    precioMT: m.precioMT,
    precioAT: m.precioAT,
    banda: m.banda,
    unidadesClase,
    parteClase: unidadesClase ? m.unidades / unidadesClase : 0,
    medianaClase,
    nPreciosClase: precios.length,
    diferencia: m.precio && medianaClase ? m.precio / medianaClase - 1 : null,
    medianaClaseMT: medianaDe(preciosMT),
    nPreciosMT: preciosMT.length,
    medianaClaseAT: medianaDe(preciosAT),
    nPreciosAT: preciosAT.length,
    competidores: otros.slice(0, topCompetidores).map((x) => ({
      marca: x.marca, modelo: x.modelo, unidades: x.unidades, precio: x.precio,
      precioMT: x.precioMT, precioAT: x.precioAT,
      tecnologia: x.tecnologia, esPropia: x.esPropia,
    })),
    competidoresTotal: otros.length,
  };
}

export interface Rival {
  marca: string;
  modelo: string;
  unidades: number;
  precio: number | null;
  /** "Desde" mecánico y automático (ver ModeloConBanda). */
  precioMT: number | null;
  precioAT: number | null;
  banda: string;
  tecnologia?: string;
  /** Misma banda de precio que nuestro modelo: el rival más directo. */
  mismaBanda: boolean;
  /** Tiene precio en la MISMA CAJA que compara nuestro modelo (Fernando,
   *  07/09/2026: un automático se compara con un automático). null cuando
   *  nuestro modelo no tiene caja conocida y no hay con qué comparar. */
  mismaCaja: boolean | null;
  /** Su precio en esa caja, para verlo al lado del "desde". */
  precioCaja: number | null;
  /** La clase del rival fue inferida por precio, no por catálogo. */
  claseInferida: boolean;
  deltaShare: number | null;
}

export interface Duelo {
  propio: ModeloConBanda;
  /** Con qué caja se compara este modelo: la que tiene (automático si tiene
   *  las dos, que es lo que más se vende) o "desde" si no dice ninguna. */
  caja: "AT" | "MT" | null;
  /** TODOS los rivales de la misma clase, del que más vende al que menos.
   *  Sin recorte: quien dibuja decide cuántos mostrar de entrada. */
  rivales: Rival[];
  /** Unidades de la clase entera en el período (rivales + nuestras marcas). */
  unidadesClase: number;
  /** Cuántos rivales comparten la banda de nuestro modelo. */
  enMismaBanda: number;
  /** Cuántos tienen precio en la misma caja. */
  enMismaCaja: number;
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
    // La caja de nuestro modelo: automático si lo tiene (es lo que más se
    // vende), si no mecánico, si no ninguna.
    const caja: "AT" | "MT" | null = p.precioAT ? "AT" : p.precioMT ? "MT" : null;
    const rivales: Rival[] = deLaClase
      .filter((m) => !m.esPropia)
      .sort((a, b) => b.unidades - a.unidades)
      .map((m) => {
        const precioCaja = caja === "AT" ? m.precioAT : caja === "MT" ? m.precioMT : null;
        return {
          marca: m.marca,
          modelo: m.modelo,
          unidades: m.unidades,
          precio: m.precio,
          precioMT: m.precioMT,
          precioAT: m.precioAT,
          banda: m.banda,
          tecnologia: m.tecnologia,
          mismaBanda: p.banda !== SIN_PRECIO && m.banda === p.banda,
          mismaCaja: caja === null ? null : precioCaja !== null,
          precioCaja,
          claseInferida: m.claseOrigen !== "catalogo",
          deltaShare: m.deltaShare,
        };
      });
    return {
      propio: p,
      caja,
      rivales,
      unidadesClase: deLaClase.reduce((s, m) => s + m.unidades, 0),
      enMismaBanda: rivales.filter((r) => r.mismaBanda).length,
      enMismaCaja: rivales.filter((r) => r.mismaCaja).length,
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
  /** Con qué precio se compara: automático contra automático si nuestro
   *  modelo tiene versión AT y hay al menos dos rivales con AT; si no,
   *  mecánico; si no, el "desde" de cada uno (Fernando, 07/09/2026). */
  base: "AT" | "MT" | "desde";
  precioBase: number;
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
  const rivales = modelos.filter((m) => !m.esPropia);
  const preciosDe = (lista: ModeloConBanda[], base: "AT" | "MT" | "desde") =>
    lista
      .map((m) => (base === "AT" ? m.precioAT : base === "MT" ? m.precioMT : m.precio))
      .filter((v): v is number => !!v);
  return propios
    .map((p) => {
      // Mecánico con mecánico, automático con automático; "desde" contra
      // "desde" solo cuando no hay con qué.
      const deLaClase = rivales.filter((m) => m.clase === p.clase);
      const base: "AT" | "MT" | "desde" =
        p.precioAT && preciosDe(deLaClase, "AT").length >= 2
          ? "AT"
          : p.precioMT && preciosDe(deLaClase, "MT").length >= 2
            ? "MT"
            : "desde";
      const precio = (base === "AT" ? p.precioAT : base === "MT" ? p.precioMT : p.precio) as number;
      const preciosTipo = preciosDe(rivales.filter((m) => m.segmento === p.segmento), base);
      const preciosClase = preciosDe(deLaClase, base);
      const medianaTipo = mediana(preciosTipo);
      const medianaClase = mediana(preciosClase);
      return {
        propio: p,
        base,
        precioBase: precio,
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
