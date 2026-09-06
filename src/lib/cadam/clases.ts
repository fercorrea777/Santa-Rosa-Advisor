/**
 * CLASE de vehículo: contra quién compite de verdad cada modelo.
 *
 * POR QUÉ EXISTE. CADAM clasifica en seis segmentos (SUV, Pick Up,
 * Automóvil, Camión, Furgón, Minibús) y nada más. "SUV" mete en la misma
 * bolsa a una X50 de US$ 15.000 y a una Fortuner de US$ 52.000, que no se
 * cruzan en ninguna decisión de compra; "Pick Up" mete a la Strada con la
 * Ranger. Y el precio solo no alcanza para separarlos: la L200 (US$ 23.674
 * de lista) compite con Hilux, Ranger, Frontier, D-Max y BT-50 aunque estén
 * US$ 10.000 más arriba, porque el comprador de una pick-up mediana compara
 * pick-ups medianas, no bandas de precio. Las dos primeras versiones de
 * "rivales directos" (misma banda; todo el segmento) fallaron por esto, una
 * para cada lado (06/09/2026).
 *
 * La clase es lo que el mercado y cualquier gerente de concesionaria usan
 * sin nombrarlo: tamaño y tipo de uso. Chico / compacto / mediano / grande
 * para SUV; compacta / mediana / grande para pick-ups; chico / mediano /
 * premium para autos; liviano / mediano / pesado para camiones. NO está en
 * ninguna fuente: está acá, escrita a mano sobre los nombres REALES con los
 * que CADAM registra cada familia (ver el volcado de 2025-2026 con el que se
 * armó). Es conocimiento del negocio en forma de tabla.
 *
 * CÓMO SE MANTIENE. Un modelo que no está en la tabla cae a una clase
 * inferida por segmento y precio, y queda MARCADO como inferido: la
 * pantalla lo dice y esta tabla se completa. Un modelo nuevo del mercado
 * (aparece en CADAM) se agrega acá, no se adivina en producción.
 */

export type Clase = string;

/** Orden de exhibición: por segmento y de chico a grande. */
export const CLASES_ORDEN: Clase[] = [
  "SUV chico", "SUV compacto", "SUV mediano", "SUV grande", "SUV premium", "Monovolumen",
  "Pick-up compacta", "Pick-up mediana", "Pick-up grande",
  "Auto chico", "Auto mediano", "Auto premium",
  "Camión liviano", "Camión mediano", "Camión pesado",
  "Furgón chico", "Furgón grande", "Minibús", "Ómnibus",
];

/** Segmento (nombre de CADAM) al que pertenece cada clase, para agrupar. */
export const SEGMENTO_DE_CLASE: Record<Clase, string> = {
  "SUV chico": "SUV", "SUV compacto": "SUV", "SUV mediano": "SUV", "SUV grande": "SUV",
  "SUV premium": "SUV", "Monovolumen": "SUV",
  "Pick-up compacta": "Pick Up", "Pick-up mediana": "Pick Up", "Pick-up grande": "Pick Up",
  "Auto chico": "Automovil", "Auto mediano": "Automovil", "Auto premium": "Automovil",
  "Camión liviano": "Camion", "Camión mediano": "Camion", "Camión pesado": "Camion",
  "Furgón chico": "Furgon", "Furgón grande": "Furgon", "Minibús": "Minibus", "Ómnibus": "Omnibus",
};

type Regla = { marca?: RegExp; nombre: RegExp; clase: Clase; segmento?: RegExp };

const PREMIUM = /^(BMW|MERCEDES BENZ|MERCEDES|AUDI|VOLVO|LEXUS|LAND ROVER|PORSCHE|MINI|MASERATI|JAGUAR|ALFA ROMEO|CADILLAC|LINCOLN|INFINITI|GENESIS|TESLA)$/;
const SUV = /^SUV$/i;

/**
 * Reglas, en orden: gana la primera que coincide. El nombre ya viene
 * normalizado (mayúsculas, sin guiones en los códigos, sin NEW/NUEVO/ALL
 * NEW adelante) y las reglas se anclan al principio, así "COROLLA CROSS"
 * se prueba antes que "COROLLA".
 */
