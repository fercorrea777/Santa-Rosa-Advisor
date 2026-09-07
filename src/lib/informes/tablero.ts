import { getRankingModelos, type Filtro } from "@/lib/cadam/mercado";
import { getAsesoresMayoristasSet } from "@/lib/cadam/config";
import {
  asignarPrecios, armarMapa, etiquetaBanda, precioRelativo, rivalesDirectos, SIN_PRECIO,
  type PrecioCandidato,
} from "@/lib/cadam/bandas";
import { hoyEnAsuncion } from "@/lib/format";
import { calcularCobertura } from "./cobertura";
import { getDemandaBitrix, type DemandaBitrix } from "./demanda-bitrix";
import { getPautaMarca } from "./pauta-marca";
import { getPreciosCompetencia } from "./precios-competencia";
import { getStockPropio, getVentasAsesor, getVentasPropias } from "./propios";
import { tokens } from "./segmento-version";

/**
 * Los resúmenes del tablero en forma de datos, para quien no es una
 * pantalla: el Copiloto (herramienta leer_operacion_propia) y el Centro de
 * Inteligencia (reglas sobre nuestra operación). Es lo mismo que muestran
 * /operacion y /mapa, calculado una sola vez acá para que las tres cosas
 * digan el mismo número.
 *
 * Todo es agregado: nada del cliente entra ni sale. Y todo es del año en
 * curso (hora de Asunción), que es la ventana con la que trabaja el equipo
 * comercial; CADAM va aparte, con el período que le pasan.
 */

export const anioActual = () => Number(hoyEnAsuncion().slice(0, 4));
const enAnio = (periodo: string, anio: number) => periodo.startsWith(`${anio}-`);
const redondear = (v: number, d = 1) => Math.round(v * 10 ** d) / 10 ** d;

// ------------------------------------------------------------- asesores

export async function resumenAsesores(anio = anioActual()) {
  const filas = (await getVentasAsesor()).filter((a) => enAnio(a.periodo, anio));
  const mayoristas = getAsesoresMayoristasSet();
  const retail = new Map<string, { unidades: number; marcas: Map<string, number> }>();
  const mayor = new Map<string, number>();
  const porMarca = new Map<string, Map<string, number>>();
  for (const a of filas) {
    if (mayoristas.has(a.asesor)) {
      mayor.set(a.asesor, (mayor.get(a.asesor) ?? 0) + a.unidades);
      continue;
    }
    const x = retail.get(a.asesor) ?? { unidades: 0, marcas: new Map<string, number>() };
    x.unidades += a.unidades;
    x.marcas.set(a.marca, (x.marcas.get(a.marca) ?? 0) + a.unidades);
    retail.set(a.asesor, x);
    const m = porMarca.get(a.marca) ?? new Map<string, number>();
    m.set(a.asesor, (m.get(a.asesor) ?? 0) + a.unidades);
    porMarca.set(a.marca, m);
  }
  const ranking = [...retail.entries()]
    .map(([asesor, x]) => ({
      asesor,
      unidades: x.unidades,
      marcas: [...x.marcas.entries()].sort((a, b) => b[1] - a[1]).map(([m, n]) => `${m} ${n}`),
    }))
    .sort((a, b) => b.unidades - a.unidades);
  const mejorPorMarca = [...porMarca.entries()]
    .map(([marca, m]) => {
      const orden = [...m.entries()].sort((a, b) => b[1] - a[1]);
      return {
        marca,
        unidades: orden.reduce((s, [, n]) => s + n, 0),
        asesores: orden.length,
        mejor: orden[0][0],
        unidadesMejor: orden[0][1],
      };
    })
    .sort((a, b) => b.unidades - a.unidades);
  const periodos = [...new Set(filas.map((a) => a.periodo))].sort();
  return {
    anio,
    desde: periodos[0] ?? null,
    hasta: periodos[periodos.length - 1] ?? null,
    totalRetail: ranking.reduce((s, a) => s + a.unidades, 0),
    ranking: ranking.slice(0, 20),
    asesoresRetail: ranking.length,
    mayoristas: [...mayor.entries()].map(([asesor, unidades]) => ({ asesor, unidades })).sort((a, b) => b.unidades - a.unidades),
    mejorPorMarca,
    nota: "Una unidad es un vehículo (un VIN) en su primera factura, sin usados. Los mayoristas (flotas, gerencia) van aparte.",
  };
}

// -------------------------------------------------------------- demanda

