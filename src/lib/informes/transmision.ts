/**
 * Transmisión de una versión, leída de su nombre.
 *
 * Fernando (07/09/2026): comparar el "desde" de un modelo con el "desde"
 * de otro no es justo si uno es mecánico y el otro automático. Ninguna
 * fuente trae la transmisión como dato: Cars escribe "JOLION H2 1.5T MT" o
 * "POER FAMILY ELITE 4X4 AT DIE", Datacar "T2 PRO MAX COMFORT 1.5 MT SUV",
 * "ONIX 1.0T PREMIER AT", "C3 1.0 FIREFLY LIVE BVM5" (BVM = caja manual,
 * BVA = automática, en francés), "S07 1.6T 7DCT". Se lee de ahí.
 *
 * Un híbrido o eléctrico (HEV, PHEV, EV, REEV, DM-i) es automático por
 * construcción. Lo que no dice nada queda en null y NO se adivina: en
 * la ficha cuenta para el "desde" pero no para el MT ni el AT.
 */
export type Transmision = "MT" | "AT";

const MANUAL = /^(MT|\dMT|MT\d|MEC|MECANICO|MECANICA|MANUAL|BVM\d?|STD)$/;
const AUTOMATICO =
  /^(AT|\dAT|AT\d|CVT|ECVT|E-CVT|DCT|\dDCT|DCT\d|DHT|AUT|AUTOMATICO|AUTOMATICA|AUTO|BVA\d?|TIPTRONIC|AMT|IVT|\dIVT)$/;
const ELECTRIFICADO = /^(HEV|PHEV|EV|BEV|REEV|MHEV|EREV|DM-?I|HIBRIDO|HIBRIDA|ELECTRICO|ELECTRICA|E-POWER|EPOWER)$/;

export function transmisionDe(nombre: string): Transmision | null {
  const tokens = String(nombre ?? "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[(),.\/|]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  let manual = false;
  let automatico = false;
  for (const t of tokens) {
    if (MANUAL.test(t)) manual = true;
    else if (AUTOMATICO.test(t) || ELECTRIFICADO.test(t)) automatico = true;
  }
  // "MT" explícito le gana a un "HEV" en el mismo nombre (no existe un
  // híbrido manual acá, pero si el nombre lo dice, se respeta lo dicho).
  if (manual && !automatico) return "MT";
  if (automatico && !manual) return "AT";
  if (manual && automatico) return tokens.some((t) => MANUAL.test(t)) ? "MT" : "AT";
  return null;
}

export const etiquetaTransmision = (t: Transmision | null) =>
  t === "MT" ? "mecánico" : t === "AT" ? "automático" : "sin dato";
