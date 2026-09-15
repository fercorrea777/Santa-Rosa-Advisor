import fs from "node:fs";
import path from "node:path";

/**
 * Acciones comerciales del mes: el Excel de Fernando ("ACCIONES
 * COMERCIALES SEPTIEMBRE.xlsx", una hoja por marca), tal cual lo arma él.
 * Por cada versión: precio de lista, descuento máximo, precio con
 * descuento, margen, seña, bono al vendedor y la mecánica de la acción;
 * más los totales de stock y las notas al pie de cada hoja (venta de
 * cartera, escalas de comisiones, premios grupales).
 *
 * Pedido de Fernando (15/09/2026): "cargar las acciones comerciales en
 * nuestro dashboard", en un apartado SANTA ROSA junto con Gama propia.
 *
 * Decisión: el Advisor MUESTRA lo que dice el Excel; no recalcula márgenes
 * ni corrige fórmulas. El dueño de la planilla es Fernando. Hermes lo
 * empuja cuando el archivo cambia (advisor-acciones.py) y acá se guarda
 * UN MES POR PUSH, conservando los anteriores: en octubre se ve octubre y
 * se puede volver a septiembre.
 *
 * Vive en un JSON al lado de parametros.json (el volumen /datos en
 * producción, ./data en local), igual que batalla.json: es un dato que
 * escribe la app, no config.
 */

export interface AccionVersion {
  marca: string;
  version: string;
  segmento: string | null;
  /** Promedio de ventas por mes, como lo tiene Fernando. */
  avg_ventas: number | null;
  stock: number | null;
  en_viaje: number | null;
  /** Solo Mitsubishi: lo que se vende mayorista a Nipon y lo que queda. */
  wholesale_nipon: number | null;
  stock_final: number | null;
  pvp: number | null;
  /** Cuando el PVP no es un número ("sin definicion"). */
  pvp_texto: string | null;
  pvp_sin_iva: number | null;
  costo: number | null;
  margen_neto: number | null;
  vme: number | null;
  margen: number | null;
  margen_pct: number | null;
  descuento: number | null;
  precio_descuento: number | null;
  precio_descuento_sin_iva: number | null;
  margen_descuento: number | null;
  margen_descuento_pct: number | null;
  senia: number | null;
  precio_max_comision: number | null;
  bono: number | null;
  /** El bono cuando no es un número ("300 por vender 4 unidades…"). */
  bono_texto: string | null;
  observaciones: string | null;
  soporte_fob: number | null;
  soporte_venta: number | null;
  soporte_total: number | null;
  margen_soporte: number | null;
  margen_soporte_pct: number | null;
}

export interface HojaAcciones {
  /** Nombre CADAM de la marca. */
  marca: string;
  hoja: string;
  /** Claves que la hoja trae en su fila de encabezados. */
  columnas: string[];
  versiones: AccionVersion[];
  totales: {
    stock?: number;
    en_viaje?: number;
    wholesale_nipon?: number;
    stock_final?: number;
    bono?: number;
    observaciones?: string;
  };
  /** Las líneas al pie de la hoja, tal cual (celdas unidas con «·»). */
  notas: string[];
}

export interface AccionesMes {
  archivo: string;
  modificado: string;
  cargado_en: string;
  /** "2026-09". */
  mes: string;
  titulo: string;
  hojas: HojaAcciones[];
}

interface ArchivoAcciones {
  meses: Record<string, AccionesMes>;
}

/** Claves numéricas de una versión, en el orden en que van en el Excel. */
export const CAMPOS_NUMERICOS: (keyof AccionVersion)[] = [
  "avg_ventas", "stock", "en_viaje", "wholesale_nipon", "stock_final", "pvp",
  "pvp_sin_iva", "costo", "margen_neto", "vme", "margen", "margen_pct",
  "descuento", "precio_descuento", "precio_descuento_sin_iva",
  "margen_descuento", "margen_descuento_pct", "senia", "precio_max_comision",
  "bono", "soporte_fob", "soporte_venta", "soporte_total", "margen_soporte",
  "margen_soporte_pct",
];

