import type { AccionesMes, AccionVersion } from "./acciones";
import {
  claveFamilia, cruzarVersiones, nombreDeClave, type FilaCars,
} from "./acciones-cruce";

/**
 * Rentabilidad por versión: la planilla de acciones (precio y margen) contra
 * lo que facturamos según Cars (unidades), versión por versión.
 *
 * Pedido de Fernando (18/09/2026): "una página de view: arriba el filtro
 * fijo de siempre; abajo un cuadro Marca | Modelo | Versión | PVP base |
 * Margen base | Margen % base; otro cuadro al lado con Cant. vendida |
 * Ticket prom. fact. | Margen promedio | Margen promedio %; ambas tablas con
 * su composición (% del total) abajo de cada valor, menos la de margen %;
 * después un gráfico de dispersión con burbujas, eje Y = cantidad vendida,
 * eje X = facturación o margen, en cuatro cuadrantes, con etiqueta de datos
 * y leyenda por marca. Probemos con esto primero."
 *
 * DE DÓNDE SALE CADA NÚMERO — y qué NO es
 * ----------------------------------------
 *  · PVP base, margen base y margen % base: la planilla, tal cual.
 *  · Cantidad vendida: unidades FACTURADAS según Cars en el período del
 *    filtro, cruzadas por versión (ver cruzarVersiones en acciones-cruce.ts).
 *  · Ticket y margen "promedio": Cars NO trae importes de factura
 *    confiables ni costo (ver propios.ts, "SIN PLATA, A PROPÓSITO"), así
 *    que no existe todavía el ticket real ni el margen realizado. Lo que se
 *    muestra es el precio y el margen CON DESCUENTO MÁXIMO de la planilla
 *    —el piso de la acción— multiplicados por las unidades facturadas. Es
 *    una estimación conservadora, hecha con los números del propio
 *    Fernando, y la pantalla lo dice. Cuando llegue el dato real (SAP), se
 *    reemplaza acá y la pantalla no cambia.
 *
 * Todo lo de este módulo es puro: la página trae la planilla y las filas de
 * Cars, y acá se arma lo que se muestra.
 */

export interface VersionRentabilidad {
  marca: string;
  clave: string;
  familia: string;
  version: string;
  segmento: string | null;
  /** Planilla: base. */
  pvp: number | null;
  margen: number | null;
  margenPct: number | null;
  /** Planilla: a precio con descuento máximo (el piso de la acción). Si la
   *  versión no tiene descuento, es el PVP y el margen base. */
  descuento: number;
  ticket: number | null;
  margenAccion: number | null;
  margenAccionPct: number | null;
  /** Cars: unidades facturadas en el período. null = sin pareja en Cars. */
  unidades: number | null;
  carsNombre: string | null;
  aproximado: boolean;
  /** unidades × ticket y unidades × margen de acción. */
  facturacion: number | null;
  /** unidades × el mismo precio SIN IVA, tal cual la planilla: es la base
   *  sobre la que Fernando calcula el margen %. */
  facturacionSinIva: number | null;
  margenTotal: number | null;
}

export interface SinCruce {
  nombre: string;
  unidades: number;
}

export interface FamiliaRentabilidad {
  marca: string;
  clave: string;
  nombre: string;
  versiones: VersionRentabilidad[];
  /** Unidades de Cars de la familia, EXACTAS: las cruzadas más las que
   *  quedaron sin pareja. */
  unidades: number;
  sinPareja: SinCruce[];
  facturacion: number;
  facturacionSinIva: number;
  margenTotal: number;
  /** Ticket y margen por unidad ponderados por unidades (solo cruzadas). */
  ticket: number | null;
  margenUnidad: number | null;
  margenPct: number | null;
}

export interface MarcaRentabilidad {
  marca: string;
  familias: FamiliaRentabilidad[];
  /** Filas de Cars de familias que la planilla no tiene. */
  sinPlanilla: SinCruce[];
  unidades: number;
}

export interface TotalesRentabilidad {
  versiones: number;
  versionesConVenta: number;
  /** Todas las unidades de Cars del filtro (cruzadas o no). */
  unidades: number;
  unidadesCruzadas: number;
  facturacion: number;
  facturacionSinIva: number;
  margenTotal: number;
  margenPct: number | null;
  /** Para la composición de la tabla base. */
  sumaPvp: number;
  sumaMargen: number;
}

export interface Rentabilidad {
  marcas: MarcaRentabilidad[];
  totales: TotalesRentabilidad;
}

export interface FiltroRentabilidad {
  marca?: string;
  segmento?: string;
  /** Clave o nombre de familia. */
  modelo?: string;
}

