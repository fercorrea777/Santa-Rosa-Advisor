import fs from "node:fs";
import path from "node:path";

// parametros.json vive junto al pipeline de CADAM; el equipo comercial lo
// edita en un solo lugar. Mismo orden de busqueda que la base (db.ts):
// env -> carpeta CADAM viva -> copia empaquetada en ./data (Vercel).
function resolverParametrosPath(): string {
  if (process.env.CADAM_PARAMETROS_PATH) return process.env.CADAM_PARAMETROS_PATH;
  const vivo = path.join(process.cwd(), "..", "CADAM", "parametros.json");
  if (fs.existsSync(vivo)) return vivo;
  return path.join(process.cwd(), "data", "parametros.json");
}

export interface MarcaPropia {
  marca_cadam: string;
  grupo: string;
  submarca: string | null;
}

export interface GrupoPresupuesto {
  /** Nombres CADAM. La primera lleva la fila en metas_mensuales. */
  marcas: string[];
  /** Hoja del Excel de la que salió ("Venta Unidades Jetour"). */
  hoja: string;
  /** Plan vigente, 12 enteros (enero a diciembre). */
  plan: number[];
  /** Columna P del Excel: presupuesto original del año. null si no está. */
  presupuesto_anual: number | null;
}

/** Canal que Finanzas presupuesta aparte de las marcas: la sucursal de
 *  Ciudad del Este y las ventas mayoristas. Sus unidades ya están dentro de
 *  las marcas; es otro corte de lo mismo. El real sale de Cars: CDE por la
 *  sucursal que facturó, Wholesale por los asesores mayoristas de
 *  parametros.json. */
export interface CanalPresupuesto {
  canal: "CDE" | "WHOLESALE";
  hoja: string;
  /** Objetivo mensual, 12 enteros. Es el presupuesto puro: no se
   *  reescribe con lo vendido. */
  plan: number[];
  /** Lo vendido según FINANZAS (el bloque REAL de la misma hoja), mes a
   *  mes; null en los meses que todavía no cerraron. Es el real que vale
   *  para el canal: la sucursal que anota Cars no coincide con la
   *  definición de canal de Finanzas (CDE en Cars: 79 u. en 2026; Finanzas:
   *  310 hasta agosto). */
  real: (number | null)[];
  real_hasta_mes: number | null;
}

export interface Presupuesto {
  anio: number;
  version: string;
  archivo: string;
  /** mtime del archivo, ISO. */
  modificado: string;
  /** Cuándo lo recibió el Advisor, ISO. */
  cargado_en: string;
  /** Último mes cerrado según el Excel (Hoja1!A3): hasta ahí el plan es el
   *  real. null si el archivo no lo trae. */
  real_hasta_mes: number | null;
  /** Compilado!Total Unidades, para control. */
  total_compilado: number;
  grupos: GrupoPresupuesto[];
  /** Desde el 07/09/2026 (segunda entrega). Opcional: un Excel sin las
   *  hojas de canal carga igual. */
  canales?: CanalPresupuesto[];
}

export interface Parametros {
  marcas_propias: MarcaPropia[];
  /** Vendedores de Cars que son ventas MAYORISTAS (flotas, gerencia), no
   *  retail. Salen del ranking de asesores y van en su propio cuadro.
   *  Nombres tal cual los escribe Cars, en mayúsculas. Opcional: si falta,
   *  todos cuentan como retail. */
  asesores_mayoristas?: string[];
  segmento_seguimiento: string;
  competidores_clave: string[];
  metas: {
    participacion_mercado_2026_pct: number | null;
    ranking_objetivo_2026: number | null;
    unidades_objetivo_mensual: number | null;
  };
  /** Metas de VEHÍCULOS por marca y mes, cargadas desde Configuración:
   *  { "2026": { "JETOUR": [ene, feb, ..., dic], ... } }. null = sin meta ese
   *  mes. Se comparan contra lo facturado (Cars) en /operacion. */
  metas_mensuales?: Record<string, Record<string, (number | null)[]>>;
  /** Presupuesto del año cargado desde el Excel de Finanzas por Hermes
   *  (POST /api/presupuesto). `grupos` dice qué marcas comparten un plan
   *  (GWM = GREAT WALL + HAVAL); el plan mensual de cada grupo también se
   *  escribe en `metas_mensuales` bajo su primera marca, que es lo que
   *  /operacion compara. El Excel manda: cada carga pisa el bloque entero. */
  presupuesto?: Presupuesto;
  notas: string;
}

