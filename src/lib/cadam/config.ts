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

export function getMarcasPropiasSet(): Set<string> {
  return new Set(getParametros().marcas_propias.map((m) => m.marca_cadam));
}