export interface ResumenDemandaFila {
  leads: number;
  abiertos: number;
  convertidos: number;
  perdidos: number;
  /** Spam, duplicados, incontactables: nunca fueron un comprador. */
  descartados: number;
  negocios: number;
  negociosAbiertos: number;
  negociosGanados: number;
  negociosPerdidos: number;
  /** Motivos de pérdida, del más frecuente al menos. */
  motivos: { motivo: string; cantidad: number }[];
}

const NO_ERA_DEMANDA = /spam|falso|duplicad|repetid|incontactable/i;

function resumenVacio(): ResumenDemandaFila {
  return {
    leads: 0, abiertos: 0, convertidos: 0, perdidos: 0, descartados: 0,
    negocios: 0, negociosAbiertos: 0, negociosGanados: 0, negociosPerdidos: 0, motivos: [],
  };
}

function sumarDemanda(r: ResumenDemandaFila, d: DemandaBitrix, motivos: Map<string, number>) {
  if (d.origen === "lead") {
    r.leads += d.cantidad;
    if (d.estado === "abierto") r.abiertos += d.cantidad;
    else if (d.estado === "ganado") r.convertidos += d.cantidad;
    else if (NO_ERA_DEMANDA.test(d.motivo)) r.descartados += d.cantidad;
    else r.perdidos += d.cantidad;
  } else {
    r.negocios += d.cantidad;
    if (d.estado === "abierto") r.negociosAbiertos += d.cantidad;
    else if (d.estado === "ganado") r.negociosGanados += d.cantidad;
    else r.negociosPerdidos += d.cantidad;
  }
  if (d.estado === "perdido" && d.motivo && !NO_ERA_DEMANDA.test(d.motivo)) {
    motivos.set(d.motivo, (motivos.get(d.motivo) ?? 0) + d.cantidad);
  }
}

const ordenarMotivos = (m: Map<string, number>) =>
  [...m.entries()].sort((a, b) => b[1] - a[1]).map(([motivo, cantidad]) => ({ motivo, cantidad }));

/** Bitrix da la familia ("T2", "L200"); Cars la escribe a su manera ("L200
 *  TRITON"). Coinciden si la palabra de Bitrix está entre las de Cars. */
export const coincideFamilia = (familia: string, modeloCars: string) => tokens(modeloCars).includes(familia);

export async function resumenDemanda(anio = anioActual()) {
  const filas = (await getDemandaBitrix()).filter((d) => enAnio(d.periodo, anio));
  if (!filas.length) return null;
  const ventas = (await getVentasPropias()).filter((v) => enAnio(v.periodo, anio));
  const facturadoMarca = new Map<string, number>();
  for (const v of ventas) facturadoMarca.set(v.marca, (facturadoMarca.get(v.marca) ?? 0) + v.unidades);
  const facturadoModelo = (marca: string, familia: string) =>
    ventas.filter((v) => v.marca === marca && coincideFamilia(familia, v.modelo)).reduce((s, v) => s + v.unidades, 0);

  const total = resumenVacio();
  const motivosTotal = new Map<string, number>();
  const porMarca = new Map<string, { fila: ResumenDemandaFila; motivos: Map<string, number> }>();
  const porModelo = new Map<string, { marca: string; modelo: string; fila: ResumenDemandaFila; motivos: Map<string, number> }>();
  for (const d of filas) {
    sumarDemanda(total, d, motivosTotal);
    const m = porMarca.get(d.marca) ?? { fila: resumenVacio(), motivos: new Map<string, number>() };
    sumarDemanda(m.fila, d, m.motivos);
    porMarca.set(d.marca, m);
    if (d.modelo) {
      const k = `${d.marca}|${d.modelo}`;
      const x = porModelo.get(k) ?? { marca: d.marca, modelo: d.modelo, fila: resumenVacio(), motivos: new Map<string, number>() };
      sumarDemanda(x.fila, d, x.motivos);
      porModelo.set(k, x);
    }
  }
  const periodos = [...new Set(filas.map((d) => d.periodo))].sort();
  return {
    anio,
    desde: periodos[0],
    hasta: periodos[periodos.length - 1],
    total: { ...total, motivos: ordenarMotivos(motivosTotal).slice(0, 6) },
    porMarca: [...porMarca.entries()]
      .map(([marca, m]) => {
        const facturado = facturadoMarca.get(marca) ?? 0;
        return {
          marca, ...m.fila, motivos: ordenarMotivos(m.motivos).slice(0, 4), facturado,
          leadsPorVehiculo: facturado ? redondear(m.fila.leads / facturado) : null,
        };
      })
      .sort((a, b) => b.leads - a.leads),
    porModelo: [...porModelo.values()]
      .map((x) => ({
        marca: x.marca, modelo: x.modelo, ...x.fila, motivos: ordenarMotivos(x.motivos).slice(0, 4),
        facturado: facturadoModelo(x.marca, x.modelo),
      }))
      .sort((a, b) => b.leads + b.negocios - (a.leads + a.negocios))
      .slice(0, 25),
    coberturaModelo: {
      leadsConModelo: filas.filter((d) => d.origen === "lead" && d.modelo).reduce((s, d) => s + d.cantidad, 0),
      negociosConProducto: filas.filter((d) => d.origen === "negocio" && d.modelo).reduce((s, d) => s + d.cantidad, 0),
    },
    nota:
      "Leads y negocios de Bitrix por mes de creación. Abierto / convertido / perdido es la semántica de cada " +
      "estado; los descartados (spam, duplicados, incontactables) no son demanda perdida. Bitrix asigna la mayoría " +
      "de los leads a quienes califican, no a quien vende. El modelo solo se conoce cuando el título, la campaña o " +
      "el producto lo nombran: es una parte chica de los leads y se dice.",
  };
}