/** Metas del año por marca, siempre con 12 posiciones (null donde no hay). */
export function getMetasMensuales(anio: number): Record<string, (number | null)[]> {
  const crudo = getParametros().metas_mensuales?.[String(anio)] ?? {};
  const salida: Record<string, (number | null)[]> = {};
  for (const [marca, meses] of Object.entries(crudo)) {
    salida[marca] = Array.from({ length: 12 }, (_, i) => {
      const v = meses[i];
      return typeof v === "number" && Number.isFinite(v) ? v : null;
    });
  }
  return salida;
}

/** El presupuesto cargado, solo si es del año pedido: otro año se trata
 *  como ausente, no se prorratea ni se reusa. */
export function getPresupuesto(anio: number): Presupuesto | null {
  const p = getParametros().presupuesto;
  return p && p.anio === anio && Array.isArray(p.grupos) ? p : null;
}

/** Vendedores mayoristas, normalizados como los manda Hermes (mayúsculas,
 *  un solo espacio). Ver Parametros.asesores_mayoristas. */
export function getAsesoresMayoristasSet(): Set<string> {
  return new Set(
    (getParametros().asesores_mayoristas ?? []).map((a) =>
      a.toUpperCase().replace(/\s+/g, " ").trim()
    )
  );
}

let cached: { mtimeMs: number; valor: Parametros } | null = null;

/**
 * Cache por fecha de modificación del archivo. En producción el archivo
 * vive en un volumen (/datos/parametros.json) que Hermes reemplaza sin
 * redeploy; con un cache de por vida, agregar `asesores_mayoristas` el
 * 06/09/2026 no se vio hasta reiniciar el contenedor. Un stat por
 * request es despreciable frente a todo lo demás que hace la página.
 */
export function getParametros(): Parametros {
  const ruta = resolverParametrosPath();
  const mtimeMs = fs.statSync(ruta).mtimeMs;
  if (!cached || cached.mtimeMs !== mtimeMs) {
    const raw = fs.readFileSync(ruta, "utf-8");
    cached = { mtimeMs, valor: JSON.parse(raw) as Parametros };
  }
  return cached.valor;
}

/**
 * Guarda metas y competidores en parametros.json — la "Fase 2" que la
 * pantalla de Configuración venía anunciando.
 *
 * SOLO esos dos campos. Las marcas propias quedan fuera a propósito: son el
 * numerador del share en todo el tablero y el vínculo con los nombres de
 * CADAM; editarlas por un formulario convierte un click distraído en cifras
 * mal calculadas en doce pantallas. Eso se sigue tocando en el archivo, a
 * conciencia.
 *
 * Se escribe leyendo el ARCHIVO de nuevo (no el caché) y pisando solo los
 * campos editados: cualquier campo futuro que alguien agregue a mano
 * sobrevive. Escritura atómica —tmp + rename— para que un corte a mitad de
 * escritura no deje un JSON truncado que tumbe TODA la app al siguiente
 * arranque (config.ts no tolera un parse fallido).
 */
export function guardarParametros(
  cambios: Partial<Pick<Parametros, "metas" | "competidores_clave" | "metas_mensuales" | "presupuesto">>
): void {
  const ruta = resolverParametrosPath();
  const actual = JSON.parse(fs.readFileSync(ruta, "utf-8")) as Parametros;
  // Solo lo que vino: cada formulario de Configuración guarda lo suyo y no
  // pisa lo de los otros.
  if (cambios.metas) actual.metas = cambios.metas;
  if (cambios.competidores_clave) actual.competidores_clave = cambios.competidores_clave;
  if (cambios.metas_mensuales) actual.metas_mensuales = cambios.metas_mensuales;
  if (cambios.presupuesto) actual.presupuesto = cambios.presupuesto;
  const tmp = `${ruta}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(actual, null, 2) + "\n", "utf-8");
  fs.renameSync(tmp, ruta);
  // El caché de módulo quedó viejo: sin esto, la página seguiría mostrando
  // los valores anteriores hasta el próximo reinicio del proceso.
  cached = null;
}

export function getMarcasPropiasSet(): Set<string> {
  return new Set(getParametros().marcas_propias.map((m) => m.marca_cadam));
}
