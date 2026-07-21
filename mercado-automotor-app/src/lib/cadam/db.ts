import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

// La app lee la base que arma CADAM/scripts/ingest.py. Orden de busqueda:
//
//   1. CADAM_DB_PATH          (variable de entorno, manda siempre)
//   2. ./data/cadam.db        (copia empaquetada -- es la que existe en
//                              Vercel; se refresca con `npm run sync-datos`)
//   3. ../CADAM/data/cadam.db (la base viva del pipeline, en la PC local)
//
// En la PC gana la 3 (via el orden: la 2 solo se usa si la 3 no esta,
// p.ej. en un despliegue), asi los dashboards locales siempre muestran la
// ultima ingesta sin pasos intermedios.
function resolverDbPath(): string {
  if (process.env.CADAM_DB_PATH) return process.env.CADAM_DB_PATH;
  const viva = path.join(process.cwd(), "..", "CADAM", "data", "cadam.db");
  if (fs.existsSync(viva)) return viva;
  return path.join(process.cwd(), "data", "cadam.db");
}

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(resolverDbPath(), { readonly: true, fileMustExist: true });
  }
  return db;
}
