#!/usr/bin/env node
/**
 * Cobertura de la traducción al inglés.
 *
 *   node scripts/i18n.mjs                  informe: frases usadas sin traducir, frases huérfanas, castellano sin envolver
 *   node scripts/i18n.mjs --generar        además reescribe catalogo/en.ts (suma de los en-*.ts) y catalogo/en-cliente.generated.ts
 *   node scripts/i18n.mjs --sin-envolver   lista, por archivo y línea, el texto en castellano que NO pasa por t()/tr()/N_()
 *   node scripts/i18n.mjs --estricto       sale con error si falta algo (para el cierre del trabajo)
 *   node scripts/i18n.mjs <ruta…>          restringe el informe a esos archivos o carpetas (relativas a la raíz del repo)
 *
 * QUÉ CUENTA COMO «FRASE USADA»: el primer argumento (literal, o literales unidos con +) de t(...), tr(...),
 * algo.t(...), algo.tr(...) y N_(...). El catálogo en inglés es la suma de src/lib/i18n/catalogo/en-*.ts
 * (cada archivo exporta por defecto { "frase en castellano": "English phrase" }).
 *
 * QUÉ ES «SIN ENVOLVER»: un texto de JSX, un atributo o un literal que parece castellano y no está dentro de
 * t()/tr()/N_(). Para lo que es castellano a propósito (el prompt del modelo, datos, claves de lookup…) se
 * pone un comentario `// i18n-ignore` en la misma línea (o en la anterior), o `/* i18n-ignore-file *\/` al principio
 * del archivo. Cada excepción es una decisión que se ve en el código.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(RAIZ, "src");
const CATALOGO = path.join(SRC, "lib", "i18n", "catalogo");

const args = process.argv.slice(2);
const GENERAR = args.includes("--generar");
const SIN_ENVOLVER = args.includes("--sin-envolver");
const ESTRICTO = args.includes("--estricto");
const TODAS = args.includes("--todas");
const DINAMICAS = args.includes("--dinamicas");
const filtros = args.filter((a) => !a.startsWith("--")).map((a) => path.resolve(RAIZ, a));

// ------------------------------------------------------------------ archivos

function listar(dir, salida = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (["node_modules", ".next"].includes(e.name)) continue;
      listar(p, salida);
    } else if (/\.(ts|tsx)$/.test(e.name) && !/\.d\.ts$/.test(e.name)) salida.push(p);
  }
  return salida;
}
const archivos = listar(SRC);
const rel = (p) => path.relative(RAIZ, p);

// ------------------------------------------------------------------ AST

const cache = new Map();
function fuente(p) {
  if (!cache.has(p)) {
    const texto = fs.readFileSync(p, "utf8");
    const sf = ts.createSourceFile(p, texto, ts.ScriptTarget.Latest, true, p.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    cache.set(p, { texto, sf });
  }
  return cache.get(p);
}

/** El texto de un literal o de varios unidos con +; null si tiene partes variables. */
function textoLiteral(n) {
  if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) return n.text;
  if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const a = textoLiteral(n.left);
    const b = textoLiteral(n.right);
    return a !== null && b !== null ? a + b : null;
  }
  if (ts.isParenthesizedExpression(n)) return textoLiteral(n.expression);
  return null;
}

function nombreLlamada(n) {
  const e = n.expression;
  if (ts.isIdentifier(e)) return e.text;
  if (ts.isPropertyAccessExpression(e)) return e.name.text;
  return null;
}
const FUNCIONES_T = new Set(["t", "tr", "N_"]);

// ------------------------------------------------------------------ 1. frases usadas

