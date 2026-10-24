import { LOCALE, type Idioma } from "./idioma";
import type { T } from "./traducir";

/**
 * Todo lo que se escribe distinto según el idioma y no es una frase: números,
 * porcentajes, fechas, nombres de mes y de segmento.
 *
 * ES-PY (castellano): miles con punto (`42.328`), decimales con coma (`12,1 %`,
 * `+1,8 pp`). EN-US (inglés): miles con coma (`42,328`), decimales con punto
 * (`12.1%`, `+1.8 pp`). No es un detalle de gusto: un `42.328` en una pantalla
 * en inglés se lee como cuarenta y dos coma tres. Por eso el formato viaja con
 * el idioma y TODA cifra que se muestre pasa por acá (`fmt.formatUnidades`,
 * `fmt.formatPct`…), no por `toLocaleString` suelto ni por `toFixed` + reemplazo.
 *
 * Se obtiene con `fmt` de `getI18n()` (servidor) o de `useI18n()` (cliente), y
 * los nombres son los mismos de siempre: se destructura una vez al principio de
 * la pantalla y el resto del código no se entera.
 *
 * Los CSV que se exportan quedan con punto decimal y sin separador de miles en
 * los dos idiomas: son para máquinas.
 */

/**
 * Zona horaria de TODO lo que muestre fecha u hora: Paraguay, UTC−3 FIJO.
 *
 * Por qué un desplazamiento fijo y no `timeZone: "America/Asuncion"`: el
 * contenedor de producción corre en UTC (TZ vacío), y el Node de adentro
 * trae una tabla de zonas horarias vieja que para Asunción en septiembre
 * todavía aplica UTC−4 —el horario de invierno que Paraguay abolió en
 * octubre de 2024 (UTC−3 todo el año)—. Con el nombre IANA, la sincronización
 * de las 14:25 salía como "13:25": una hora mal, pero al revés que antes
 * (con la zona del servidor salía "17:25"). El offset fijo no depende de qué
 * tabla tenga el runtime. Si Paraguay volviera a cambiar la hora, se cambia
 * este número y nada más.
 */
export const DESPLAZAMIENTO_PY_MIN = -3 * 60;