/**
 * Ticket, margen y margen % por unidad a precio de acción, más el precio SIN
 * IVA de la planilla. El margen % del Excel es margen ÷ precio sin IVA, y
 * el sin IVA no es siempre el de lista ÷ 1,1 (los eléctricos, por ejemplo,
 * tienen el mismo precio con y sin IVA): se usa la columna de la planilla y,
 * si falta, el que se deduce de su propio margen y margen %.
 */
function porUnidad(v: AccionVersion): {
  ticket: number | null; margen: number | null; pct: number | null; sinIva: number | null;
} {
  const deducido = (m: number | null, p: number | null) => (m !== null && p ? m / p : null);
  if ((v.descuento ?? 0) > 0 && v.precio_descuento !== null) {
    return {
      ticket: v.precio_descuento, margen: v.margen_descuento, pct: v.margen_descuento_pct,
      sinIva: v.precio_descuento_sin_iva ?? deducido(v.margen_descuento, v.margen_descuento_pct),
    };
  }
  return {
    ticket: v.pvp, margen: v.margen, pct: v.margen_pct,
    sinIva: v.pvp_sin_iva ?? deducido(v.margen, v.margen_pct),
  };
}

/**
 * Arma la vista a partir de la planilla del mes y las filas de Cars del
 * período (ya sumadas por marca + modelo + versión, con el precio de lista
 * del stock cuando lo hay).
 */
export function armarRentabilidad(
  acciones: AccionesMes,
  cars: (FilaCars & { marca: string })[],
  filtro: FiltroRentabilidad = {}
): Rentabilidad {
  const marcaSel = filtro.marca?.toUpperCase();
  const segmentoSel = filtro.segmento?.toUpperCase();
  const modeloSel = filtro.modelo?.toUpperCase().replace(/\s+/g, "");

  const marcas: MarcaRentabilidad[] = [];
  const totales: TotalesRentabilidad = {
    versiones: 0, versionesConVenta: 0, unidades: 0, unidadesCruzadas: 0,
    facturacion: 0, facturacionSinIva: 0, margenTotal: 0, margenPct: null, sumaPvp: 0, sumaMargen: 0,
  };

  for (const h of acciones.hojas) {
    if (marcaSel && h.marca.toUpperCase() !== marcaSel) continue;
    const versionesHoja = h.versiones.filter((v) => {
      if (segmentoSel && (v.segmento ?? "").toUpperCase() !== segmentoSel) return false;
      if (modeloSel && claveFamilia(h.marca, v.version) !== modeloSel) return false;
      return true;
    });
    if (!versionesHoja.length) continue;

    const filasCars = cars.filter((c) => c.marca === h.marca);
    const cruce = cruzarVersiones(h.marca, versionesHoja, filasCars);

    const orden: string[] = [];
    const porFamilia = new Map<string, FamiliaRentabilidad>();
    versionesHoja.forEach((v, i) => {
      const clave = claveFamilia(h.marca, v.version) || v.version.toUpperCase();
      let f = porFamilia.get(clave);
      if (!f) {
        f = {
          marca: h.marca, clave, nombre: nombreDeClave(clave), versiones: [],
          unidades: 0, sinPareja: [], facturacion: 0, facturacionSinIva: 0, margenTotal: 0,
          ticket: null, margenUnidad: null, margenPct: null,
        };
        porFamilia.set(clave, f);
        orden.push(clave);
      }
      const c = cruce.cruces[i];
      const pu = porUnidad(v);
      const unidades = c.cars ? c.cars.unidades : null;
      const fila: VersionRentabilidad = {
        marca: h.marca, clave, familia: f.nombre, version: v.version, segmento: v.segmento,
        pvp: v.pvp, margen: v.margen, margenPct: v.margen_pct,
        descuento: v.descuento ?? 0,
        ticket: pu.ticket, margenAccion: pu.margen, margenAccionPct: pu.pct,
        unidades, carsNombre: c.cars ? c.cars.version : null, aproximado: c.aproximado,
        facturacion: unidades !== null && pu.ticket !== null ? unidades * pu.ticket : null,
        facturacionSinIva: unidades !== null && pu.sinIva !== null ? unidades * pu.sinIva : null,
        margenTotal: unidades !== null && pu.margen !== null ? unidades * pu.margen : null,
      };
      f.versiones.push(fila);
      totales.versiones++;
      if (v.pvp !== null) totales.sumaPvp += v.pvp;
      if (v.margen !== null) totales.sumaMargen += v.margen;
      if (unidades !== null && unidades > 0) totales.versionesConVenta++;
      if (unidades !== null) {
        f.unidades += unidades;
        totales.unidadesCruzadas += unidades;
        totales.unidades += unidades;
      }
      if (fila.facturacion !== null) {
        f.facturacion += fila.facturacion;
        totales.facturacion += fila.facturacion;
      }
      // El margen % se suma solo donde hay margen Y base sin IVA: si una
      // versión tuviera margen sin precio sin IVA, inflaría el cociente.
      if (fila.facturacionSinIva !== null && fila.margenTotal !== null) {
        f.facturacionSinIva += fila.facturacionSinIva;
        totales.facturacionSinIva += fila.facturacionSinIva;
      }
      if (fila.margenTotal !== null) {
        f.margenTotal += fila.margenTotal;
        totales.margenTotal += fila.margenTotal;
      }
    });

    for (const [clave, filas] of cruce.sinPareja) {
      const f = porFamilia.get(clave);
      if (!f) continue;
      for (const r of filas) {
        f.sinPareja.push({ nombre: r.version, unidades: r.unidades });
        f.unidades += r.unidades;
        totales.unidades += r.unidades;
      }
    }
    // Filas de Cars sin familia en la planilla: solo si no se filtró por
    // modelo ni segmento (son de la marca entera, no de un recorte).
    const sinPlanilla: SinCruce[] = [];
    if (!modeloSel && !segmentoSel) {
      for (const r of cruce.sinPlanilla) {
        sinPlanilla.push({ nombre: r.modelo && r.modelo !== r.version ? `${r.modelo} · ${r.version}` : r.version, unidades: r.unidades });
        totales.unidades += r.unidades;
      }
    }

    const familias = orden.map((k) => porFamilia.get(k)!);
    for (const f of familias) {
      const cruzadas = f.versiones.reduce((s, v) => s + (v.unidades ?? 0), 0);
      if (cruzadas > 0) {
        f.ticket = f.facturacion / cruzadas;
        f.margenUnidad = f.margenTotal / cruzadas;
        f.margenPct = f.facturacionSinIva > 0 ? f.margenTotal / f.facturacionSinIva : null;
      }
    }
    marcas.push({
      marca: h.marca, familias, sinPlanilla,
      unidades: familias.reduce((s, f) => s + f.unidades, 0) + sinPlanilla.reduce((s, r) => s + r.unidades, 0),
    });
  }

  totales.margenPct = totales.facturacionSinIva > 0 ? totales.margenTotal / totales.facturacionSinIva : null;
  return { marcas, totales };
}

