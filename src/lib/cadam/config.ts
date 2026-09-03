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

export interface Parametros {
  marcas_propias: MarcaPropia[];
  segmento_seguimiento: string;
  competidores_clave: string[];
  metas: {
    participacion_mercado_2026_pct: number | null;
    ranking_objetivo_2026: number | null;
    unidades_objetivo_mensual: number | null;
  };
  notas: string;
}

let cached: Parametros | null = null;

export function getParametros(): Parametros {
  if (!cached) {
    const raw = fs.readFileSync(resolverParametrosPath(), "utf-8");
    cached = JSON.parse(raw) as Parametros;
  }
  return cached;
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
export function guardarParametros(cambios: {
  metas: Parametros["metas"];
  competidores_clave: string[];
}): void {
  const ruta = resolverParametrosPath();
  const actual = JSON.parse(fs.readFileSync(ruta, "utf-8")) as Parametros;
  actual.metas = cambios.metas;
  actual.competidores_clave = cambios.competidores_clave;
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