function aFecha(v: string | number | Date | null | undefined): Date | null {
  if (v === null || v === undefined || v === "") return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** El mismo instante corrido al huso paraguayo, para formatearlo "en UTC". */
function enParaguay(d: Date): Date {
  return new Date(d.getTime() + DESPLAZAMIENTO_PY_MIN * 60_000);
}

/** "2026-09-04": la fecha de HOY en Paraguay, para cálculos y claves.
 *  `toISOString().slice(0, 10)` daba la de UTC, que de 21:00 a 24:00 es la
 *  de mañana. Como el instante ya viene corrido, el ISO en UTC es la fecha
 *  local. No depende del idioma. */
export function hoyEnAsuncion(ahora: Date = new Date()): string {
  return enParaguay(ahora).toISOString().slice(0, 10);
}

/** Siglas que se escriben en mayúsculas aunque el resto del nombre no. */
const SIGLAS_MARCA = new Set([
  "JAC", "JMEV", "GWM", "BYD", "MG", "BMW", "KGM", "DFSK", "GAC", "KIA",
  "JMC", "BAIC", "FAW", "SAIC", "RAM", "AION",
]);

/**
 * "GREAT WALL" → "Great Wall", "JAC" → "JAC". CADAM y el resto del tablero
 * escriben las marcas en mayúsculas, que en una tabla está bien; en un
 * rótulo corto que se repite en fila (pestañas) grita. Solo para mostrar:
 * los filtros y las claves siguen con el nombre tal cual. Es igual en los dos
 * idiomas: las marcas no se traducen.
 */
export function nombreDeMarca(marca: string): string {
  if (marca === "LYNK&CO") return "Lynk&Co";
  return marca
    .split(/\s+/)
    .map((p) => (SIGLAS_MARCA.has(p) || p.length <= 2 ? p : p[0] + p.slice(1).toLowerCase()))
    .join(" ");
}

// i18n-ignore-start (tablas por idioma: el castellano es el dato, no un texto a traducir)
const MESES_CORTOS: Record<Idioma, string[]> = {
  es: ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
};

const MESES_LARGOS: Record<Idioma, string[]> = {
  es: [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ],
  en: [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ],
};

/**
 * CADAM manda los segmentos sin tilde (CAMION, FURGON, OMNIBUS) y así quedan
 * como clave en la base y en la URL. Esto es solo para MOSTRARLOS: nunca se
 * usa como valor de un filtro.
 */
const SEGMENTO: Record<Idioma, Record<string, string>> = {
  es: {
    automovil: "Automóvil",
    camion: "Camión",
    furgon: "Furgón",
    minibus: "Minibús",
    omnibus: "Ómnibus",
  },
  en: {
    automovil: "Passenger car",
    camion: "Truck",
    furgon: "Van",
    minibus: "Minibus",
    omnibus: "Bus",
    "pick up": "Pickup",
    "sin clasificar": "Unclassified",
  },
};

// i18n-ignore-end

type Corte = { anio: number; mes: number } | null;
const orden = (c: { anio: number; mes: number }) => c.anio * 12 + c.mes;

export interface Formatos {
  idioma: Idioma;
  /** El `locale` de Intl (es-PY | en-US), por si hace falta uno propio. */
  locale: string;
  mesesCortos: readonly string[];
  mesesLargos: readonly string[];
  /** "04/09/2026 12:42" | "Sep 4, 2026 12:42", en hora de Paraguay. "—" si no hay fecha. */
  formatFechaHora(v: string | number | Date | null | undefined): string;
  /** "04/09/2026" | "Sep 4, 2026", en hora de Paraguay. "—" si no hay fecha. */
  formatFecha(v: string | number | Date | null | undefined): string;
  /** Unidades enteras con separador de miles: 42.328 | 42,328. */
  formatUnidades(n: number): string;
  /** Un decimal en el idioma de la pantalla (12,1 | 12.1). Sin miles. */
  decimal(n: number, d?: number): string;
  formatPct(v: number | null, opts?: { signed?: boolean }): string;
  formatPuntosPct(v: number): string;
  /** Cuántos meses de stock, ritmo, razones: un decimal, "—" si no hay. */
  formatDecimal(n: number | null | undefined, d?: number): string;
  nombreDeSegmento(segmento: string): string;
  nombreDeMarca(marca: string): string;
  nombreDeGrupo(grupo: string): string;
  mesCorto(mes: number): string;
  etiquetaCorte(periodo: string | null | undefined): string;
  etiquetaCortes(cobertura: {
    snapshot: string | null;
    matriculacion: { ultimo: Corte };
    importacion: { ultimo: Corte };
  }): string;
  aclaracionCortes(cobertura: {
    matriculacion: { ultimo: Corte };
    importacion: { ultimo: Corte };
  }): string | undefined;
  /** 'Ene–Jun 2026' | 'Mayo 2026'  ·  'Jan–Jun 2026' | 'May 2026' */
  etiquetaPeriodo(anio: number, desde: number, hasta: number): string;
}

export function crearFormatos(idioma: Idioma, t: T): Formatos {
  const locale = LOCALE[idioma];
  const en = idioma === "en";
  const numero = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const mesesCortos = MESES_CORTOS[idioma];
  const mesesLargos = MESES_LARGOS[idioma];
  const fechaHora = new Intl.DateTimeFormat(locale, en
    ? { timeZone: "UTC", month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }
    : { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const soloFecha = new Intl.DateTimeFormat(locale, en
    ? { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" }
    : { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" });

  const mesCorto = (mes: number) => mesesCortos[mes - 1] ?? String(mes);

  /**
   * Un decimal como se lee en el idioma: 12,1 y no 12.1 en castellano.
   *
   * Las unidades ya salen con punto de miles (`formatUnidades`: 42.328); un
   * porcentaje con punto decimal al lado ("+49.8%") se lee como cuarenta y nueve
   * mil ochocientos. Todo lo que muestre un decimal pasa por acá.
   *
   * Un redondeo que cae en cero no lleva signo: `(-0.04).toFixed(1)` da "-0.0",
   * y una variación de "-0,0%" parece un dato en rojo que no es.
   */
  const decimal = (n: number, d = 1): string => {
    const base = n.toFixed(d);
    const texto = en ? base : base.replace(".", ",");
    return /^-0([.,]0+)?$/.test(texto) ? texto.slice(1) : texto;
  };

  const etiquetaCorte = (periodo: string | null | undefined): string => {
    if (!periodo) return "—";
    const [anio, mes] = periodo.split("-");
    const m = mesCorto(Number(mes));
    return anio && m ? `${m} ${anio}` : periodo;
  };

  return {
    idioma,
    locale,
    mesesCortos,
    mesesLargos,

    formatFechaHora(v) {
      const d = aFecha(v);
      if (!d) return "—";
      const texto = fechaHora.format(enParaguay(d));
      // es-PY: "04/09/2026, 12:42" → sin la coma. en-US: "Sep 4, 2026, 12:42" → ídem.
      return en ? texto.replace(/, (\d{2}:\d{2})$/, " $1") : texto.replace(", ", " ");
    },

    formatFecha(v) {
      const d = aFecha(v);
      return d ? soloFecha.format(enParaguay(d)) : "—";
    },

    formatUnidades: (n) => numero.format(n),

    decimal,

    formatPct(v, opts) {
      if (v === null || !Number.isFinite(v)) return "—";
      const pct = v * 100;
      const sign = opts?.signed && pct > 0 ? "+" : "";
      return `${sign}${decimal(pct, 1)}%`;
    },

    formatPuntosPct(v) {
      const sign = v > 0 ? "+" : "";
      return `${sign}${decimal(v * 100, 1)} pp`;
    },

    formatDecimal: (n, d = 1) => (n === null || n === undefined || !Number.isFinite(n) ? "—" : decimal(n, d)),

    nombreDeSegmento: (segmento) => SEGMENTO[idioma][segmento.trim().toLowerCase()] ?? segmento,

    nombreDeMarca,

    /**
     * Un grupo de marcas (el importador que las representa) como se lee: CADAM lo
     * escribe en mayúsculas en EMPRESA (GARDEN, TAPE RUVICHA, DE LA SOBERA). OTROS
     * es el cajón de los importadores chicos. Lo que ya viene con minúsculas (la
     * etiqueta de «sin representante») se deja como está.
     */
    nombreDeGrupo(grupo) {
      if (grupo === "OTROS") return t("Otros importadores");
      if (grupo !== grupo.toUpperCase()) return grupo;
      const chicas = new Set(["DE", "DEL", "LA", "LOS", "Y"]);
      return grupo
        .split(/\s+/)
        .map((p, i) =>
          chicas.has(p)
            // «De la Sobera»: la partícula va en minúscula salvo al empezar.
            ? i > 0 ? p.toLowerCase() : p[0] + p.slice(1).toLowerCase()
            : nombreDeMarca(p)
        )
        .join(" ");
    },

    mesCorto,

    /**
     * El corte de datos, en criollo: '2026-08' -> 'Ago 2026'.
     *
     * El pie de cada pantalla decía «snapshot 2026-08». «Snapshot» es una palabra
     * de máquina: nombra cómo se guarda el dato, no qué significa. Lo que el
     * lector necesita saber es hasta cuándo llegan los números, y eso se dice
     * «datos hasta Ago 2026».
     */
    etiquetaCorte,

    /**
     * Hasta dónde llega cada fuente, para la píldora de fuente de cada pantalla.
     *
     * «datos hasta Ago 2026» mentía a medias cuando las dos fuentes no van
     * parejas: en septiembre de 2026 CADAM ya había publicado la importación de
     * agosto y la matriculación llegaba a julio. Croman (15/09/2026): "ponéme
     * nomás una aclaración de que las matriculaciones son hasta julio y que
     * agosto ya tenemos las importaciones". Cuando coinciden vuelve al texto
     * corto de siempre.
     */
    etiquetaCortes(cobertura) {
      const m = cobertura.matriculacion.ultimo;
      const i = cobertura.importacion.ultimo;
      if (m && i && (m.anio !== i.anio || m.mes !== i.mes)) {
        return t("matriculaciones hasta {m} · importaciones hasta {i}", {
          m: `${mesCorto(m.mes)} ${m.anio}`,
          i: `${mesCorto(i.mes)} ${i.anio}`,
        });
      }
      return t("datos hasta {corte}", { corte: etiquetaCorte(cobertura.snapshot) });
    },

    /**
     * La aclaración de las pantallas que muestran las dos fuentes, cuando no
     * van parejas. Antes decía siempre «CADAM ya publicó la importación…»: en
     * sep-2026 era cierto, pero en oct-2026 la que iba adelante era la
     * matriculación (septiembre, con la importación en agosto) y el texto
     * afirmaba lo contrario de lo que pasaba.
     */
    aclaracionCortes(cobertura) {
      const m = cobertura.matriculacion.ultimo;
      const i = cobertura.importacion.ultimo;
      if (!m || !i || orden(m) === orden(i)) return undefined;
      const adelante = orden(i) > orden(m) ? "importacion" : "matriculacion";
      const conAnio = m.anio !== i.anio;
      const mes = (c: { anio: number; mes: number }) => `${mesCorto(c.mes)}${conAnio ? ` ${c.anio}` : ""}`;
      const [lider, atras] = adelante === "importacion" ? [i, m] : [m, i];
      const varios = orden(lider) - orden(atras) > 1;
      const meses = varios
        ? `${mes({ anio: atras.mes === 12 ? atras.anio + 1 : atras.anio, mes: (atras.mes % 12) + 1 })}–${mes(lider)}`
        : mes(lider);
      const vars = { m: mes(m), i: mes(i), meses };
      if (adelante === "importacion") {
        return varios
          ? t("Matriculaciones hasta {m} · importaciones hasta {i}: CADAM ya publicó la importación de {meses}, la matriculación de esos meses todavía no.", vars)
          : t("Matriculaciones hasta {m} · importaciones hasta {i}: CADAM ya publicó la importación de {meses}, la matriculación de ese mes todavía no.", vars);
      }
      return varios
        ? t("Matriculaciones hasta {m} · importaciones hasta {i}: CADAM ya publicó la matriculación de {meses}, la importación de esos meses todavía no.", vars)
        : t("Matriculaciones hasta {m} · importaciones hasta {i}: CADAM ya publicó la matriculación de {meses}, la importación de ese mes todavía no.", vars);
    },

    etiquetaPeriodo(anio, desde, hasta) {
      if (desde === hasta) {
        const m = mesesLargos[desde - 1] ?? String(desde);
        return `${m[0].toUpperCase()}${m.slice(1)} ${anio}`;
      }
      return `${mesCorto(desde)}–${mesCorto(hasta)} ${anio}`;
    },
  };
}