function resolverRuta(): string {
  if (process.env.CADAM_PARAMETROS_PATH) {
    return path.join(path.dirname(process.env.CADAM_PARAMETROS_PATH), "acciones-comerciales.json");
  }
  const vivo = path.join(process.cwd(), "..", "CADAM", "parametros.json");
  if (fs.existsSync(vivo)) return path.join(path.dirname(vivo), "acciones-comerciales.json");
  return path.join(process.cwd(), "data", "acciones-comerciales.json");
}

let cached: { mtimeMs: number; valor: ArchivoAcciones } | null = null;

function leerArchivo(): ArchivoAcciones {
  const ruta = resolverRuta();
  if (!fs.existsSync(ruta)) return { meses: {} };
  const mtimeMs = fs.statSync(ruta).mtimeMs;
  if (!cached || cached.mtimeMs !== mtimeMs) {
    const crudo = JSON.parse(fs.readFileSync(ruta, "utf-8")) as Partial<ArchivoAcciones>;
    cached = { mtimeMs, valor: { meses: crudo.meses ?? {} } };
  }
  return cached.valor;
}

/** Meses cargados, del más nuevo al más viejo. */
export function getMesesAcciones(): string[] {
  return Object.keys(leerArchivo().meses).sort().reverse();
}

/** El mes pedido, o el más nuevo si no se pide ninguno. null si nunca se
 *  cargó nada. */
export function getAcciones(mes?: string | null): AccionesMes | null {
  const a = leerArchivo();
  if (mes && a.meses[mes]) return a.meses[mes];
  const ultimo = getMesesAcciones()[0];
  return ultimo ? a.meses[ultimo] : null;
}

/** Guarda (o reemplaza) un mes. Escritura atómica (tmp + rename). */
export function guardarAcciones(a: AccionesMes): void {
  const ruta = resolverRuta();
  const actual = leerArchivo();
  const meses = { ...actual.meses, [a.mes]: a };
  fs.mkdirSync(path.dirname(ruta), { recursive: true });
  const tmp = `${ruta}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ meses }, null, 2) + "\n", "utf-8");
  fs.renameSync(tmp, ruta);
  cached = null;
}

/** "2026-09" → "Septiembre 2026". */
export function nombreMes(mes: string): string {
  const NOMBRES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ];
  const [a, m] = mes.split("-").map(Number);
  return m >= 1 && m <= 12 ? `${NOMBRES[m - 1]} ${a}` : mes;
}

export interface ResumenAcciones {
  versiones: number;
  conDescuento: number;
  conBono: number;
  conMecanica: number;
  stock: number;
  enViaje: number;
  /** Σ stock × descuento máximo: lo que costaría vender todo el stock al
   *  precio con descuento. Es una cota, no un pronóstico. */
  descuentoComprometido: number;
  /** Descuento sobre el PVP, ponderado por stock (solo versiones con
   *  stock y PVP). null si no hay stock con precio. */
  descuentoMedio: number | null;
  marcas: number;
}

export function resumirAcciones(a: AccionesMes): ResumenAcciones {
  const r: ResumenAcciones = {
    versiones: 0, conDescuento: 0, conBono: 0, conMecanica: 0, stock: 0, enViaje: 0,
    descuentoComprometido: 0, descuentoMedio: null, marcas: a.hojas.length,
  };
  let pvpPonderado = 0;
  let dctoPonderado = 0;
  for (const h of a.hojas) {
    for (const v of h.versiones) {
      r.versiones++;
      if ((v.descuento ?? 0) > 0) r.conDescuento++;
      if ((v.bono ?? 0) > 0 || v.bono_texto) r.conBono++;
      if (v.observaciones) r.conMecanica++;
      r.stock += v.stock ?? 0;
      r.enViaje += v.en_viaje ?? 0;
      r.descuentoComprometido += (v.stock ?? 0) * (v.descuento ?? 0);
      if ((v.stock ?? 0) > 0 && (v.pvp ?? 0) > 0) {
        pvpPonderado += (v.stock ?? 0) * (v.pvp ?? 0);
        dctoPonderado += (v.stock ?? 0) * (v.descuento ?? 0);
      }
    }
  }
  r.descuentoMedio = pvpPonderado > 0 ? dctoPonderado / pvpPonderado : null;
  return r;
}