const REGLAS: Regla[] = [
  // ---------------------------------------------------------------- SUV
  // El nombre manda sobre el segmento de CADAM: CADAM registra algunas RAV4
  // y Land Cruiser como "Pick Up", y una RAV4 es un SUV compacto se la
  // cargue donde se la cargue. Las reglas de marca van ANTES que las
  // genéricas: "T2" es Tiggo 2 (chico) en Chery y un SUV mediano en
  // Jetour; "T8" es Tiggo 8 (SUV) en Chery y una pick-up en JAC.
  { marca: /^CHERY$/, nombre: /^(T2|T4|TIGGO 2|TIGGO 4)/, clase: "SUV chico" },
  { marca: /^CHERY$/, nombre: /^(T8|T9|TIGGO 8|TIGGO 9)/, clase: "SUV mediano" },
  { marca: /^JETOUR$/, nombre: /^X50/, clase: "SUV chico" },
  { marca: /^JETOUR$/, nombre: /^DASHING/, clase: "SUV compacto" },
  { marca: /^JETOUR$/, nombre: /^(T1|T2|X70|X90)/, segmento: SUV, clase: "SUV mediano" },
  { marca: /^JETOUR$/, nombre: /^G700/, segmento: SUV, clase: "SUV grande" },
  { marca: /^SOUEAST$/, nombre: /^S06/, clase: "SUV compacto" },
  { marca: /^SOUEAST$/, nombre: /^(S07|S08|S09)/, segmento: SUV, clase: "SUV mediano" },
  { marca: /^GREAT WALL$/, nombre: /^(JOLION|H6|H2)/, clase: "SUV compacto" },
  { marca: /^GREAT WALL$/, nombre: /^(TANK|H9)/, segmento: SUV, clase: "SUV grande" },
  { marca: /^LEAPMOTOR$/, nombre: /^B10/, clase: "SUV compacto" },
  { marca: /^LEAPMOTOR$/, nombre: /^(C10|C11|C16)/, segmento: SUV, clase: "SUV mediano" },
  { marca: /^LYNK CO$/, nombre: /^(1|01|6|06)\b/, clase: "SUV compacto" },
  { marca: /^LYNK CO$/, nombre: /^(9|09|8|08)\b/, segmento: SUV, clase: "SUV mediano" },
  { marca: /^DEEPAL$/, nombre: /^S05/, clase: "SUV compacto" },
  { marca: /^DEEPAL$/, nombre: /^S07/, segmento: SUV, clase: "SUV mediano" },
  { marca: /^ISUZU$/, nombre: /^UCS/, segmento: SUV, clase: "SUV grande" }, // MU-X, por código de fábrica
  { marca: /^ZEEKR$/, nombre: /^(X|7X|9X)\b/, segmento: SUV, clase: "SUV premium" },
  { marca: /^XPENG$/, nombre: /^(G6|G9|G7)/, segmento: SUV, clase: "SUV premium" },
  { marca: /^(VOLVO|AVATR|XIAOMI)$/, nombre: /./, segmento: SUV, clase: "SUV premium" },
  // premium: las marcas premium compiten entre sí, con cualquier tamaño
  { marca: PREMIUM, nombre: /./, segmento: SUV, clase: "SUV premium" },
  // monovolúmenes de 7 plazas (los cuenta CADAM como SUV)
  { nombre: /^(CARENS|CARNIVAL|STARGAZER|XPANDER|XL7|ERTIGA|SIENNA|ODYSSEY|SPIN|GRAND CARNIVAL|INNOVA|M6\b|GAC M6|MAXUS G50|G50)/, clase: "Monovolumen" },
  // chico (B-SUV, ~4,0–4,4 m)
  { nombre: /^(CRETA|SONET|SELTOS|FRONX|KICKS|KAIT|MAGNITE|TRACKER|EMGRAND GX3|GX3|COOLRAY|CITYRAY|PULSE|FASTBACK|RAIZE|RUSH|JIMNY|ZS\b|MG ZS|CX30|CX3\b|TERA|TCROSS|T CROSS|NIVUS|K3 CROSS|2008|KARDIAN|VENUE|KONA|HRV|HR V|WRV|WR V|BRV|BR V|SPARK|C3 AIRCROSS|C4 CACTUS|BASALT|GS3|EMZOOM|TIVOLI|XLV|RENEGADE|YUAN PRO|YUAN\b|CS15|CS35|VITARA ACROSS|SCROSS|S CROSS|GRAND VITARA|VITARA|DUSTER|XUV 3XO|XUV300|V23|ASX|ECOSPORT|TAIGO|STONIC|BAYON|JUKE|CAPTUR|ARIZO|ICAUR|SERES|X35|YARIS CROSS|E2\b|BYD E2)/, clase: "SUV chico" },
  // compacto (C-SUV, ~4,4–4,65 m)
  { nombre: /^(SPORTAGE|COROLLA CROSS|TUCSON|COMPASS|CX5|T7\b|TIGGO 7|QASHQAI|TAOS|TERRITORY|BRONCO SPORT|STARRAY|AZKARRA|CS55|UNIT\b|UNI T|UNIT ELITE|UNIT LEV|JOLION|H6\b|H6 GT|RAV4|RAV 4|TIGUAN|3008|EHS|MG EHS|HS\b|MG HS|RX5|MG RX5|ONE\b|MG ONE|ONE TROPHY|YUAN PLUS|ATTO 3|EV5|NIRO|ECLIPSE CROSS|ARKANA|FORESTER|CROSSTREK|KORANDO|JS4|X55|GEOMETRY|CAPTIVA|YPLUS|Y PLUS|AION Y|OUTLANDER SPORT|C5 AIRCROSS|5008|SEALION 5|SEALION 6|OMODA 5|OMODA 7|JAECOO 7|JAECOO 5|J7|GS4|EMKOO|TORRES|D60|BJ30|T55|T77|AX7|EX5\b|GEELY EX5)/, clase: "SUV compacto" },
  // mediano (D-SUV, ~4,65–4,95 m, incluye 7 plazas monocasco)
  { nombre: /^(SORENTO|SANTA FE|XTRAIL|X TRAIL|SONG|SEALION 7|CX60|CX 60|CRV|CR V|KOLEOS|COMMANDER|OKAVANGO|MONJARO|CS75|UNIK|UNI K|M7\b|X75|HIGHLANDER|GRAND CHEROKEE|OUTLANDER|SANTAFE|H7\b|CS95|RX9|MG RX9|V27|REFINE|S7\b|GAC S7)/, clase: "SUV mediano" },
  // grande (E / todoterreno con chasis, ≥ 4,9 m). Land Cruiser 70 es una
  // pick-up cuando CADAM la cuenta como Pick Up (regla más abajo).
  { nombre: /^(FORTUNER|EVEREST|MONTERO|PAJERO|TRAILBLAZER|REXTON|PATHFINDER|PALISADE|TERAMONT|TOUAREG|GS8|CX90|CX 90|TANK|H9\b|4RUNNER|PILOT|EXPLORER|BRONCO\b|WRANGLER|G700|G 318|G318|BJ60|BJ40|BJ80|PATROL|SEQUOIA|TAHOE|SUBURBAN|EXPEDITION|PRADO|MU X|MUX|TANG|ATTO 8)/, clase: "SUV grande" },
  { nombre: /^LAND CRUISER 70/, segmento: /^Pick Up$/i, clase: "Pick-up mediana" },
  { nombre: /^LAND CRUISER/, clase: "SUV grande" },

  // ------------------------------------------------------------ Pick Up
  { nombre: /^(STRADA|SAVEIRO|MONTANA|NOVA MONTANA|TORO|OROCH|RAMPAGE|MAVERICK|MD201|MS201|MINI TRUCK|SUPER CARRY|K01)/, clase: "Pick-up compacta" },
  { marca: /^RENAULT$/, nombre: /OROCH/, clase: "Pick-up compacta" },
  { nombre: /^(HILUX|S10|RANGER|FRONTIER|AMAROK|L200|TRITON|BT50|BT 50|DMAX|D MAX|POER|WINGLE|HUNTER|HIMLA|LANDTREK|T60|T90|TERRON|TASMAN|MUSSO|SHARK|T8\b|T9\b|RD6|RIDDARA|S6\b|PIK UP|SCORPIO|ZNA RICH|RICH|CLASSIC|FULL|PLUS|LAND CRUISER 70|NAVARA|COLORADO|TACOMA|CANNON|POER|BIG HORN|FOTON TUNLAND|TUNLAND|ALPHA|HR\b)/, segmento: /^Pick Up$/i, clase: "Pick-up mediana" },
  { marca: /^ISUZU$/, nombre: /^TFS/, clase: "Pick-up mediana" }, // D-Max, por código de fábrica
  { marca: /^JIM$/, nombre: /./, clase: "Pick-up mediana" },
  { marca: /^JAC$/, nombre: /^(T8|T9|T6)/, clase: "Pick-up mediana" },
  { marca: /^FOTON$/, nombre: /^BJ2/, clase: "Pick-up mediana" }, // Tunland, por código de fábrica
  { marca: /^GAC$/, nombre: /^SE PICKUP/, clase: "Pick-up mediana" },
  { marca: /^MAHINDRA$/, nombre: /^S11/, clase: "Pick-up mediana" },
  { nombre: /^(SILVERADO|F150|F 150|1500|RAM 1500|TUNDRA|SIERRA|TITAN|F250|2500)/, clase: "Pick-up grande" },
  { marca: /^RAM$/, nombre: /^(1500|2500|3500)/, clase: "Pick-up grande" },
  // cabinas-chasis livianas que CADAM cuenta como pick-up
  { nombre: /^(X200|NHR|NKR|BJ10[34])/, clase: "Camión liviano" },

  // ---------------------------------------------------------- Automóvil
  { nombre: /^(HB20|SOLUTO|ONIX|GRAND I10|I10|PICANTO|POLO|ARGO|MOBI|AGYA|SWIFT|KWID|CELERIO|IGNIS|VERSA|208|C3\b|MIRAGE|SEAGULL|DOLPHIN|VIRTUS|ALSVIN|DZIRE|MARCH|ETIOS|RIO|ACCENT|YARIS|FIT|CITY|BALENO|CIAZ|LOGAN|SANDERO|SPARK|BEAT|UNO|CRONOS|SAIL|E30X|EV3|T03|ATTO 1|EMGRAND\b|EMGRAND GL|LEAF|E10X|ORA|GOOD CAT|FUNKY CAT|V5\b|E5\b)/, segmento: /^Automovil$/i, clase: "Auto chico" },
  { nombre: /^(K3\b|COROLLA|SENTRA|CERATO|ELANTRA|CIVIC|JETTA|LANCER|CRUZE|IMPREZA|MAZDA3|MAZDA 3|SEAL\b|CAMRY|ACCORD|SONATA|K5|OPTIMA|PASSAT|MALIBU|ARRIZO|BESTUNE|ES\b|AION ES|LEGACY|FOCUS|ASTRA|GOLF|308|408|C4\b|ARRIZO 5|ARRIZO 8|EMGRAND L|GEOMETRY A|A4\b)/, segmento: /^Automovil$/i, clase: "Auto mediano" },
  { nombre: /^(MUSTANG|WRX|CAMARO|CHALLENGER|SUPRA|GR86|GR YARIS|GR COROLLA|Z\b|370Z|400Z)/, clase: "Auto premium" },
  { marca: PREMIUM, nombre: /./, segmento: /^Automovil$/i, clase: "Auto premium" },
  { marca: /^ZEEKR$/, nombre: /^(001|007)/, clase: "Auto premium" },
  { marca: /^XPENG$/, nombre: /^(MONA|P7|P5)/, clase: "Auto premium" },
  { marca: /^(XIAOMI|AVATR)$/, nombre: /./, segmento: /^Automovil$/i, clase: "Auto premium" },
  { marca: /^DONGFENG$/, nombre: /^NANO/, clase: "Auto chico" },

  // -------------------------------------------------------------- Camión
  { nombre: /^(K2700|K2500|H100|H 100|PORTER|2TON|2 TON|N720|N822|N620|K01S|MINI TRUCK|SUPER ACE|EX6|X200|NHR|NKR|NLR|NMR|LD123|LD250|LD125|HOMAN|CARRY|MULTIVAN)/, segmento: /^(Camion|Pick Up|Furgon)$/i, clase: "Camión liviano" },
  { marca: /^ISUZU$/, nombre: /^Q[LM]R|^N[LM]R/, clase: "Camión liviano" },
  { marca: /^FOTON$/, nombre: /^BJ10[34]/, clase: "Camión liviano" },
  { marca: /^ISUZU$/, nombre: /^N[PQ]R|^NQR|^NPR/, clase: "Camión mediano" },
  { marca: /^ISUZU$/, nombre: /^(PHR|F[RSTV]R|GXR|FXR|EXR)/, clase: "Camión pesado" },
  { marca: /^FOTON$/, nombre: /^BJ1(0[6-9]|1)/, clase: "Camión mediano" },
  { marca: /^FOTON$/, nombre: /^BJ(3|4|5)/, clase: "Camión pesado" },
  { marca: /^HINO$/, nombre: /^(1[7-9]\d\d|2\d\d\d|500|700|FM|FG|SG)/, clase: "Camión pesado" },
  { marca: /^HINO$/, nombre: /^(\d{3,4}|300|XZU|WU)/, clase: "Camión mediano" },
  { marca: /^IVECO$/, nombre: /^(A[DST]\d|AT440)/, clase: "Camión pesado" },
  { marca: /^TATA$/, nombre: /^(SFC|407|LPT|ULTRA)/, clase: "Camión mediano" },
  { marca: /^(SANY|CLW|SHACMAN|HOWO|BEIBEN|XCMG)$/, nombre: /./, segmento: /^Camion$/i, clase: "Camión pesado" },
  { marca: /^MERCEDES BENZ$/, nombre: /^(ACCELO|ATEGO 1[0-6])/, clase: "Camión mediano" },
  { marca: /^MERCEDES BENZ$/, nombre: /^(ATEGO|ACTROS|AROCS|AXOR)/, clase: "Camión pesado" },
  { marca: /^VOLKSWAGEN$/, nombre: /^(9\.|11\.|10\.|13\.|14\.|DELIVERY)/, clase: "Camión mediano" },
  { marca: /^VOLKSWAGEN$/, nombre: /^(1[5-9]\.|2\d\.|3\d\.|CONSTELLATION|METEOR)/, clase: "Camión pesado" },
  { marca: /^HYUNDAI$/, nombre: /^(EX8|EX10|EX9|MIGHTY)/, clase: "Camión mediano" },
  { marca: /^HYUNDAI$/, nombre: /^(GT|XCIENT|HD)/, clase: "Camión pesado" },
  { marca: /^IVECO$/, nombre: /^(TECTOR|STRALIS|S WAY|SWAY|AS440|TRAKKER|HI WAY)/, clase: "Camión pesado" },
  { marca: /^IVECO$/, nombre: /^(DAILY)/, segmento: /^Camion$/i, clase: "Camión liviano" },
  { marca: /^SINOTRUK$/, nombre: /^(HOWO|T7|T5|SITRAK)/, clase: "Camión pesado" },
  { marca: /^SINOTRUK$/, nombre: /^HOMAN/, clase: "Camión mediano" },
  { marca: /^TATA$/, nombre: /^(LPT|PRIMA|SIGNA)/, clase: "Camión mediano" },
  { marca: /^JMC$/, nombre: /^(5\.6|CONVEY|N900)/, clase: "Camión mediano" },
  { marca: /^JAC$/, nombre: /^(LE|HFC|N\d)/, clase: "Camión mediano" },
  { marca: /^MITSUBISHI$/, nombre: /^(FUSO|CANTER)/, clase: "Camión mediano" },
  { marca: /^DFSK$/, nombre: /./, segmento: /^Camion$/i, clase: "Camión liviano" },
  { marca: /^(SCANIA|VOLVO|MAN|DAF|FREIGHTLINER|KENWORTH|INTERNATIONAL|SHACMAN|FAW|DONGFENG|JAC)$/, nombre: /./, segmento: /^Camion$/i, clase: "Camión pesado" },

  // -------------------------------------------------------------- Furgón
  { nombre: /^(FIORINO|PARTNER|BERLINGO|KANGOO|M201|DOBLO|CADDY|EXPRESS|STRADA FURGON|FIORINO)/, clase: "Furgón chico" },
  { nombre: /^(DAILY|SPRINTER|MASTER|TRANSIT|DUCATO|BOXER|JUMPER|CRAFTER|V90|G10|M60|SUNRAY|EX6|2TON|5\.6|HIACE|H1\b|STARIA|K05|K07|NV350|URVAN|VITO|EXPERT|TRAFIC|JUMPY|PROACE|DELIVER|V80)/, segmento: /^Furgon$/i, clase: "Furgón grande" },

  // ------------------------------------------------------------- Minibús
  { nombre: /./, segmento: /^Minibus$/i, clase: "Minibús" },
  { nombre: /./, segmento: /^Omnibus$/i, clase: "Ómnibus" },
];

