import type { Filtro } from "@/lib/cadam/mercado";
import type { Item } from "@/lib/cadam/inteligencia";
import { formatUnidades } from "@/lib/format";
import { mesCorto } from "@/lib/periodo";
import { hayDatosPropios } from "./propios";
import {
  anioActual, coincideFamilia, resumenDemanda, resumenPauta, resumenPedido, resumenPresupuesto,
  resumenRivales,
} from "./tablero";

/**
 * Centro de Inteligencia, segunda mitad: lo que sale de NUESTRA operación
 * y del cruce del mercado por clase, no de CADAM solo. Mismo formato que
 * inteligencia.ts (reglas con umbral, evidencia numérica y período), para
 * que la pantalla las mezcle sin distinguir de dónde vienen.
 *
 * Cada fuente puede faltar (Cars caído, Bitrix sin push): se salta con una
 * advertencia, no se cae la lectura entera.
 */

const u = (n: number) => formatUnidades(n);
const coma = (n: number, d = 1) => n.toFixed(d).replace(".", ",");
const pct = (v: number) => `${coma(100 * v)} %`;

/** "2026-09" -> "Sep 2026". */
function mesLargo(periodo: string | null | undefined): string {
  if (!periodo) return "";
  return `${mesCorto(Number(periodo.slice(5, 7)))} ${periodo.slice(0, 4)}`;
}

export interface LecturaPropia {
  items: Item[];
  resumen: string[];
  advertencias: string[];
}

