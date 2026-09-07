/**
 * Transmisión de una versión, leída de su nombre.
 *
 * Fernando (07/09/2026): comparar el "desde" de un modelo con el "desde"
 * de otro no es justo si uno es mecánico y el otro automático. Ninguna
 * fuente trae la transmisión como dato —se consultó la API de Cars el
 * 07/09/2026: /units/list trae `Motor` (el número de serie) y `Modelo`, y
 * /sales/list menos—. Cars escribe "JOLION H2 1.5T MT" o "POER FAMILY
 * ELITE 4X4 AT DIE", Datacar "T2 PRO MAX COMFORT 1.5 MT SUV", "ONIX 1.0T
 * PREMIER AT", "C3 1.0 FIREFLY LIVE BVM5" (BVM = caja manual, BVA =
 * automática, en francés), "S07 1.6T 7DCT". Se lee de ahí.
 *
 * Tres cosas que sí se saben sin adivinar, y se usan cuando el nombre no
 * dice nada:
 *  - un híbrido o eléctrico (HEV, PHEV, EV, REEV, DM-i) es automático;
 *  - una marca que solo vende eléctricos (Zeekr, Xpeng, JMEV, Leapmotor…)
 *    solo vende automáticos;
 *  - de NUESTRA gama se conoce familia por familia (la Dashing solo viene
 *    con DCT; la Kwid, con caja manual). Es el catálogo FAMILIAS de abajo:
 *    lo que sabe el vendedor, escrito. Se corrige ahí si algo cambia.
 *
 * Lo que sigue sin decir nada queda en null y NO se adivina: en la ficha
 * cuenta para el "desde" pero no para el MT ni el AT.
 */
export type Transmision = "MT" | "AT";

const MANUAL = /^(MT|\dMT|MT\d|MEC|MECANICO|MECANICA|MANUAL|BVM\d?|STD)$/;
const AUTOMATICO =
  /^(AT|\dAT|AT\d|CVT|ECVT|DCT|\dDCT|DCT\d|DHT|AUT|AUTOMATICO|AUTOMATICA|AUTO|BVA\d?|TIPTRONIC|AMT|IVT|\dIVT|EDC)$/;
const ELECTRIFICADO =
  /^(HEV|PHEV|EV|EV\d|BEV|REEV|MHEV|EREV|DMI|HIBRIDO|HIBRIDA|ELECTRICO|ELECTRICA|EPOWER)$/;

/** Marcas que solo venden eléctricos o híbridos enchufables: todo automático. */
export const MARCAS_ELECTRICAS = new Set([
  "ZEEKR", "XPENG", "JMEV", "LEAPMOTOR", "BYD", "TESLA", "AVATR", "DEEPAL", "ICAUR", "AION",
  "NETA", "SERES", "ORA",
]);

/**
 * Familias de NUESTRA gama cuya transmisión no depende de la versión, para
 * los nombres que Cars escribe sin decirla ("X50 LUXURY", "DASHING X1 GL",
 * "KOLEOS ALPINE"). Clave: marca CADAM y primera palabra del nombre. Solo
 * se consulta cuando el nombre no dice nada; si dice "MT" o "AT", eso manda.
 *
 * Fuente: la gama vigente en Paraguay (07/09/2026), confirmada contra la
 * planilla de producto (X50 Luxury 6DCT, Dashing 6DCT, X70 FL 6DCT). Las
 * que traen las dos cajas según versión (Poer diesel, JAC T8) NO están: ahí
 * hace falta que el nombre lo diga.
 */
export const FAMILIAS: Record<string, Transmision> = {
  // Jetour: toda la gama con doble embrague o 8AT
  "JETOUR|X50": "AT", "JETOUR|DASHING": "AT", "JETOUR|X70": "AT", "JETOUR|X70PLUS": "AT",
  "JETOUR|T1": "AT", "JETOUR|T2": "AT", "JETOUR|G700": "AT", "JETOUR|X90": "AT",
  // GWM
  "GREAT WALL|H9": "AT", "GREAT WALL|ORA": "AT", "GREAT WALL|TANK": "AT", "GREAT WALL|H6": "AT",
  "GREAT WALL|JOLION": "AT", "GREAT WALL|H7": "AT", "GREAT WALL|WINGLE": "MT",
  // Renault
  "RENAULT|KOLEOS": "AT", "RENAULT|KARDIAN": "AT", "RENAULT|BOREAL": "AT",
  "RENAULT|KWID": "MT", "RENAULT|MASTER": "MT",
  // Mitsubishi
  "MITSUBISHI|ECLIPSE": "AT", "MITSUBISHI|OUTLANDER": "AT", "MITSUBISHI|DESTINATOR": "AT",
  "MITSUBISHI|XPANDER": "AT", "MITSUBISHI|MONTERO": "AT",
  // Soueast
  "SOUEAST|S09": "AT", "SOUEAST|S07": "AT", "SOUEAST|S06": "AT", "SOUEAST|S08": "AT",
  // JAC: camiones, chasis y furgones con caja manual; los eléctricos, automáticos
  "JAC|X200": "MT", "JAC|LD250": "MT", "JAC|LD123": "MT", "JAC|LE551": "MT", "JAC|LE760": "MT",
  "JAC|LE420": "MT", "JAC|LE112": "MT", "JAC|SUNRAY": "MT", "JAC|HFC1063EV1X5014": "AT",
  "JAC|E30X": "AT", "JAC|JS1": "AT", "JAC|E10X": "AT", "JAC|JS4": "AT", "JAC|JS6": "AT",
};

function partes(nombre: string): string[] {
  return String(nombre ?? "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    // "E-CVT", "DM-i" y "E-POWER" son una palabra; el resto de los guiones
    // separan ("GLX-6DCT" es GLX y 6DCT).
    .replace(/\bE-CVT\b/g, "ECVT")
    .replace(/\bDM-?I\b/g, "DMI")
    .replace(/\bE-POWER\b/g, "EPOWER")
    .replace(/[(),./|\-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function transmisionDe(nombre: string, marca?: string): Transmision | null {
  const tokens = partes(nombre);
  let manual = false;
  let automatico = false;
  for (const t of tokens) {
    if (MANUAL.test(t)) manual = true;
    else if (AUTOMATICO.test(t) || ELECTRIFICADO.test(t)) automatico = true;
  }
  // "MT" explícito le gana a un "HEV" en el mismo nombre: si el nombre lo
  // dice, se respeta lo dicho.
  if (manual) return "MT";
  if (automatico) return "AT";
  const m = String(marca ?? "").toUpperCase().trim();
  if (m && MARCAS_ELECTRICAS.has(m)) return "AT";
  // La familia es la primera palabra que no sea un "NUEVO"/"NEW" de
  // marketing: "NUEVA MASTER L3H2" es Master, "NEW WINGLE 4X4" es Wingle.
  const familia = tokens.find((t) => !PREFIJOS.has(t));
  if (m && familia) {
    const fija = FAMILIAS[`${m}|${familia}`];
    if (fija) return fija;
  }
  return null;
}

const PREFIJOS = new Set(["NUEVO", "NUEVA", "NEW", "ALL", "THE", "NOVO", "NOVA"]);

export const etiquetaTransmision = (t: Transmision | null) =>
  t === "MT" ? "mecánico" : t === "AT" ? "automático" : "sin dato";
