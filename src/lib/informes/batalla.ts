import fs from "node:fs";
import path from "node:path";

/**
 * "Batalla por modelo": el bubble chart del equipo de producto, tal cual
 * lo arma en su Excel (JETOUR_PY_BBCH_*.xlsx). Por cada modelo nuestro,
 * las versiones rivales que ELLOS eligieron, con precio, medidas,
 * matriculaciones e importaciones, y cómo está dibujado: el orden y color
 * de cada marca, el rango del eje de precio y qué volumen da el tamaño.
 *
 * Decisión (07/09/2026): el Advisor dibuja exactamente lo que dice el
 * Excel. No cruza con CADAM ni Datacar; el dueño de la lista es producto.
 * Hermes lo empuja cuando el archivo cambia (advisor-batalla.py).
 *
 * Vive en un JSON al lado de parametros.json (el volumen /datos en
 * producción, ./data en local): es un dato que escribe la app, no config.
 */

export interface VersionBatalla {
  marca: string;
  version: string;
  medidas: string;
  precio: number;
  matriculaciones: number;
  importaciones: number;
}

export interface ModeloBatalla {
  /** Marca NUESTRA a la que pertenece el modelo (nombre CADAM), según el
   *  archivo del que salió: un Excel por marca. */
  marca_propia: string;
  /** Archivo del que salió la hoja. */
  archivo?: string;
  hoja: string;
  /** Nombre de la pestaña, limpio ("G700", "X70 Plus"): es el que vale. */
  modelo: string;
  /** Lo que dice la celda "Modelo" de la hoja, que a veces quedó vieja
   *  ("Dargo / Tank 300" en la hoja de G700). Solo informativo. */
  modelo_celda?: string;
  titulo: string;
  periodo: string;
  /** Qué columna del Excel da el tamaño de la burbuja. */
  tamano: "importaciones" | "matriculaciones";
  eje_precio: { min: number | null; max: number | null };
  /** En el orden de la planilla (la columna de cada marca), con su color. */
  marcas: { marca: string; color: string | null }[];
  versiones: VersionBatalla[];
}

export interface ArchivoBatalla {
  archivo: string;
  modificado: string;
  marca_propia: string;
  modelos: number;
}

export interface Batalla {
  /** Resumen ("15 archivos BBCH") — el detalle va en `archivos`. */
  archivo: string;
  modificado: string;
  cargado_en: string;
  archivos?: ArchivoBatalla[];
  modelos: ModeloBatalla[];
}

function resolverRuta(): string {
  if (process.env.CADAM_PARAMETROS_PATH) {
    return path.join(path.dirname(process.env.CADAM_PARAMETROS_PATH), "batalla.json");
  }
  const vivo = path.join(process.cwd(), "..", "CADAM", "parametros.json");
  if (fs.existsSync(vivo)) return path.join(path.dirname(vivo), "batalla.json");
  return path.join(process.cwd(), "data", "batalla.json");
}

let cached: { mtimeMs: number; valor: Batalla } | null = null;

export function getBatalla(): Batalla | null {
  const ruta = resolverRuta();
  if (!fs.existsSync(ruta)) return null;
  const mtimeMs = fs.statSync(ruta).mtimeMs;
  if (!cached || cached.mtimeMs !== mtimeMs) {
    cached = { mtimeMs, valor: JSON.parse(fs.readFileSync(ruta, "utf-8")) as Batalla };
  }
  return cached.valor;
}

/** Escritura atómica (tmp + rename), como parametros.json. */
export function guardarBatalla(b: Batalla): void {
  const ruta = resolverRuta();
  fs.mkdirSync(path.dirname(ruta), { recursive: true });
  const tmp = `${ruta}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(b, null, 2) + "\n", "utf-8");
  fs.renameSync(tmp, ruta);
  cached = null;
}