export async function generarLecturaPropia(f: Filtro, periodoCadam: string): Promise<LecturaPropia> {
  const items: Item[] = [];
  const resumen: string[] = [];
  const advertencias: string[] = [];
  const anio = anioActual();

  // ------------------------------------------------ Cars: stock y asesores
  let libresDe: (marca: string, familia: string) => number | null = () => null;
  try {
    if (await hayDatosPropios()) {
      const p = await resumenPedido();
      const periodo = `Stock de hoy · ritmo ${mesLargo(p.mesesRitmo[0])}–${mesLargo(p.mesesRitmo[2])} (Cars)`;
      const versiones = [...p.pedir, ...p.empujar];
      libresDe = (marca, familia) => {
        const xs = versiones.filter((v) => v.marca === marca && coincideFamilia(familia, v.modelo));
        return xs.length ? xs.reduce((s, v) => s + v.libres, 0) : null;
      };
      if (p.pedir.length) {
        items.push({
          tipo: "alerta",
          titulo: `${p.pedir.length} ${p.pedir.length === 1 ? "versión se queda" : "versiones se quedan"} sin stock en menos de un mes y medio`,
          motivo: "Se venden y lo que hay libre, contando lo que viene en viaje, no llega al mes y medio: hay que pedir ahora.",
          evidencia: p.pedir.slice(0, 4).map((v) => `${v.version}: ${v.libres} libres, ${coma(v.ritmoMensual)}/mes`).join(" · "),
          prioridad: p.pedir.length >= 5 ? "alta" : "media",
          impacto: "Pedido de stock",
          periodo,
        });
      }
      if (p.empujar.length) {
        items.push({
          tipo: "oportunidad",
          titulo: `${p.empujar.length} ${p.empujar.length === 1 ? "versión tiene" : "versiones tienen"} más de seis meses de stock`,
          motivo: "Plata parada: salen con promoción, con incentivo al asesor o se frena el próximo pedido.",
          evidencia: p.empujar.slice(0, 4).map((v) => `${v.version}: ${v.libres} libres${v.mesesDeStock !== null ? `, ${coma(v.mesesDeStock)} meses` : ", sin ritmo"}`).join(" · "),
          prioridad: p.empujar.length >= 10 ? "alta" : "media",
          impacto: "Promoción / freno de pedido",
          periodo,
        });
      }
      if (p.asesoresParados.length) {
        items.push({
          tipo: "riesgo",
          titulo: `${p.asesoresParados.length} ${p.asesoresParados.length === 1 ? "asesor retail dejó" : "asesores retail dejaron"} de facturar en ${mesLargo(p.ultimoMesCerrado)}`,
          motivo: "Vendían 3 o más vehículos en los dos meses anteriores y en el último mes cerrado no facturaron ninguno.",
          evidencia: p.asesoresParados.slice(0, 5).map((a) => `${a.asesor} (${a.vehiculosAntes} antes)`).join(" · "),
          prioridad: p.asesoresParados.length >= 3 ? "alta" : "media",
          periodo: `${mesLargo(p.mesesRitmo[0])}–${mesLargo(p.ultimoMesCerrado)} (Cars)`,
        });
      }
    } else {
      advertencias.push("Cars todavía no cargó facturación ni stock: las lecturas de pedido de stock y asesores no se generan.");
    }
  } catch {
    advertencias.push("Cars no respondió: las lecturas de pedido de stock y asesores no se generan en esta corrida.");
  }

  // ------------------------------------ presupuesto (Excel de Finanzas)
  try {
    const pr = await resumenPresupuesto(anio);
    if (pr) {
      const periodo = `Plan ${pr.version} · facturado a ${mesCorto(pr.ultimoMesCerrado)} ${anio} (Cars)`;
      if (pr.hechoTotal !== null) {
        resumen.push(
          `Presupuesto ${anio}: ${pct(pr.hechoTotal)} hecho a ${mesCorto(pr.ultimoMesCerrado)} ` +
          `(${u(pr.facturadoYtd)} facturados; plan vigente ${u(pr.planTotal)}).`
        );
      }
      for (const c of pr.canales) {
        if (c.cumplimiento === null) continue;
        resumen.push(
          `${c.canal === "CDE" ? "CDE" : "Wholesale"} ${anio}: ${u(c.realYtd)} vendidos contra ${u(c.objetivoYtd)} de objetivo ` +
          `a ${mesCorto(c.realHastaMes ?? 0)} (${pct(c.cumplimiento)}), según Finanzas; objetivo del año ${u(c.objetivoAnual)}.`
        );
      }
      if (pr.atrasados.length) {
        items.push({
          tipo: "riesgo",
          titulo: `${pr.atrasados.length} ${pr.atrasados.length === 1 ? "marca va" : "marcas van"} por debajo del ritmo que pide el plan ${anio}`,
          motivo: "El ritmo de los últimos tres meses cerrados no alcanza el que hace falta para llegar al plan del año en los meses que quedan.",
          evidencia: pr.atrasados.slice(0, 4).map((a) => `${a.marcas.join(" + ")}: ${coma(a.ritmo)}/mes, pide ${coma(a.necesario)}`).join(" · "),
          prioridad: pr.atrasados.some((a) => a.faltaPorMes >= 10) ? "alta" : "media",
          impacto: "Plan comercial",
          periodo,
        });
      }
    }
  } catch (e) {
    advertencias.push(`Presupuesto: ${(e as Error).message}`);
  }

  // ------------------------------------------------------ Bitrix: demanda
  try {
    const d = await resumenDemanda(anio);
    if (d) {
      const periodo = `${mesLargo(d.desde)}–${mesLargo(d.hasta)} (Bitrix)`;
      resumen.push(
        `Demanda en Bitrix: ${u(d.total.leads)} leads en el año, ${u(d.total.abiertos)} siguen abiertos, ` +
        `${u(d.total.convertidos)} se convirtieron y ${u(d.total.perdidos)} se perdieron` +
        (d.total.motivos[0] ? ` (el motivo más frecuente: ${d.total.motivos[0].motivo.toLowerCase()}, ${u(d.total.motivos[0].cantidad)})` : "") +
        `; ${u(d.total.descartados)} eran spam, duplicados o incontactables.`
      );
      // Demanda sin producto: muchos leads y casi nada facturado.
      for (const m of d.porMarca.filter((x) => x.leads >= 300 && x.facturado <= 5)) {
        items.push({
          tipo: "oportunidad",
          titulo: `${m.marca}: ${u(m.leads)} leads y ${m.facturado} ${m.facturado === 1 ? "vehículo facturado" : "vehículos facturados"}`,
          motivo: "Hay demanda registrada sin producto que entregar: es la marca con más leads por vehículo del año.",
          evidencia: `${u(m.abiertos)} abiertos · ${u(m.perdidos)} perdidos` + (m.motivos[0] ? ` (${m.motivos[0].motivo.toLowerCase()} ${u(m.motivos[0].cantidad)})` : ""),
          prioridad: "alta",
          impacto: "Producto / preventa",
          periodo,
        });
      }
      // Muchos leads por vehículo: se desaprovechan o son de baja calidad.
      for (const m of d.porMarca.filter((x) => x.facturado >= 30 && (x.leadsPorVehiculo ?? 0) >= 25)) {
        items.push({
          tipo: "riesgo",
          titulo: `${m.marca}: ${coma(m.leadsPorVehiculo ?? 0)} leads por cada vehículo facturado`,
          motivo: "Muy por encima del resto del grupo: o la demanda se desaprovecha en el seguimiento o los leads llegan de baja calidad.",
          evidencia: `${u(m.leads)} leads, ${u(m.facturado)} facturados, ${u(m.abiertos)} abiertos, ${u(m.perdidos)} perdidos` + (m.motivos[0] ? ` · ${m.motivos[0].motivo.toLowerCase()} ${u(m.motivos[0].cantidad)}` : ""),
          prioridad: "media",
          impacto: "Seguimiento comercial",
          periodo,
        });
      }
      // Se pierde por falta de stock.
      for (const m of d.porModelo) {
        const porStock = m.motivos.filter((x) => /stock/i.test(x.motivo)).reduce((s, x) => s + x.cantidad, 0);
        if (porStock < 3) continue;
        const libres = libresDe(m.marca, m.modelo);
        items.push({
          tipo: "alerta",
          titulo: `${m.marca} ${m.modelo}: ${porStock} ${porStock === 1 ? "lead perdido" : "leads perdidos"} por falta de stock`,
          motivo: libres === 0
            ? "Y hoy no hay unidades libres: cada lead que entra se pierde igual."
            : "El CRM registra la pérdida por stock; conviene cruzarlo con lo que hay libre hoy.",
          evidencia: `${u(m.leads + m.negocios)} de demanda en el año, ${u(m.abiertos + m.negociosAbiertos)} abiertos, ${u(m.facturado)} facturados` + (libres !== null ? `, ${libres} libres hoy` : ""),
          prioridad: libres === 0 ? "alta" : "media",
          impacto: "Pedido de stock",
          periodo,
        });
      }
      // Demanda abierta con stock para entregar.
      for (const m of d.porModelo.filter((x) => x.abiertos + x.negociosAbiertos >= 20)) {
        const libres = libresDe(m.marca, m.modelo);
        if (libres === null || libres < 5) continue;
        items.push({
          tipo: "oportunidad",
          titulo: `${m.marca} ${m.modelo}: ${u(m.abiertos + m.negociosAbiertos)} contactos abiertos y ${libres} unidades libres`,
          motivo: "Demanda registrada y stock para entregar: es el modelo para empujar con el equipo esta semana.",
          evidencia: `${u(m.leads + m.negocios)} de demanda en el año, ${u(m.facturado)} facturados`,
          prioridad: "media",
          impacto: "Seguimiento comercial",
          periodo,
        });
      }
    } else {
      advertencias.push("Bitrix todavía no cargó leads ni negocios: las lecturas de demanda no se generan.");
    }
  } catch {
    advertencias.push("No se pudo leer la demanda de Bitrix en esta corrida.");
  }

  // ------------------------------------------------------------ Meta: pauta
  try {
    const p = await resumenPauta(anio);
    if (p) {
      const periodo = `${mesLargo(p.desde)}–${mesLargo(p.hasta)} (Meta y Cars)`;
      if (p.pautaPorVehiculoUsd !== null) {
        resumen.push(
          `Pauta en Meta: US$ ${u(p.totalGastoUsd)} en el año, US$ ${u(p.pautaPorVehiculoUsd)} por cada vehículo facturado.`
        );
      }
      for (const m of p.marcas.filter((x) => x.gastoUsd >= 3000 && (x.pautaPorVehiculoUsd ?? 0) >= 500)) {
        items.push({
          tipo: "alerta",
          titulo: `${m.marca}: US$ ${u(m.pautaPorVehiculoUsd ?? 0)} de pauta por cada vehículo facturado`,
          motivo: "Muy por encima del promedio del grupo: la pauta no se está convirtiendo en ventas, o la marca vende poco por otro motivo.",
          evidencia: `US$ ${u(m.gastoUsd)} de pauta, ${u(m.facturado)} facturados, ${u(m.leads)} leads` + (m.costoPorLeadUsd !== null ? ` (US$ ${coma(m.costoPorLeadUsd)} por lead)` : ""),
          prioridad: "media",
          impacto: "Pauta",
          periodo,
        });
      }
    }
  } catch {
    advertencias.push("No se pudo leer la pauta de Meta en esta corrida.");
  }

  // ------------------------------------ CADAM + clases: huecos y precio
  try {
    const r = await resumenRivales(f);
    const periodo = `${periodoCadam} (CADAM y precios de lista)`;
    // Huecos: casilleros grandes del mercado donde casi no estamos.
    const huecos = r.mapa
      .filter((c) => c.banda !== "sin precio" && c.mercado >= 1000 && c.parteNuestraPct < 2)
      .sort((a, b) => b.mercado - a.mercado);
    for (const c of huecos.slice(0, 4)) {
      items.push({
        tipo: "oportunidad",
        titulo: `Hueco en ${c.clase} de US$ ${c.banda}: ${u(c.mercado)} unidades y ${c.parteNuestraPct === 0 ? "ninguna" : `${coma(c.parteNuestraPct)} %`} nuestra`,
        motivo: "El mercado compra ahí en volumen y no tenemos oferta, o la tenemos a otro precio.",
        evidencia: `${u(c.mercado)} u. en el casillero, ${u(c.nuestras)} nuestras`,
        prioridad: c.mercado >= 3000 ? "alta" : "media",
        impacto: "Producto / precio",
        periodo,
      });
    }
    // Fortalezas: clases donde tenemos una parte grande.
    for (const c of r.clases.filter((x) => x.mercado >= 300 && x.nuestras / x.mercado >= 0.2)) {
      items.push({
        tipo: "hallazgo",
        titulo: `${c.clase}: ${pct(c.nuestras / c.mercado)} de la clase es nuestro`,
        motivo: "Es una clase donde el grupo pesa: cuidar stock y precio ahí rinde más que en cualquier otra.",
        evidencia: `${u(c.nuestras)} de ${u(c.mercado)} unidades`,
        prioridad: "baja",
        periodo,
      });
    }
    // Precio contra la clase.
    for (const m of r.modelosPropios) {
      if (m.diferenciaContraClasePct === null || m.rivalesEnClase < 5 || m.precioUsd === null) continue;
      if (m.diferenciaContraClasePct >= 10) {
        items.push({
          tipo: "riesgo",
          titulo: `${m.modelo} está ${coma(m.diferenciaContraClasePct, 0)} % por encima de la mediana de su clase`,
          motivo: `Compite en ${m.clase} y la mitad de sus rivales cuesta menos: el precio es un argumento en contra.`,
          evidencia: `US$ ${u(m.precioUsd)} contra mediana US$ ${u(m.medianaClaseUsd ?? 0)} · ${u(m.unidades)} u., ${coma(m.parteDeLaClase ?? 0)} % de la clase`,
          prioridad: m.unidades >= 50 ? "media" : "baja",
          impacto: "Precio",
          periodo,
        });
      } else if (m.diferenciaContraClasePct <= -15 && (m.parteDeLaClase ?? 0) < 3) {
        items.push({
          tipo: "hallazgo",
          titulo: `${m.modelo} está ${coma(-m.diferenciaContraClasePct, 0)} % por debajo de su clase y tiene ${coma(m.parteDeLaClase ?? 0)} % de ella`,
          motivo: "El precio no es la barrera: lo que falta es presencia, pauta o argumento de producto.",
          evidencia: `US$ ${u(m.precioUsd)} contra mediana US$ ${u(m.medianaClaseUsd ?? 0)} · ${u(m.unidades)} de ${u(m.unidadesClase)} u. de la clase`,
          prioridad: m.unidades >= 50 ? "media" : "baja",
          impacto: "Comercial",
          periodo,
        });
      }
    }
    if (!r.carsDisponible) advertencias.push("Cars no respondió: el precio de nuestros modelos no entra en la lectura por clase.");
  } catch {
    advertencias.push("No se pudo armar la lectura por clase de vehículo en esta corrida.");
  }

  return { items, resumen, advertencias };
}