const PREFIJOS = /^(ALL NEW|NEW GRAND|NEW|NUEVO|NUEVA|NOVA|NOVO|THE NEW|BRAND NEW|HAVAL) /;

/** Mayúsculas, sin acentos, sin guiones en los códigos, sin NEW/NUEVO. */
export function normalizarNombreClase(nombre: string): string {
  let n = String(nombre ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/(?<=[A-Z0-9])-(?=[A-Z0-9])/g, "")
    .replace(/[^A-Z0-9. ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  let antes = "";
  while (antes !== n) {
    antes = n;
    n = n.replace(PREFIJOS, "");
  }
  return n;
}

export type OrigenClase = "catalogo" | "precio" | "segmento";

export interface ClaseAsignada {
  clase: Clase;
  /** "catalogo" = está en la tabla; "precio" = inferida por segmento y
   *  precio; "segmento" = sin precio, queda en el segmento pelado. */
  origen: OrigenClase;
}

/** Sin tabla y con precio: la clase se infiere. Se dice en pantalla. */
function inferirPorPrecio(segmento: string, precio: number): Clase | null {
  const s = segmento.toUpperCase();
  if (s === "SUV") return precio < 20_000 ? "SUV chico" : precio < 30_000 ? "SUV compacto" : precio < 45_000 ? "SUV mediano" : "SUV grande";
  if (s === "PICK UP") return precio < 22_000 ? "Pick-up compacta" : precio < 60_000 ? "Pick-up mediana" : "Pick-up grande";
  if (s === "AUTOMOVIL") return precio < 18_000 ? "Auto chico" : precio < 32_000 ? "Auto mediano" : "Auto premium";
  if (s === "CAMION") return precio < 28_000 ? "Camión liviano" : precio < 70_000 ? "Camión mediano" : "Camión pesado";
  if (s === "FURGON") return precio < 25_000 ? "Furgón chico" : "Furgón grande";
  if (s === "MINIBUS") return "Minibús";
  if (s === "OMNIBUS") return "Ómnibus";
  return null;
}

export function claseDe(m: {
  marca: string;
  modelo: string;
  segmento: string;
  precio?: number | null;
}): ClaseAsignada {
  const marca = normalizarNombreClase(m.marca);
  const nombre = normalizarNombreClase(m.modelo);
  const segmento = m.segmento ?? "";
  for (const r of REGLAS) {
    if (r.marca && !r.marca.test(marca)) continue;
    if (r.segmento && !r.segmento.test(segmento)) continue;
    if (r.nombre.test(nombre)) return { clase: r.clase, origen: "catalogo" };
  }
  if (m.precio && m.precio > 0) {
    const inferida = inferirPorPrecio(segmento, m.precio);
    if (inferida) return { clase: inferida, origen: "precio" };
  }
  return { clase: segmento || "Sin clasificar", origen: "segmento" };
}

/** Posición de una clase en el orden de exhibición; las desconocidas
 *  (segmento pelado) van al final, en orden alfabético. */
export function ordenClase(clase: Clase): number {
  const i = CLASES_ORDEN.indexOf(clase);
  return i === -1 ? CLASES_ORDEN.length : i;
}