const usadas = new Map(); // frase -> Set(archivos)
const dinamicas = []; // t(variable): no se puede extraer
for (const p of archivos) {
  const { sf } = fuente(p);
  const visitar = (n) => {
    if (ts.isCallExpression(n)) {
      const nombre = nombreLlamada(n);
      if (nombre && FUNCIONES_T.has(nombre) && n.arguments.length) {
        const clave = textoLiteral(n.arguments[0]);
        if (clave !== null) {
          const limpia = clave.replace(/\s+/g, " ").trim();
          if (!usadas.has(limpia)) usadas.set(limpia, new Set());
          usadas.get(limpia).add(p);
          if (clave !== limpia) {
            const { line } = sf.getLineAndCharacterOfPosition(n.getStart());
            dinamicas.push({ archivo: p, linea: line + 1, motivo: "la clave tiene espacios dobles o saltos de línea (se normaliza)" });
          }
        } else if (nombre !== "N_" && ts.isCallExpression(n) && !ts.isTemplateExpression(n.arguments[0])) {
          const { line } = sf.getLineAndCharacterOfPosition(n.getStart());
          dinamicas.push({ archivo: p, linea: line + 1, motivo: "clave no literal: t(" + n.arguments[0].getText().slice(0, 40) + ")" });
        } else if (ts.isTemplateExpression(n.arguments[0])) {
          const { line } = sf.getLineAndCharacterOfPosition(n.getStart());
          dinamicas.push({ archivo: p, linea: line + 1, motivo: "plantilla con ${} dentro de t(): usá {nombre} y vars" });
        }
      }
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
}

// ------------------------------------------------------------------ 2. grafo de imports: qué archivos llegan al cliente

function resolver(desde, spec) {
  let base;
  if (spec.startsWith("@/")) base = path.join(SRC, spec.slice(2));
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(desde), spec);
  else return null;
  for (const c of [base + ".ts", base + ".tsx", path.join(base, "index.ts"), path.join(base, "index.tsx"), base]) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }
  return null;
}
const importes = new Map();
const esCliente = new Set();
for (const p of archivos) {
  const { sf, texto } = fuente(p);
  if (/^\s*(\/\*[\s\S]*?\*\/\s*|\/\/.*\n\s*)*["']use client["']/.test(texto.slice(0, 600))) esCliente.add(p);
  const deps = [];
  for (const st of sf.statements) {
    if ((ts.isImportDeclaration(st) || ts.isExportDeclaration(st)) && st.moduleSpecifier && ts.isStringLiteral(st.moduleSpecifier)) {
      const r = resolver(p, st.moduleSpecifier.text);
      if (r) deps.push(r);
    }
  }
  importes.set(p, deps);
}
const alcanzaCliente = new Set(esCliente);
const cola = [...esCliente];
while (cola.length) {
  const p = cola.pop();
  for (const d of importes.get(p) ?? []) {
    if (!alcanzaCliente.has(d)) {
      alcanzaCliente.add(d);
      cola.push(d);
    }
  }
}

// ------------------------------------------------------------------ 3. catálogo en inglés

const partes = fs.existsSync(CATALOGO)
  ? fs.readdirSync(CATALOGO).filter((f) => /^en-[a-z0-9-]+\.ts$/.test(f) && !f.includes("generated")).sort()
  : [];
const EN = new Map(); // frase -> inglés
const dondeEsta = new Map(); // frase -> archivo parcial
const duplicadas = [];
/** Lee un en-*.ts sin ejecutarlo: el primer objeto literal del archivo, con claves y valores de texto. */
function leerParcial(archivo) {
  const { sf } = fuente(archivo);
  const salida = [];
  let objeto = null;
  const buscar = (n) => {
    if (!objeto && ts.isObjectLiteralExpression(n)) objeto = n;
    if (!objeto) ts.forEachChild(n, buscar);
  };
  buscar(sf);
  if (!objeto) return salida;
  for (const prop of objeto.properties) {
    if (!ts.isPropertyAssignment(prop)) continue;
    const k = ts.isIdentifier(prop.name) ? prop.name.text : ts.isStringLiteral(prop.name) || ts.isNoSubstitutionTemplateLiteral(prop.name) ? prop.name.text : null;
    const v = textoLiteral(prop.initializer);
    if (k !== null && v !== null) salida.push([k, v]);
  }
  return salida;
}
for (const f of partes) {
  for (const [es, en] of leerParcial(path.join(CATALOGO, f))) {
    if (EN.has(es) && EN.get(es) !== en) duplicadas.push({ es, a: dondeEsta.get(es), b: f, enA: EN.get(es), enB: en });
    else if (EN.has(es)) duplicadas.push({ es, a: dondeEsta.get(es), b: f, enA: en, enB: en, igual: true });
    EN.set(es, en);
    dondeEsta.set(es, f);
  }
}

// ------------------------------------------------------------------ 4. comparar

const marcadores = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
const etiquetas = (s) => [...s.matchAll(/<\/?([a-zA-Z][\w-]*)\s*\/?>/g)].map((m) => m[0].replace(/\s+/g, "")).sort().join("");

const claves = [...usadas.keys()];
const enAlcance = (set) => (filtros.length ? [...set].some((p) => filtros.some((f) => p === f || p.startsWith(f + path.sep))) : true);
const sinTraducir = claves.filter((k) => !EN.has(k) && enAlcance(usadas.get(k))).sort();
const huerfanas = [...EN.keys()].filter((k) => !usadas.has(k)).sort();
const incoherentes = [];
for (const [es, en] of EN) {
  if (!usadas.has(es)) continue;
  if (marcadores(es) !== marcadores(en)) incoherentes.push({ es, en, motivo: `marcadores {} distintos: [${marcadores(es)}] vs [${marcadores(en)}]` });
  else if (etiquetas(es) !== etiquetas(en)) incoherentes.push({ es, en, motivo: `etiquetas <> distintas: ${etiquetas(es)} vs ${etiquetas(en)}` });
  else if (en.trim() === "") incoherentes.push({ es, en, motivo: "traducción vacía" });
}

// ------------------------------------------------------------------ 5. castellano sin envolver

const ACENTOS = /[áéíóúüñÁÉÍÓÚÜÑ¿¡«»]/;
const PALABRAS_ES = /\b(el|la|los|las|de|del|que|con|para|por|una|un|unos|unas|en|y|o|se|su|sus|al|más|menos|sin|como|hay|son|es|está|están|este|esta|estos|estas|todo|todos|todas|cada|solo|sólo|mes|meses|año|años|marca|marcas|modelo|modelos|unidades|mercado|datos|dato|período|periodo|filtro|filtrá|filtrar|segmento|nuestra|nuestro|nuestras|nuestros|propia|propias|propio|propios|venta|ventas|precio|precios|importación|matriculación|participación|variación|resumen|inicio|ver|hacé|tocá|elegí|todavía|falta|fuente|mostrando|contra|según|donde|dónde|cuánto|cuántos|qué|quién|cómo|desde|hasta|entre|sobre|hoy|ayer|ahora|cuando|cuándo|porque|pero|también|ya|aún|nada|ninguna|ninguno|algún|alguna|otro|otra|otros|otras|mismo|misma|nuevo|nueva|último|última|primer|primera|siguiente|anterior|actual|total|promedio|máximo|mínimo|cerrado|abierto)\b/gi;
const SOLO_CODIGO = /^[\w\-:\[\]\/\.\(\)%#!&>*=,'"\s${}|+~@^<]+$/;
const CLASES_TW = /(^|\s)(flex|grid|px-|py-|mt-|mb-|ml-|mr-|gap-|text-|bg-|border|rounded|w-|h-|min-|max-|items-|justify-|font-|size-|col-|row-|space-|ring|shadow|overflow|absolute|relative|hidden|block|inline|sm:|md:|lg:|xl:|dark:|hover:|focus|data-\[|aria-|[a-z]+-\[)/;

function pareceCastellano(s) {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length < 3 || !/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{3,}/.test(t)) return false;
  if (/^(https?:|\/|@\/|\.\/|\.\.\/|#|--|use client|use server|data:|mailto:)/.test(t)) return false;
  if (CLASES_TW.test(t) && SOLO_CODIGO.test(t) && !ACENTOS.test(t)) return false;
  if (/^[a-z][A-Za-z0-9_.\-]*$/.test(t) && !ACENTOS.test(t)) return false; // identificador / clave suelta
  if (/^[A-Z0-9_\- ]+$/.test(t) && t.length < 12) return false; // SIGLA / CONSTANTE
  if (ACENTOS.test(t)) return true;
  const hits = t.match(PALABRAS_ES) ?? [];
  return hits.length >= 2 || (hits.length >= 1 && t.split(" ").length >= 3);
}

/** Atributos y propiedades cuyo valor es, casi seguro, un texto que lee una persona: se marca CUALQUIER palabra de 3+ letras. */
const CLAVES_DE_TEXTO = new Set([
  "title", "aria-label", "aria-description", "aria-roledescription", "placeholder", "alt", "label", "titulo", "descripcion",
  "nota", "notaVariacion", "tooltip", "subtitulo", "etiqueta", "texto", "mensaje", "error", "pista", "leyenda", "resumen",
  "detalle", "aviso", "etiquetaModelo", "columnaClave", "unidad", "encabezado", "cabecera", "fuente", "periodo", "ayuda",
]);
/** Una palabra o frase corta que no es un identificador ni una sigla: «Unidades», «Marca», «Cargando…». */
const PALABRA_DE_PANTALLA = (t) => /^[A-ZÁÉÍÓÚÑ][a-záéíóúüñ]{2,}[a-záéíóúüñ\s.,:;…!?()\-–·/]*$/.test(t.trim()) || /[áéíóúüñ]/i.test(t);
const SOLO_SIGLAS = /^[A-Z0-9&\s./·\-+%]+$/;

const ATRIBUTOS_DE_CODIGO = new Set([
  "className", "id", "key", "href", "src", "type", "role", "name", "value", "htmlFor", "style", "viewBox", "d", "fill", "stroke",
  "xmlns", "target", "rel", "method", "autoComplete", "inputMode", "tabIndex", "variant", "size", "tono", "chipTono", "chipIcono",
  "icono", "formato", "como", "param", "side", "align", "data-slot", "defaultValue", "htmlFor", "pattern", "accept", "mode", "lang",
]);

const sinEnvolver = [];
for (const p of archivos) {
  if (filtros.length && !filtros.some((f) => p === f || p.startsWith(f + path.sep))) continue;
  if (p.startsWith(CATALOGO + path.sep)) continue;
  const { sf, texto } = fuente(p);
  if (/i18n-ignore-file/.test(texto.slice(0, 800))) continue;
  const lineas = texto.split("\n");
  // Tramos «// i18n-ignore-start … // i18n-ignore-end»: castellano a propósito (datos, palabras clave de búsqueda…).
  const tramos = [];
  let abierto = null;
  lineas.forEach((l, i) => {
    if (/i18n-ignore-start/.test(l)) abierto = i;
    else if (/i18n-ignore-end/.test(l) && abierto !== null) { tramos.push([abierto, i]); abierto = null; }
  });
  const ignorada = (linea) =>
    /i18n-ignore(?!-)/.test(lineas[linea] ?? "") || /i18n-ignore(?!-)/.test(lineas[linea - 1] ?? "") || tramos.some(([a, b]) => linea >= a && linea <= b);
  const dentroDeT = (n) => {
    for (let a = n.parent; a; a = a.parent) {
      if (ts.isCallExpression(a)) {
        const nombre = nombreLlamada(a);
        if (nombre && FUNCIONES_T.has(nombre)) return true;
        // console.*, new Error(...): no son pantalla
        if (a.expression.getText().startsWith("console.")) return true;
      }
      if (ts.isImportDeclaration(a) || ts.isExportDeclaration(a)) return true;
      if (ts.isLiteralTypeNode(a) || ts.isTypeAliasDeclaration(a) || ts.isInterfaceDeclaration(a)) return true;
    }
    return false;
  };
  const anotar = (n, texto, tipo) => {
    const { line } = sf.getLineAndCharacterOfPosition(n.getStart());
    if (ignorada(line)) return;
    sinEnvolver.push({ archivo: p, linea: line + 1, tipo, texto: texto.replace(/\s+/g, " ").trim().slice(0, 110) });
  };
  const visitar = (n) => {
    if (ts.isJsxText(n)) {
      const t = n.getText().replace(/\s+/g, " ").trim();
      // Un texto suelto en JSX es de pantalla: alcanza con que tenga una palabra que no sea una sigla ni un número.
      const sospechoso = /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{3,}/.test(t) && !SOLO_SIGLAS.test(t);
      if (sospechoso && !dentroDeT(n)) anotar(n, n.getText(), "jsx");
    } else if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
      const padre = n.parent;
      if (ts.isImportDeclaration(padre) || ts.isExportDeclaration(padre)) return;
      if (ts.isJsxAttribute(padre) && ATRIBUTOS_DE_CODIGO.has(padre.name.getText())) return;
      // Valor de un atributo o de una propiedad que es texto de pantalla por su nombre.
      const nombreClave = ts.isJsxAttribute(padre) ? padre.name.getText() : ts.isPropertyAssignment(padre) && padre.initializer === n ? padre.name.getText().replace(/["']/g, "") : null;
      if (nombreClave && CLAVES_DE_TEXTO.has(nombreClave) && PALABRA_DE_PANTALLA(n.text) && !dentroDeT(n) && !SOLO_SIGLAS.test(n.text.trim())) {
        anotar(n, n.text, ts.isJsxAttribute(padre) ? "atributo" : "literal");
        return;
      }
      if (ts.isPropertyAssignment(padre) && padre.name === n) return; // clave de objeto
      if (ts.isElementAccessExpression(padre) && padre.argumentExpression === n) return;
      if (ts.isCaseClause(padre) || (ts.isBinaryExpression(padre) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken].includes(padre.operatorToken.kind))) return;
      if (pareceCastellano(n.text) && !dentroDeT(n)) anotar(n, n.text, ts.isJsxAttribute(padre) ? "atributo" : "literal");
    } else if (ts.isTemplateExpression(n)) {
      const cab = n.head.text + n.templateSpans.map((s) => s.literal.text).join(" ");
      if (pareceCastellano(cab) && !dentroDeT(n)) anotar(n, "`" + cab + "`", "plantilla");
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
}

// ------------------------------------------------------------------ 5b. formatos en castellano importados

/** Los formatos que dependen del idioma: en pantalla se destructuran de `fmt` (getI18n()/useI18n()), no se importan. */
const FORMATOS_LOCALES = new Set([
  "formatUnidades", "formatPct", "formatPuntosPct", "formatDecimal", "decimal", "formatFecha", "formatFechaHora",
  "nombreDeSegmento", "nombreDeGrupo", "mesCorto", "MESES_CORTOS", "MESES_LARGOS", "etiquetaCorte", "etiquetaCortes",
  "aclaracionCortes", "etiquetaPeriodo",
]);
const importsLocales = [];
for (const p of archivos) {
  if (filtros.length && !filtros.some((f) => p === f || p.startsWith(f + path.sep))) continue;
  if (p.startsWith(path.join(SRC, "lib", "i18n") + path.sep) || p === path.join(SRC, "lib", "format.ts") || p === path.join(SRC, "lib", "periodo.ts")) continue;
  const { sf, texto } = fuente(p);
  if (/i18n-ignore-file/.test(texto.slice(0, 800))) continue;
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) || !ts.isStringLiteral(st.moduleSpecifier)) continue;
    const m = st.moduleSpecifier.text;
    if (!["@/lib/format", "@/lib/periodo", "./format", "./periodo", "../format", "../periodo"].includes(m)) continue;
    const nombres = st.importClause?.namedBindings && ts.isNamedImports(st.importClause.namedBindings)
      ? st.importClause.namedBindings.elements.filter((e) => !e.isTypeOnly && FORMATOS_LOCALES.has((e.propertyName ?? e.name).text)).map((e) => (e.propertyName ?? e.name).text)
      : [];
    if (nombres.length) {
      const { line } = sf.getLineAndCharacterOfPosition(st.getStart());
      if (!/i18n-ignore/.test(texto.split("\n")[line - 1] ?? "") && !/i18n-ignore/.test(texto.split("\n")[line] ?? "")) importsLocales.push({ archivo: p, linea: line + 1, nombres });
    }
  }
}

// ------------------------------------------------------------------ 6. escribir los generados

function literal(s) {
  return JSON.stringify(s);
}
if (GENERAR) {
  fs.mkdirSync(CATALOGO, { recursive: true });
  const cabecera = "// GENERADO por `node scripts/i18n.mjs --generar`. No se edita a mano: se editan los en-*.ts.\n";
  const imports = partes.map((f, i) => `import p${i} from "./${f.replace(/\.ts$/, "")}";`).join("\n");
  const suma = partes.map((_, i) => `  ...p${i},`).join("\n");
  fs.writeFileSync(
    path.join(CATALOGO, "en.ts"),
    `${cabecera}${imports}\n\n/** El catálogo completo en inglés: la suma de los en-*.ts. */\nconst EN: Record<string, string> = {\n${suma}\n};\n\nexport default EN;\n`
  );
  const paraCliente = [...EN.keys()].filter((k) => usadas.has(k) && [...usadas.get(k)].some((p) => alcanzaCliente.has(p))).sort();
  const cuerpo = paraCliente.map((k) => `  ${literal(k)}: ${literal(EN.get(k))},`).join("\n");
  fs.writeFileSync(
    path.join(CATALOGO, "en-cliente.generated.ts"),
    `${cabecera}// Solo las frases que usan los componentes de cliente (y lo que importan): es lo que viaja al navegador en inglés.\nconst EN_CLIENTE: Record<string, string> = {\n${cuerpo}\n};\n\nexport default EN_CLIENTE;\n`
  );
  console.log(`generado: en.ts (${partes.length} archivos, ${EN.size} frases) y en-cliente.generated.ts (${paraCliente.length} frases)`);
}

// ------------------------------------------------------------------ 7. informe

const linea = (c = "─") => console.log(c.repeat(78));
function porArchivo(items) {
  const m = new Map();
  for (const it of items) {
    const k = rel(it.archivo);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(it);
  }
  return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
}

console.log(`i18n · ${archivos.length} archivos · ${usadas.size} frases en t()/tr()/N_() · ${EN.size} en el catálogo (${partes.length} en-*.ts)`);
console.log(`cliente: ${esCliente.size} archivos "use client", ${alcanzaCliente.size} los que llegan al navegador`);
linea();

if (SIN_ENVOLVER) {
  for (const [a, items] of porArchivo(sinEnvolver)) {
    console.log(`${a}  (${items.length})`);
    for (const it of items) console.log(`  ${String(it.linea).padStart(4)}  ${it.tipo.padEnd(9)} ${it.texto}`);
  }
  linea();
  console.log(`SIN ENVOLVER: ${sinEnvolver.length} en ${new Set(sinEnvolver.map((x) => x.archivo)).size} archivos`);
} else {
  console.log(`SIN TRADUCIR (se usan y no están en el catálogo): ${sinTraducir.length}`);
  const tope = TODAS ? Infinity : 60;
  for (const k of sinTraducir.slice(0, tope)) console.log(`   · ${TODAS ? k : k.slice(0, 110)}   [${[...usadas.get(k)].map((p) => path.basename(p)).slice(0, 2).join(", ")}]`);
  if (sinTraducir.length > tope) console.log(`   … y ${sinTraducir.length - tope} más (--todas para verlas todas)`);
  console.log(`HUÉRFANAS (en el catálogo y ya no en el código): ${huerfanas.length}`);
  for (const k of huerfanas.slice(0, 30)) console.log(`   · ${k.slice(0, 110)}   [${dondeEsta.get(k)}]`);
  console.log(`INCOHERENTES ({} o <> distintos entre castellano e inglés): ${incoherentes.length}`);
  for (const it of incoherentes.slice(0, 30)) console.log(`   · ${it.es.slice(0, 80)}  →  ${it.motivo}`);
  console.log(`DUPLICADAS entre archivos del catálogo: ${duplicadas.filter((d) => !d.igual).length} con traducción distinta, ${duplicadas.filter((d) => d.igual).length} iguales`);
  for (const d of duplicadas.filter((d) => !d.igual).slice(0, 20)) console.log(`   · ${d.es.slice(0, 70)}  [${d.a} vs ${d.b}]`);
  // t(variable) es legítimo cuando la variable sale de una constante marcada con N_(); se cuentan y se listan con --dinamicas.
  const sospechosas = dinamicas.filter((d) => !/clave no literal: t\((?:[\w.]+(?:\[[^\]]*\])?)\)$/.test(d.motivo));
  console.log(`CLAVES SOSPECHOSAS (espacios dobles, plantillas con \${}): ${sospechosas.length}   ·   t(variable): ${dinamicas.length - sospechosas.length} (--dinamicas)`);
  for (const d of (DINAMICAS ? dinamicas : sospechosas).slice(0, DINAMICAS ? 400 : 25)) console.log(`   · ${rel(d.archivo)}:${d.linea}  ${d.motivo}`);
  console.log(`FORMATOS EN CASTELLANO IMPORTADOS (usar fmt): ${importsLocales.length} imports en ${new Set(importsLocales.map((x) => x.archivo)).size} archivos`);
  for (const it of importsLocales.slice(0, TODAS ? 400 : 12)) console.log(`   · ${rel(it.archivo)}:${it.linea}  ${it.nombres.join(", ")}`);
  if (!TODAS && importsLocales.length > 12) console.log(`   … y ${importsLocales.length - 12} más (--todas)`);
  console.log(`CASTELLANO SIN ENVOLVER: ${sinEnvolver.length} en ${new Set(sinEnvolver.map((x) => x.archivo)).size} archivos  (detalle: --sin-envolver)`);
  linea();
  const top = porArchivo(sinEnvolver).slice(0, 15);
  for (const [a, items] of top) console.log(`   ${String(items.length).padStart(4)}  ${a}`);
}

const problemas = sinTraducir.length + incoherentes.length + duplicadas.filter((d) => !d.igual).length + sinEnvolver.length + importsLocales.length;
if (ESTRICTO && problemas > 0) {
  console.error(`\n--estricto: ${problemas} problema(s)`);
  process.exit(1);
}