// ---------------------------------------------------------------- pauta

export async function resumenPauta(anio = anioActual()) {
  const filas = (await getPautaMarca()).filter((p) => enAnio(p.periodo, anio));
  if (!filas.length) return null;
  const ventas = (await getVentasPropias()).filter((v) => enAnio(v.periodo, anio));
  const facturadoMarca = new Map<string, number>();
  for (const v of ventas) facturadoMarca.set(v.marca, (facturadoMarca.get(v.marca) ?? 0) + v.unidades);
  const porMarca = new Map<string, { gasto: number; leads: number }>();
  for (const p of filas) {
    const x = porMarca.get(p.marca) ?? { gasto: 0, leads: 0 };
    x.gasto += Number(p.gasto_usd);
    x.leads += p.leads;
    porMarca.set(p.marca, x);
  }
  const periodos = [...new Set(filas.map((p) => p.periodo))].sort();
  const marcas = [...porMarca.entries()]
    .map(([marca, x]) => {
      const facturado = facturadoMarca.get(marca) ?? 0;
      return {
        marca, gastoUsd: Math.round(x.gasto), leads: x.leads, facturado,
        pautaPorVehiculoUsd: facturado ? Math.round(x.gasto / facturado) : null,
        costoPorLeadUsd: x.leads ? redondear(x.gasto / x.leads) : null,
      };
    })
    .sort((a, b) => b.gastoUsd - a.gastoUsd);
  const totalGasto = marcas.reduce((s, m) => s + m.gastoUsd, 0);
  const totalFacturado = [...facturadoMarca.values()].reduce((s, n) => s + n, 0);
  return {
    anio, desde: periodos[0], hasta: periodos[periodos.length - 1],
    totalGastoUsd: totalGasto,
    pautaPorVehiculoUsd: totalFacturado ? Math.round(totalGasto / totalFacturado) : null,
    marcas,
    nota:
      "Gasto en Meta por cuenta publicitaria y mes; la marca sale del nombre de la cuenta. Las cuentas de usados " +
      "(RENEW), de varias marcas o sin marca no se reparten. «Pauta por vehículo» es gasto sobre vehículos " +
      "facturados en Cars: un costo promedio, no una atribución.",
  };
}

// ------------------------------------------------------------- rivales

