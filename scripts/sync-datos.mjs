// Copia la base y los parametros del pipeline a ./data/, que es lo que
// viaja en el despliegue (Vercel no puede leer archivos fuera del
// proyecto). Correr despues de cada ingesta mensual, antes de publicar:
//
//     npm run sync-datos
//
import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { join } from "node:path";

const raiz = process.cwd();
// Dos layouts posibles: en la PC local CADAM/ es hermana de la app
// (../CADAM); en el repo publico de GitHub vive adentro (./CADAM).
const candidatos = [join(raiz, "..", "CADAM"), join(raiz, "CADAM")];
const origen = candidatos.find((p) => existsSync(p)) ?? candidatos[0];
const destino = join(raiz, "data");

const archivos = [
  ["data/cadam.db", "cadam.db"],
  ["parametros.json", "parametros.json"],
];

mkdirSync(destino, { recursive: true });
for (const [rel, nombre] of archivos) {
  const src = join(origen, rel);
  if (!existsSync(src)) {
    console.error(`AVISO: no existe ${src} — se conserva la copia previa si la hay.`);
    continue;
  }
  copyFileSync(src, join(destino, nombre));
  const kb = Math.round(statSync(join(destino, nombre)).size / 1024);
  console.log(`ok  ${nombre}  (${kb} KB)`);
}
console.log("Listo. Commitear data/ y publicar para que el sitio use los datos nuevos.");
