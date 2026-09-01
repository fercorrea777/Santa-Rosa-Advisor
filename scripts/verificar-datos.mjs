#!/usr/bin/env node
// Avisa cuando la base que va a leer la app NO es la del repo.
//
// Corre solo, antes de `npm run dev` (ver "predev" en package.json).
//
// El problema que ataca: data/cadam.db y CADAM/data/cadam.db estan
// trackeadas en git Y las reescribe ingest.py. Si tenes una ingesta local,
// git considera el archivo modificado y un `git pull` NO te lo pisa — en
// silencio, sin conflicto. Te quedas con datos viejos creyendo que
// actualizaste, y te enteras mirando un grafico al que le falta un mes.
//
// NO bloquea: tener la base modificada es normal y correcto justo despues
// de ingestar. Lo que hace es distinguir los dos casos, que es lo unico
// que vuelve util al aviso:
//
//   local MAS NUEVA  -> ingestaste vos. Todo bien, se avisa y ya.
//   local MAS VIEJA  -> te quedaste atras. Ese es el caso peligroso.
//
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";

const RUTAS = ["data/cadam.db", "CADAM/data/cadam.db"];

const git = (args, opts = {}) =>
  execFileSync("git", args, { encoding: "buffer", ...opts });

function snapshotDe(buffer) {
  const dir = mkdtempSync(join(tmpdir(), "cadam-check-"));
  const f = join(dir, "x.db");
  try {
    writeFileSync(f, buffer);
    const db = new Database(f, { readonly: true, fileMustExist: true });
    const r = db.prepare("SELECT periodo FROM v_snapshot_actual").get();
    db.close();
    return r?.periodo ?? null;
  } catch {
    return null;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function main() {
  let modificadas;
  try {
    modificadas = git(["status", "--porcelain", "--", ...RUTAS])
      .toString()
      .split("\n")
      .map((l) => l.slice(3).trim())
      .filter(Boolean);
  } catch {
    return; // sin git (deploy, tarball): no hay contra que comparar
  }
  if (!modificadas.length) return;

  for (const ruta of modificadas) {
    let local, repo;
    try {
      // La local se lee del DISCO (es la que abre la app), la del repo del
      // commit. Comparar contra el indice no serviria: el problema es
      // justamente que el working tree quedo atras del commit.
      local = snapshotDe(readFileSync(ruta));
      repo = snapshotDe(git(["show", `HEAD:${ruta}`], { maxBuffer: 1 << 30 }));
    } catch {
      continue;
    }
    if (!local || !repo || local === repo) continue;

    if (local < repo) {
      console.log(`
┌─────────────────────────────────────────────────────────────────┐
│  ATENCION: la base local esta ATRASADA                          │
└─────────────────────────────────────────────────────────────────┘
  ${ruta}
     tu copia:  snapshot ${local}
     el repo:   snapshot ${repo}   <- mas nueva

  Git no te la pisa en el pull porque figura como modificada. La app va a
  mostrar datos viejos sin avisarte.

  Para tomar la del repo (tu copia no tiene nada que el repo no tenga):

      git checkout -- ${ruta} && git pull

  Y despues REINICIA el server: la conexion a SQLite se abre una vez y
  queda cacheada (src/lib/cadam/db.ts).
`);
    } else {
      console.log(
        `[datos] ${ruta}: tu ingesta local (${local}) es mas nueva que la del repo (${repo}). ` +
          `Acordate de commitear data/ para que la vea el resto.`
      );
    }
  }
}

main();