export async function resumenRivales(f: Filtro) {
  const modelos = getRankingModelos("matriculacion", { anio: f.anio, mesDesde: f.mesDesde, mesHasta: f.mesHasta }, 3000);
  let propios: PrecioCandidato[] = [];
  let carsDisponible = true;
  try {
    propios = (await getStockPropio())
      .filter((s) => s.precio_usd)
      .map((s) => ({ marca: s.marca, nombre: s.version, precio: s.precio_usd as number }));
  } catch {
    carsDisponible = false;
  }
  const competencia = await getPreciosCompetencia();
  const con = asignarPrecios(modelos, [
    { fuente: "cars", lista: propios },
    { fuente: "datacar", lista: competencia.map((p) => ({ marca: p.marca, nombre: p.version, precio: p.precio_usd })) },
  ]);
  const relativo = new Map(precioRelativo(con).map((p) => [`${p.propio.marca}|${p.propio.modelo}`, p]));
  const duelos = rivalesDirectos(con).filter((d) => d.propio.unidades >= 5);
  const mapa = armarMapa(con);
  return {
    carsDisponible,
    preciosCompetencia: competencia.length,
    modelosPropios: duelos.map((d) => {
      const r = relativo.get(`${d.propio.marca}|${d.propio.modelo}`);
      return {
        marca: d.propio.marca,
        modelo: d.propio.modelo,
        clase: d.propio.clase,
        claseInferidaPorPrecio: d.propio.claseOrigen !== "catalogo",
        unidades: d.propio.unidades,
        parteDeLaClase: d.unidadesClase ? redondear((100 * d.propio.unidades) / d.unidadesClase) : null,
        unidadesClase: d.unidadesClase,
        precioUsd: d.propio.precio,
        banda: d.propio.banda === SIN_PRECIO ? null : etiquetaBanda(d.propio.banda),
        medianaClaseUsd: r?.medianaClase ? Math.round(r.medianaClase) : null,
        diferenciaContraClasePct: r?.diferenciaClase != null ? redondear(100 * r.diferenciaClase) : null,
        rivalesEnClase: d.rivales.length,
        rivales: d.rivales.slice(0, 8).map((x) => ({
          marca: x.marca, modelo: x.modelo, unidades: x.unidades, precioUsd: x.precio,
          mismaBanda: x.mismaBanda, motorizacion: x.tecnologia ?? null,
        })),
      };
    }),
    mapa: [...mapa.celdas.values()].map((c) => ({
      clase: c.clase,
      banda: c.banda === SIN_PRECIO ? "sin precio" : etiquetaBanda(c.banda),
      mercado: c.mercado,
      nuestras: c.propias,
      parteNuestraPct: c.mercado ? redondear((100 * c.propias) / c.mercado) : 0,
    })),
    clases: mapa.clases.map((c) => ({
      clase: c,
      mercado: mapa.unidadesClase(c),
      nuestras: [...mapa.celdas.values()].filter((x) => x.clase === c).reduce((s, x) => s + x.propias, 0),
    })),
    nota:
      "Unidades: matriculaciones de CADAM del período. Clase: catálogo propio (SUV chico / compacto / mediano / " +
      "grande, pick-up compacta / mediana / grande, auto chico / mediano, camión liviano / mediano / pesado…): " +
      "el rival directo es el de la misma clase. Precios nuestros de Cars; de la competencia, de Datacar " +
      "(catálogo de terceros, no lista oficial).",
  };
}

// --------------------------------------------------------------- pedido

export async function resumenPedido() {
  const [stock, ventas, asesores] = await Promise.all([getStockPropio(), getVentasPropias(), getVentasAsesor()]);
  const cob = calcularCobertura(stock, ventas);
  const [m1, m2, m3] = cob.mesesRitmo;
  const mayoristas = getAsesoresMayoristasSet();
  const porAsesor = new Map<string, { antes: number; ultimo: number }>();
  for (const a of asesores) {
    if (mayoristas.has(a.asesor)) continue;
    const x = porAsesor.get(a.asesor) ?? { antes: 0, ultimo: 0 };
    if (a.periodo === m1 || a.periodo === m2) x.antes += a.unidades;
    if (a.periodo === m3) x.ultimo += a.unidades;
    porAsesor.set(a.asesor, x);
  }
  const parados = [...porAsesor.entries()]
    .filter(([, x]) => x.antes >= 3 && x.ultimo === 0)
    .sort((a, b) => b[1].antes - a[1].antes)
    .map(([asesor, x]) => ({ asesor, vehiculosAntes: x.antes }));
  const version = (v: (typeof cob.versiones)[number]) => ({
    marca: v.marca, modelo: v.modelo, version: v.version, libres: v.libres, reservadas: v.reservadas,
    enViaje: v.enViaje, ritmoMensual: redondear(v.ritmo), mesesDeStock: v.meses === null ? null : redondear(v.meses),
    mesesConViaje: v.mesesConViaje === null ? null : redondear(v.mesesConViaje), accion: v.accion,
  });
  return {
    mesesRitmo: cob.mesesRitmo,
    ultimoMesCerrado: m3,
    pedir: cob.pedir.map(version),
    empujar: cob.empujar.map(version),
    versionesConStockORitmo: cob.versiones.filter((v) => v.libres + v.enViaje > 0 || v.ritmo > 0).length,
    asesoresParados: parados,
    nota:
      "Ritmo = promedio de los últimos tres meses cerrados. Libres = vendibles menos reservadas; en viaje aparte. " +
      "Pedir: menos de un mes y medio de stock contando lo que viene; empujar: más de seis meses o casi sin ritmo " +
      "con stock. Parado: vendía 3+ vehículos en los dos meses anteriores y 0 en el último cerrado.",
  };
}
