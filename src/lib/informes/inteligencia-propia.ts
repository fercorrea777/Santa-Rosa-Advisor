import type { Filtro } from "@/lib/cadam/mercado";
import type { Item } from "@/lib/cadam/inteligencia";
import { BANDAS, etiquetaBandaI18n } from "@/lib/cadam/bandas";
import type { I18n } from "@/lib/i18n/crear";
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
 *
 * IDIOMA: igual que inteligencia.ts, escribe frases enteras con `t()` y las
 * cifras ya formateadas por `fmt`; el `i18n` lo trae quien llama (la página).
 */

export interface LecturaPropia {
  items: Item[];
  resumen: string[];
  advertencias: string[];
}

export async function generarLecturaPropia(
  f: Filtro,
  periodoCadam: string,
  i18n: I18n
): Promise<LecturaPropia> {
  const { t, fmt } = i18n;
  const { formatUnidades: u, decimal, mesCorto } = fmt;
  // Un porcentaje con espacio antes del % en castellano («12,1 %») y pegado en inglés («12.1%»).
  const pctDe = (porCiento: number, d = 1) => t("{n} %", { n: decimal(porCiento, d) });
  const pct = (v: number) => pctDe(100 * v);
  // resumenRivales (tablero.ts) trae la banda como etiqueta en castellano («15.000 a 21.000»), que es lo que
  // lee el Copiloto: se vuelve a su clave y se escribe en el idioma de la pantalla. Las clases se traducen
  // con t(clase) (sus nombres son frases marcadas con N_ en clases.ts).
  const banda = (etiqueta: string) => {
    const b = BANDAS.find((x) => x.etiqueta === etiqueta);
    return b ? etiquetaBandaI18n(b.clave, t, fmt) : etiqueta;
  };
  // «SIN MARCA» es la etiqueta que demanda-bitrix.ts le pone a los leads que no nombran ninguna marca:
  // un rótulo del tablero, no un dato de CADAM, así que se escribe en el idioma de la pantalla.
  const marcaDe = (marca: string) => (marca === "SIN MARCA" ? t("SIN MARCA") : marca);
  /** "2026-09" -> "Sep 2026". */
  const mesLargo = (periodo: string | null | undefined): string => {
    if (!periodo) return "";
    return `${mesCorto(Number(periodo.slice(5, 7)))} ${periodo.slice(0, 4)}`;
  };

  const items: Item[] = [];
  const resumen: string[] = [];
  const advertencias: string[] = [];
  const anio = anioActual();

  // ------------------------------------------------ Cars: stock y asesores
  let libresDe: (marca: string, familia: string) => number | null = () => null;
  try {
    if (await hayDatosPropios()) {
      const p = await resumenPedido();
      const periodo = t("Stock de hoy · ritmo {desde}–{hasta} (Cars)", {
        desde: mesLargo(p.mesesRitmo[0]), hasta: mesLargo(p.mesesRitmo[2]),
      });
      const versiones = [...p.pedir, ...p.empujar];
      libresDe = (marca, familia) => {
        const xs = versiones.filter((v) => v.marca === marca && coincideFamilia(familia, v.modelo));
        return xs.length ? xs.reduce((s, v) => s + v.libres, 0) : null;
      };
      if (p.pedir.length) {
        items.push({
          tipo: "alerta",
          titulo: p.pedir.length === 1
            ? t("{n} versión se queda sin stock en menos de un mes y medio", { n: p.pedir.length })
            : t("{n} versiones se quedan sin stock en menos de un mes y medio", { n: p.pedir.length }),
          motivo: t("Se venden y lo que hay libre, contando lo que viene en viaje, no llega al mes y medio: hay que pedir ahora."),
          evidencia: p.pedir.slice(0, 4).map((v) =>
            t("{version}: {libres} libres, {ritmo}/mes", { version: v.version, libres: v.libres, ritmo: decimal(v.ritmoMensual) })
          ).join(" · "),
          prioridad: p.pedir.length >= 5 ? "alta" : "media",
          impacto: t("Pedido de stock"),
          periodo,
        });
      }
      if (p.empujar.length) {
        items.push({
          tipo: "oportunidad",
          titulo: p.empujar.length === 1
            ? t("{n} versión tiene más de seis meses de stock", { n: p.empujar.length })
            : t("{n} versiones tienen más de seis meses de stock", { n: p.empujar.length }),
          motivo: t("Plata parada: salen con promoción, con incentivo al asesor o se frena el próximo pedido."),
          evidencia: p.empujar.slice(0, 4).map((v) =>
            v.mesesDeStock !== null
              ? t("{version}: {libres} libres, {meses} meses", { version: v.version, libres: v.libres, meses: decimal(v.mesesDeStock) })
              : t("{version}: {libres} libres, sin ritmo", { version: v.version, libres: v.libres })
          ).join(" · "),
          prioridad: p.empujar.length >= 10 ? "alta" : "media",
          impacto: t("Promoción / freno de pedido"),
          periodo,
        });
      }
      if (p.asesoresParados.length) {
        items.push({
          tipo: "riesgo",
          titulo: p.asesoresParados.length === 1
            ? t("{n} asesor retail dejó de facturar en {mes}", { n: p.asesoresParados.length, mes: mesLargo(p.ultimoMesCerrado) })
            : t("{n} asesores retail dejaron de facturar en {mes}", { n: p.asesoresParados.length, mes: mesLargo(p.ultimoMesCerrado) }),
          motivo: t("Vendían 3 o más vehículos en los dos meses anteriores y en el último mes cerrado no facturaron ninguno."),
          evidencia: p.asesoresParados.slice(0, 5).map((a) =>
            t("{asesor} ({n} antes)", { asesor: a.asesor, n: a.vehiculosAntes })
          ).join(" · "),
          prioridad: p.asesoresParados.length >= 3 ? "alta" : "media",
          periodo: `${mesLargo(p.mesesRitmo[0])}–${mesLargo(p.ultimoMesCerrado)} (Cars)`,
        });
      }
    } else {
      advertencias.push(t("Cars todavía no cargó facturación ni stock: las lecturas de pedido de stock y asesores no se generan."));
    }
  } catch {
    advertencias.push(t("Cars no respondió: las lecturas de pedido de stock y asesores no se generan en esta corrida."));
  }

  // ------------------------------------ presupuesto (Excel de Finanzas)
  try {
    const pr = await resumenPresupuesto(anio);
    if (pr) {
      const periodo = t("Plan {version} · facturado a {mes} {anio} (Cars)", {
        version: pr.version, mes: mesCorto(pr.ultimoMesCerrado), anio,
      });
      if (pr.hechoTotal !== null) {
        resumen.push(
          t("Presupuesto {anio}: {hecho} hecho a {mes} ({facturado} facturados; plan vigente {plan}).", {
            anio, hecho: pct(pr.hechoTotal), mes: mesCorto(pr.ultimoMesCerrado),
            facturado: u(pr.facturadoYtd), plan: u(pr.planTotal),
          })
        );
      }
      for (const c of pr.canales) {
        if (c.cumplimiento === null) continue;
        resumen.push(
          t("{canal} {anio}: {real} vendidos contra {objetivo} de objetivo a {mes} ({cumplimiento}), según Finanzas; objetivo del año {anual}.", {
            canal: c.canal === "CDE" ? "CDE" : "Wholesale", anio, real: u(c.realYtd), objetivo: u(c.objetivoYtd),
            mes: mesCorto(c.realHastaMes ?? 0), cumplimiento: pct(c.cumplimiento), anual: u(c.objetivoAnual),
          })
        );
      }
      if (pr.atrasados.length) {
        items.push({
          tipo: "riesgo",
          titulo: pr.atrasados.length === 1
            ? t("{n} marca va por debajo del ritmo que pide el plan {anio}", { n: pr.atrasados.length, anio })
            : t("{n} marcas van por debajo del ritmo que pide el plan {anio}", { n: pr.atrasados.length, anio }),
          motivo: t("El ritmo de los últimos tres meses cerrados no alcanza el que hace falta para llegar al plan del año en los meses que quedan."),
          evidencia: pr.atrasados.slice(0, 4).map((a) =>
            t("{marcas}: {ritmo}/mes, pide {necesario}", {
              marcas: a.marcas.join(" + "), ritmo: decimal(a.ritmo), necesario: decimal(a.necesario),
            })
          ).join(" · "),
          prioridad: pr.atrasados.some((a) => a.faltaPorMes >= 10) ? "alta" : "media",
          impacto: t("Plan comercial"),
          periodo,
        });
      }
    }
  } catch (e) {
    advertencias.push(t("Presupuesto: {mensaje}", { mensaje: (e as Error).message }));
  }

  // ------------------------------------------------------ Bitrix: demanda
  try {
    const d = await resumenDemanda(anio);
    if (d) {
      const periodo = `${mesLargo(d.desde)}–${mesLargo(d.hasta)} (Bitrix)`;
      const demanda = {
        leads: u(d.total.leads), abiertos: u(d.total.abiertos), convertidos: u(d.total.convertidos),
        perdidos: u(d.total.perdidos), descartados: u(d.total.descartados),
        motivo: d.total.motivos[0] ? d.total.motivos[0].motivo.toLowerCase() : "",
        cantidad: d.total.motivos[0] ? u(d.total.motivos[0].cantidad) : "",
      };
      resumen.push(
        d.total.motivos[0]
          ? t("Demanda en Bitrix: {leads} leads en el año, {abiertos} siguen abiertos, {convertidos} se convirtieron y {perdidos} se perdieron (el motivo más frecuente: {motivo}, {cantidad}); {descartados} eran spam, duplicados o incontactables.", demanda)
          : t("Demanda en Bitrix: {leads} leads en el año, {abiertos} siguen abiertos, {convertidos} se convirtieron y {perdidos} se perdieron; {descartados} eran spam, duplicados o incontactables.", demanda)
      );
      // Demanda sin producto: muchos leads y casi nada facturado.
      for (const m of d.porMarca.filter((x) => x.leads >= 300 && x.facturado <= 5)) {
        const mv = {
          abiertos: u(m.abiertos), perdidos: u(m.perdidos),
          motivo: m.motivos[0] ? m.motivos[0].motivo.toLowerCase() : "",
          cantidad: m.motivos[0] ? u(m.motivos[0].cantidad) : "",
        };
        items.push({
          tipo: "oportunidad",
          titulo: m.facturado === 1
            ? t("{marca}: {leads} leads y {n} vehículo facturado", { marca: marcaDe(m.marca), leads: u(m.leads), n: m.facturado })
            : t("{marca}: {leads} leads y {n} vehículos facturados", { marca: marcaDe(m.marca), leads: u(m.leads), n: m.facturado }),
          motivo: t("Hay demanda registrada sin producto que entregar: es la marca con más leads por vehículo del año."),
          evidencia: m.motivos[0]
            ? t("{abiertos} abiertos · {perdidos} perdidos ({motivo} {cantidad})", mv)
            : t("{abiertos} abiertos · {perdidos} perdidos", mv),
          prioridad: "alta",
          impacto: t("Producto / preventa"),
          periodo,
        });
      }
      // Muchos leads por vehículo: se desaprovechan o son de baja calidad.
      for (const m of d.porMarca.filter((x) => x.facturado >= 30 && (x.leadsPorVehiculo ?? 0) >= 25)) {
        const mv = {
          leads: u(m.leads), facturados: u(m.facturado), abiertos: u(m.abiertos), perdidos: u(m.perdidos),
          motivo: m.motivos[0] ? m.motivos[0].motivo.toLowerCase() : "",
          cantidad: m.motivos[0] ? u(m.motivos[0].cantidad) : "",
        };
        items.push({
          tipo: "riesgo",
          titulo: t("{marca}: {n} leads por cada vehículo facturado", { marca: marcaDe(m.marca), n: decimal(m.leadsPorVehiculo ?? 0) }),
          motivo: t("Muy por encima del resto del grupo: o la demanda se desaprovecha en el seguimiento o los leads llegan de baja calidad."),
          evidencia: m.motivos[0]
            ? t("{leads} leads, {facturados} facturados, {abiertos} abiertos, {perdidos} perdidos · {motivo} {cantidad}", mv)
            : t("{leads} leads, {facturados} facturados, {abiertos} abiertos, {perdidos} perdidos", mv),
          prioridad: "media",
          impacto: t("Seguimiento comercial"),
          periodo,
        });
      }
      // Se pierde por falta de stock.
      for (const m of d.porModelo) {
        const porStock = m.motivos.filter((x) => /stock/i.test(x.motivo)).reduce((s, x) => s + x.cantidad, 0);
        if (porStock < 3) continue;
        const libres = libresDe(m.marca, m.modelo);
        const mv = {
          demanda: u(m.leads + m.negocios), abiertos: u(m.abiertos + m.negociosAbiertos),
          facturados: u(m.facturado), libres: libres ?? 0,
        };
        items.push({
          tipo: "alerta",
          titulo: porStock === 1
            ? t("{marca} {modelo}: {n} lead perdido por falta de stock", { marca: m.marca, modelo: m.modelo, n: porStock })
            : t("{marca} {modelo}: {n} leads perdidos por falta de stock", { marca: m.marca, modelo: m.modelo, n: porStock }),
          motivo: libres === 0
            ? t("Y hoy no hay unidades libres: cada lead que entra se pierde igual.")
            : t("El CRM registra la pérdida por stock; conviene cruzarlo con lo que hay libre hoy."),
          evidencia: libres !== null
            ? t("{demanda} de demanda en el año, {abiertos} abiertos, {facturados} facturados, {libres} libres hoy", mv)
            : t("{demanda} de demanda en el año, {abiertos} abiertos, {facturados} facturados", mv),
          prioridad: libres === 0 ? "alta" : "media",
          impacto: t("Pedido de stock"),
          periodo,
        });
      }
      // Demanda abierta con stock para entregar.
      for (const m of d.porModelo.filter((x) => x.abiertos + x.negociosAbiertos >= 20)) {
        const libres = libresDe(m.marca, m.modelo);
        if (libres === null || libres < 5) continue;
        items.push({
          tipo: "oportunidad",
          titulo: t("{marca} {modelo}: {abiertos} contactos abiertos y {libres} unidades libres", {
            marca: m.marca, modelo: m.modelo, abiertos: u(m.abiertos + m.negociosAbiertos), libres,
          }),
          motivo: t("Demanda registrada y stock para entregar: es el modelo para empujar con el equipo esta semana."),
          evidencia: t("{demanda} de demanda en el año, {facturados} facturados", {
            demanda: u(m.leads + m.negocios), facturados: u(m.facturado),
          }),
          prioridad: "media",
          impacto: t("Seguimiento comercial"),
          periodo,
        });
      }
    } else {
      advertencias.push(t("Bitrix todavía no cargó leads ni negocios: las lecturas de demanda no se generan."));
    }
  } catch {
    advertencias.push(t("No se pudo leer la demanda de Bitrix en esta corrida."));
  }

  // ------------------------------------------------------------ Meta: pauta
  try {
    const p = await resumenPauta(anio);
    if (p) {
      const periodo = t("{desde}–{hasta} (Meta y Cars)", { desde: mesLargo(p.desde), hasta: mesLargo(p.hasta) });
      if (p.pautaPorVehiculoUsd !== null) {
        resumen.push(
          t("Pauta en Meta: US$ {total} en el año, US$ {porVehiculo} por cada vehículo facturado.", {
            total: u(p.totalGastoUsd), porVehiculo: u(p.pautaPorVehiculoUsd),
          })
        );
      }
      for (const m of p.marcas.filter((x) => x.gastoUsd >= 3000 && (x.pautaPorVehiculoUsd ?? 0) >= 500)) {
        const mv = {
          gasto: u(m.gastoUsd), facturados: u(m.facturado), leads: u(m.leads),
          costo: m.costoPorLeadUsd !== null ? decimal(m.costoPorLeadUsd) : "",
        };
        items.push({
          tipo: "alerta",
          titulo: t("{marca}: US$ {porVehiculo} de pauta por cada vehículo facturado", {
            marca: m.marca, porVehiculo: u(m.pautaPorVehiculoUsd ?? 0),
          }),
          motivo: t("Muy por encima del promedio del grupo: la pauta no se está convirtiendo en ventas, o la marca vende poco por otro motivo."),
          evidencia: m.costoPorLeadUsd !== null
            ? t("US$ {gasto} de pauta, {facturados} facturados, {leads} leads (US$ {costo} por lead)", mv)
            : t("US$ {gasto} de pauta, {facturados} facturados, {leads} leads", mv),
          prioridad: "media",
          impacto: t("Pauta"),
          periodo,
        });
      }
    }
  } catch {
    advertencias.push(t("No se pudo leer la pauta de Meta en esta corrida."));
  }

  // ------------------------------------ CADAM + clases: huecos y precio
  try {
    const r = await resumenRivales(f);
    const periodo = t("{periodo} (CADAM y precios de lista)", { periodo: periodoCadam });
    // Huecos: casilleros grandes del mercado donde casi no estamos.
    const huecos = r.mapa
      .filter((c) => c.banda !== "sin precio" && c.mercado >= 1000 && c.parteNuestraPct < 2)
      .sort((a, b) => b.mercado - a.mercado);
    for (const c of huecos.slice(0, 4)) {
      const hueco = { clase: t(c.clase), banda: banda(c.banda), n: u(c.mercado) };
      items.push({
        tipo: "oportunidad",
        titulo: c.parteNuestraPct === 0
          ? t("Hueco en {clase} de US$ {banda}: {n} unidades y ninguna nuestra", hueco)
          : t("Hueco en {clase} de US$ {banda}: {n} unidades y {parte} nuestra", {
              ...hueco, parte: pctDe(c.parteNuestraPct),
            }),
        motivo: t("El mercado compra ahí en volumen y no tenemos oferta, o la tenemos a otro precio."),
        evidencia: t("{mercado} u. en el casillero, {nuestras} nuestras", {
          mercado: u(c.mercado), nuestras: u(c.nuestras),
        }),
        prioridad: c.mercado >= 3000 ? "alta" : "media",
        impacto: t("Producto / precio"),
        periodo,
      });
    }
    // Fortalezas: clases donde tenemos una parte grande.
    for (const c of r.clases.filter((x) => x.mercado >= 300 && x.nuestras / x.mercado >= 0.2)) {
      items.push({
        tipo: "hallazgo",
        titulo: t("{clase}: {parte} de la clase es nuestro", { clase: t(c.clase), parte: pct(c.nuestras / c.mercado) }),
        motivo: t("Es una clase donde el grupo pesa: cuidar stock y precio ahí rinde más que en cualquier otra."),
        evidencia: t("{nuestras} de {mercado} unidades", { nuestras: u(c.nuestras), mercado: u(c.mercado) }),
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
          titulo: t("{modelo} está {diferencia} por encima de la mediana de su clase", {
            modelo: m.modelo, diferencia: pctDe(m.diferenciaContraClasePct, 0),
          }),
          motivo: t("Compite en {clase} y la mitad de sus rivales cuesta menos: el precio es un argumento en contra.", { clase: t(m.clase) }),
          evidencia: t("US$ {precio} contra mediana US$ {mediana} · {unidades} u., {parte} de la clase", {
            precio: u(m.precioUsd), mediana: u(m.medianaClaseUsd ?? 0), unidades: u(m.unidades),
            parte: pctDe(m.parteDeLaClase ?? 0),
          }),
          prioridad: m.unidades >= 50 ? "media" : "baja",
          impacto: t("Precio"),
          periodo,
        });
      } else if (m.diferenciaContraClasePct <= -15 && (m.parteDeLaClase ?? 0) < 3) {
        items.push({
          tipo: "hallazgo",
          titulo: t("{modelo} está {diferencia} por debajo de su clase y tiene {parte} de ella", {
            modelo: m.modelo, diferencia: pctDe(-m.diferenciaContraClasePct, 0),
            parte: pctDe(m.parteDeLaClase ?? 0),
          }),
          motivo: t("El precio no es la barrera: lo que falta es presencia, pauta o argumento de producto."),
          evidencia: t("US$ {precio} contra mediana US$ {mediana} · {unidades} de {unidadesClase} u. de la clase", {
            precio: u(m.precioUsd), mediana: u(m.medianaClaseUsd ?? 0), unidades: u(m.unidades),
            unidadesClase: u(m.unidadesClase),
          }),
          prioridad: m.unidades >= 50 ? "media" : "baja",
          impacto: t("Comercial"),
          periodo,
        });
      }
    }
    if (!r.carsDisponible) advertencias.push(t("Cars no respondió: el precio de nuestros modelos no entra en la lectura por clase."));
  } catch {
    advertencias.push(t("No se pudo armar la lectura por clase de vehículo en esta corrida."));
  }

  return { items, resumen, advertencias };
}
