import { hoyEnAsuncion } from "@/lib/format";
import type { StockPropio, VentaPropia } from "@/lib/informes/propios";

/**
 * Meses de stock por VERSIÓN, y qué hacer con cada una.
 *
 * Es la herramienta del pedido de stock. "Meses de stock" por marca (que ya
 * está en /operacion) no alcanza para pedir: se pide una versión, no una
 * marca. Acá cada versión tiene su ritmo de venta, lo que hay libre hoy, lo
 * que viene en viaje, y una acción en una palabra.
 *
 * DEFINICIONES, en palabras de negocio:
 *  - Ritmo: autos por mes, promedio de los ÚLTIMOS TRES MESES CERRADOS. El
 *    mes en curso no entra: a mitad de mes tiene la mitad de las ventas y
 *    haría parecer que todo se vende más lento.
 *  - Libres: unidades vendibles hoy, sin las reservadas. "Vendible" es todo
 *    estado menos EN VIAJE (todavía no llegó), TEST DRIVE, CORTESÍA y NO
 *    DISPONIBLE (no se pueden entregar).
 *  - Meses de stock: libres ÷ ritmo. Con ritmo menor a RITMO_MINIMO no se
 *    calcula: 12 unidades a 1 por mes son "12 meses" y también podrían irse
 *    todas la semana que viene.
 *  - Qué hacer:
 *      pedir    → menos de 1,5 meses libres y, aun sumando lo que viene en
 *                 viaje, menos de 3.
 *      llega    → menos de 1,5 meses libres, pero en viaje viene suficiente.
 *      empujar  → más de 6 meses de stock con al menos 5 unidades libres, o
 *                 5+ libres y ritmo bajo (no se mueve): promoción, no pedido.
 *      ok       → el resto.
 */

export const RITMO_MINIMO = 3;
export const PEDIR_ANTES_DE = 1.5;
export const EMPUJAR_DESDE = 6;
export const LIBRES_MINIMAS_EMPUJAR = 5;

const EN_VIAJE = new Set(["EN VIAJE"]);
const NO_VENDIBLE = new Set(["TEST DRIVE", "CORTESÍA", "CORTESIA", "NO DISPONIBLE"]);

export type Accion = "pedir" | "llega" | "empujar" | "ok" | "sin ritmo";

export interface CoberturaVersion {
  marca: string;
  /** Familia ("X70"). */
  modelo: string;
  version: string;
  precio_usd: number | null;
  libres: number;
  reservadas: number;
  enViaje: number;
  noVendible: number;
  /** Autos por mes, últimos tres meses cerrados. */
  ritmo: number;
  /** Vendidos en cada uno de los tres meses, del más viejo al más nuevo. */
  ultimosTres: number[];
  /** null cuando el ritmo no alcanza para que el cociente signifique algo. */
  meses: number | null;
  mesesConViaje: number | null;
  accion: Accion;
}

export interface Cobertura {
  versiones: CoberturaVersion[];
  /** Los tres meses cerrados que se usaron, YYYY-MM. */
  mesesRitmo: string[];
  pedir: CoberturaVersion[];
  empujar: CoberturaVersion[];
}

/** Los tres meses cerrados anteriores a `hoy` (YYYY-MM-DD). */
export function tresMesesCerrados(hoy = hoyEnAsuncion()): string[] {
  const [a, m] = hoy.split("-").map(Number);
  const meses: string[] = [];
  let anio = a;
  let mes = m;
  for (let i = 0; i < 3; i++) {
    mes -= 1;
    if (mes === 0) {
      mes = 12;
      anio -= 1;
    }
    meses.unshift(`${anio}-${String(mes).padStart(2, "0")}`);
  }
  return meses;
}

export function calcularCobertura(
  stock: StockPropio[],
  ventas: VentaPropia[],
  hoy = hoyEnAsuncion()
): Cobertura {
  const mesesRitmo = tresMesesCerrados(hoy);

  type Acum = Omit<CoberturaVersion, "ritmo" | "meses" | "mesesConViaje" | "accion">;
  const porVersion = new Map<string, Acum>();
  const clave = (marca: string, version: string) => `${marca}|${version}`;
  const entrada = (marca: string, modelo: string, version: string): Acum => {
    const k = clave(marca, version);
    let x = porVersion.get(k);
    if (!x) {
      x = {
        marca, modelo, version, precio_usd: null,
        libres: 0, reservadas: 0, enViaje: 0, noVendible: 0,
        ultimosTres: [0, 0, 0],
      };
      porVersion.set(k, x);
    }
    return x;
  };

  for (const s of stock) {
    const x = entrada(s.marca, s.modelo, s.version);
    if (s.precio_usd && !x.precio_usd) x.precio_usd = s.precio_usd;
    const estado = s.estado.toUpperCase();
    if (EN_VIAJE.has(estado)) x.enViaje += s.unidades;
    else if (NO_VENDIBLE.has(estado)) x.noVendible += s.unidades;
    else {
      x.libres += s.unidades;
      x.reservadas += s.reservadas;
    }
  }
  for (const v of ventas) {
    const i = mesesRitmo.indexOf(v.periodo);
    if (i === -1) continue;
    const x = entrada(v.marca, v.modelo, v.version);
    x.ultimosTres[i] += v.unidades;
  }

  const versiones: CoberturaVersion[] = [...porVersion.values()].map((x) => {
    // Las reservadas ya tienen dueño: no cuentan como libres.
    const libres = Math.max(0, x.libres - x.reservadas);
    const ritmo = x.ultimosTres.reduce((s, n) => s + n, 0) / 3;
    const conRitmo = ritmo >= RITMO_MINIMO;
    const meses = conRitmo ? libres / ritmo : null;
    const mesesConViaje = conRitmo ? (libres + x.enViaje) / ritmo : null;
    let accion: Accion;
    if (!conRitmo) {
      accion = libres >= LIBRES_MINIMAS_EMPUJAR && ritmo < 1 ? "empujar" : "sin ritmo";
    } else if ((meses as number) < PEDIR_ANTES_DE) {
      accion = (mesesConViaje as number) < 3 ? "pedir" : "llega";
    } else if ((meses as number) > EMPUJAR_DESDE && libres >= LIBRES_MINIMAS_EMPUJAR) {
      accion = "empujar";
    } else {
      accion = "ok";
    }
    return { ...x, libres, ritmo, meses, mesesConViaje, accion };
  });

  // Pedir: primero lo que más vende (es lo que más duele quedarse sin).
  // Empujar: primero lo que más plata tiene parada (unidades × precio).
  const pedir = versiones
    .filter((v) => v.accion === "pedir")
    .sort((a, b) => b.ritmo - a.ritmo);
  const empujar = versiones
    .filter((v) => v.accion === "empujar")
    .sort((a, b) => b.libres * (b.precio_usd ?? 1) - a.libres * (a.precio_usd ?? 1));

  return { versiones, mesesRitmo, pedir, empujar };
}

/** Etiqueta en palabras para la columna "Qué hacer". */
export function etiquetaAccion(a: Accion): string {
  switch (a) {
    case "pedir": return "Pedir";
    case "llega": return "Llega en viaje";
    case "empujar": return "Empujar (promo)";
    case "ok": return "Bien";
    case "sin ritmo": return "Vende poco";
  }
}