/** Un punto del gráfico: una versión (o una familia) con venta. */
export interface PuntoRentabilidad {
  marca: string;
  nombre: string;
  detalle: string;
  unidades: number;
  ticket: number;
  margenUnidad: number;
  margenPct: number | null;
  facturacion: number;
  facturacionSinIva: number;
  margenTotal: number;
  aproximado: boolean;
}

export function puntosRentabilidad(r: Rentabilidad, nivel: "version" | "modelo"): PuntoRentabilidad[] {
  const out: PuntoRentabilidad[] = [];
  for (const m of r.marcas) {
    for (const f of m.familias) {
      if (nivel === "modelo") {
        if (f.ticket === null || f.margenUnidad === null || f.unidades <= 0) continue;
        const cruzadas = f.versiones.reduce((s, v) => s + (v.unidades ?? 0), 0);
        out.push({
          marca: m.marca, nombre: f.nombre, detalle: `${f.versiones.length} ${f.versiones.length === 1 ? "versión" : "versiones"}`,
          unidades: cruzadas, ticket: f.ticket, margenUnidad: f.margenUnidad, margenPct: f.margenPct,
          facturacion: f.facturacion, facturacionSinIva: f.facturacionSinIva, margenTotal: f.margenTotal,
          aproximado: f.versiones.some((v) => v.aproximado),
        });
        continue;
      }
      for (const v of f.versiones) {
        if (v.unidades === null || v.unidades <= 0 || v.ticket === null || v.margenAccion === null) continue;
        out.push({
          marca: m.marca, nombre: v.version, detalle: v.carsNombre ?? "",
          unidades: v.unidades, ticket: v.ticket, margenUnidad: v.margenAccion, margenPct: v.margenAccionPct,
          facturacion: v.facturacion ?? 0, facturacionSinIva: v.facturacionSinIva ?? 0, margenTotal: v.margenTotal ?? 0,
          aproximado: v.aproximado,
        });
      }
    }
  }
  return out;
}
