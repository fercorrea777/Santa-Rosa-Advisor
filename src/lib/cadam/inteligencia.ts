import {
  getBrecha, getCobertura, getKpi, getPorDimension, getRankingMarcas,
  getRankingModelos, TECNOLOGIAS, type Filtro,
} from "./mercado";
import {
  calcularEstacionalidad, calcularTendencia, detectarAnomalias,
  getSerieHistorica, getTrayectorias, proyectarCierre,
} from "./historico";
import { getMarcasPropiasSet, getParametros } from "./config";
import { MESES_LARGOS } from "@/lib/periodo";

/**
 * Centro de Inteligencia Comercial (spec sec. 19).
 *
 * Motor de REGLAS, sin IA externa. Cada item lleva su evidencia numerica
 * y el periodo del que sale, para que se pueda auditar.
 *
 * Principio que atraviesa todo el modulo: NO generar conclusiones
 * categoricas cuando los datos no alcanzan. Cada regla declara su umbral
 * minimo de base (`MIN_BASE`) y se calla si no lo alcanza, en vez de
 * reportar un "+800%" que sale de 1 a 9 unidades.
 */

/** Debajo de esto una variacion porcentual no significa nada. */
const MIN_BASE = 30;
/** Variacion que se considera abrupta y merece alerta. */
const UMBRAL_ABRUPTO = 0.5;
/** Cambio de participacion (pp) que se considera relevante. */
const UMBRAL_PP = 1.0;

export type Prioridad = "alta" | "media" | "baja";
export type Tipo = "hallazgo" | "alerta" | "oportunidad" | "riesgo"
  | "recomendacion" | "historico";

export interface Item {
  tipo: Tipo;
  titulo: string;
  /** Por que importa, en una frase. */
  motivo: string;
  /** Los numeros que lo sostienen. */
  evidencia: string;
  prioridad: Prioridad;
  impacto?: string;
  periodo: string;
}

export interface Informe {
  periodo: string;
  resumen: string[];
  items: Item[];
  datosSuficientes: boolean;
  advertencias: string[];
}

const pct = (v: number | null) =>
  v === null ? "—" : `${v > 0 ? "+" : ""}${(v * 100).toFixed(1)}%`;
const pp = (v: number) => `${v > 0 ? "+" : ""}${(v * 100).toFixed(1)} pp`;
const u = (n: number) => new Intl.NumberFormat("es-PY").format(n);

export function generarInforme(f: Filtro, etiquetaPeriodo: string): Informe {
  const cobertura = getCobertura();
  const items: Item[] = [];
  const advertencias: string[] = [];
  const propias = getMarcasPropiasSet();
  const parametros = getParametros();
  const competidores = new Set(parametros.competidores_clave);

  const anioPrevio = f.anio - 1;
  const hayBase = cobertura.matriculacion.anios.includes(anioPrevio);
  if (!hayBase) {
    advertencias.push(
      `No hay datos de ${anioPrevio} cargados, así que no se puede comparar ` +
      `contra el año anterior. Los hallazgos que dependen de esa comparación ` +
      `no se generan.`
    );
  }

  const kpiMat = getKpi("matriculacion", f);
  const kpiImp = getKpi("importacion", f);
  const marcas = getRankingMarcas("matriculacion", f);
  const modelos = getRankingModelos("matriculacion", f, 400);
  const segmentos = getPorDimension("matriculacion", "segmento", f);
  const tecnologias = getPorDimension("matriculacion", "tecnologia", f);

  // Solo se evalua lo que tiene base suficiente en el periodo anterior.
  const marcasConBase = marcas.filter((m) => m.unidadesAnterior >= MIN_BASE);
  const modelosConBase = modelos.filter((m) => m.unidadesAnterior >= MIN_BASE);

  // ---------------------------------------------------------- resumen
  const resumen: string[] = [];
  resumen.push(
    `En ${etiquetaPeriodo} se matricularon ${u(kpiMat.valor)} unidades` +
    (kpiMat.variacion !== null
      ? `, ${kpiMat.variacion >= 0 ? "un alza" : "una baja"} de ${pct(kpiMat.variacion)} ` +
        `frente a las ${u(kpiMat.baseValor)} del mismo período de ${anioPrevio}.`
      : `. No hay período anterior cargado para comparar.`)
  );
  resumen.push(
    `Las importaciones sumaron ${u(kpiImp.valor)} unidades` +
    (kpiImp.variacion !== null ? ` (${pct(kpiImp.variacion)})` : "") +
    `. La diferencia contra matriculación es de ${u(Math.abs(kpiImp.valor - kpiMat.valor))} ` +
    `unidades a favor de ${kpiImp.valor > kpiMat.valor ? "la importación" : "la matriculación"}, ` +
    `una señal orientativa y no una medida de stock.`
  );
  if (marcas.length) {
    resumen.push(
      `Lidera ${marcas[0].marca} con ${u(marcas[0].unidades)} unidades ` +
      `(${(marcas[0].participacion * 100).toFixed(1)}% del mercado).`
    );
  }
  const propiasU = marcas.filter((m) => propias.has(m.marca))
    .reduce((s, m) => s + m.unidades, 0);
  const totalU = marcas.reduce((s, m) => s + m.unidades, 0) || 1;
  resumen.push(
    `Las marcas propias suman ${u(propiasU)} unidades, ` +
    `${((propiasU / totalU) * 100).toFixed(1)}% del mercado.`
  );

  // -------------------------------------------------------- hallazgos
  const crecen = [...marcasConBase]
    .filter((m) => m.variacion !== null && m.variacion > 0)
    .sort((a, b) => (b.unidades - b.unidadesAnterior) - (a.unidades - a.unidadesAnterior));
  const caen = [...marcasConBase]
    .filter((m) => m.variacion !== null && m.variacion < 0)
    .sort((a, b) => (a.unidades - a.unidadesAnterior) - (b.unidades - b.unidadesAnterior));

  if (crecen.length) {
    const top = crecen.slice(0, 3);
    items.push({
      tipo: "hallazgo",
      titulo: `${top[0].marca} lidera el crecimiento en unidades`,
      motivo: "Es quien más volumen agregó al mercado en el período; marca la dirección de la demanda.",
      evidencia: top.map((m) =>
        `${m.marca}: ${u(m.unidadesAnterior)} → ${u(m.unidades)} u. (${pct(m.variacion)}, ${m.unidades - m.unidadesAnterior > 0 ? "+" : ""}${u(m.unidades - m.unidadesAnterior)} u.)`
      ).join(" · "),
      prioridad: "media",
      periodo: etiquetaPeriodo,
    });
  }
  if (caen.length) {
    const top = caen.slice(0, 3);
    items.push({
      tipo: "hallazgo",
      titulo: `${top[0].marca} lidera la caída en unidades`,
      motivo: "Pérdida de volumen sostenida sobre una base relevante.",
      evidencia: top.map((m) =>
        `${m.marca}: ${u(m.unidadesAnterior)} → ${u(m.unidades)} u. (${pct(m.variacion)})`
      ).join(" · "),
      prioridad: "media",
      periodo: etiquetaPeriodo,
    });
  }

  const modCrecen = [...modelosConBase]
    .filter((m) => m.variacion !== null && m.variacion > 0)
    .sort((a, b) => (b.unidades - b.unidadesAnterior) - (a.unidades - a.unidadesAnterior));
  if (modCrecen.length) {
    items.push({
      tipo: "hallazgo",
      titulo: `Modelos que más crecieron`,
      motivo: "El movimiento a nivel modelo anticipa el de la marca.",
      evidencia: modCrecen.slice(0, 5).map((m) =>
        `${m.marca} ${m.modelo}: ${u(m.unidadesAnterior)} → ${u(m.unidades)} u. (${pct(m.variacion)})`
      ).join(" · "),
      prioridad: "media",
      periodo: etiquetaPeriodo,
    });
  }

  // Modelos nuevos: aparecen ahora y no existian antes, con volumen real.
  const nuevos = modelos
    .filter((m) => m.unidadesAnterior === 0 && m.unidades >= 20)
    .sort((a, b) => b.unidades - a.unidades);
  if (nuevos.length && hayBase) {
    items.push({
      tipo: "hallazgo",
      titulo: `${nuevos.length} modelos nuevos con volumen relevante`,
      motivo: "No tenían matriculaciones en el período anterior: son lanzamientos o ingresos al mercado.",
      evidencia: nuevos.slice(0, 6).map((m) => `${m.marca} ${m.modelo} (${u(m.unidades)} u.)`).join(" · "),
      prioridad: "media",
      impacto: `${u(nuevos.reduce((s, m) => s + m.unidades, 0))} unidades en total`,
      periodo: etiquetaPeriodo,
    });
  }

  // Segmentos en expansion / retroceso, por cambio de participacion.
  for (const s of segmentos) {
    if (s.deltaParticipacion === null || s.unidadesAnterior < MIN_BASE) continue;
    if (Math.abs(s.deltaParticipacion * 100) < UMBRAL_PP) continue;
    const sube = s.deltaParticipacion > 0;
    items.push({
      tipo: "hallazgo",
      titulo: `El segmento ${s.valor} ${sube ? "gana" : "pierde"} peso en el mercado`,
      motivo: sube
        ? "Está creciendo más rápido que el mercado: se lleva participación de los demás."
        : "Crece menos que el mercado (o cae): otros segmentos le sacan participación.",
      evidencia: `${u(s.unidadesAnterior)} → ${u(s.unidades)} u. (${pct(s.variacion)}), ` +
                 `participación ${pp(s.deltaParticipacion)} hasta ${(s.participacion * 100).toFixed(1)}%`,
      prioridad: Math.abs(s.deltaParticipacion * 100) >= 3 ? "alta" : "media",
      periodo: etiquetaPeriodo,
    });
  }

  // Tecnologias con mayor adopcion.
  const tecOrden = new Map(TECNOLOGIAS.map((t, i) => [t as string, i]));
  const tecCrecen = tecnologias
    .filter((t) => t.variacion !== null && t.valor !== "ICE" && t.unidades >= 50)
    .sort((a, b) => (b.variacion ?? 0) - (a.variacion ?? 0));
  if (tecCrecen.length) {
    items.push({
      tipo: "hallazgo",
      titulo: `${tecCrecen[0].valor} es la tecnología de mayor crecimiento`,
      motivo: "La adopción de tecnologías alternativas marca hacia dónde va el mix de producto.",
      evidencia: tecCrecen.slice(0, 4)
        .sort((a, b) => (tecOrden.get(a.valor) ?? 9) - (tecOrden.get(b.valor) ?? 9))
        .map((t) => `${t.valor}: ${u(t.unidadesAnterior)} → ${u(t.unidades)} u. (${pct(t.variacion)})`)
        .join(" · "),
      prioridad: "alta",
      periodo: etiquetaPeriodo,
    });
  }

  // ---------------------------------------------------------- alertas
  // Una marca genera UNA alerta, no dos. Si ya salta por variacion
  // abrupta, el cambio de posicion va dentro de esa misma evidencia en
  // vez de repetir la marca en otro item.
  const yaAlertadas = new Set<string>();

  for (const m of marcasConBase) {
    if (m.variacion === null || Math.abs(m.variacion) < UMBRAL_ABRUPTO) continue;
    if (m.unidades < 50 && m.unidadesAnterior < 50) continue;
    const esNuestra = propias.has(m.marca);
    const esCompetidor = competidores.has(m.marca);
    if (!esNuestra && !esCompetidor && Math.abs(m.variacion) < 1) continue;
    yaAlertadas.add(m.marca);
    const sube = m.variacion > 0;
    items.push({
      tipo: "alerta",
      titulo: `${sube ? "Crecimiento abrupto" : "Caída abrupta"} de ${m.marca}` +
              (esNuestra ? " (marca propia)" : esCompetidor ? " (competidor clave)" : ""),
      motivo: sube
        ? "Un salto de esta magnitud cambia el equilibrio competitivo del período."
        : "Una caída de esta magnitud sobre una base relevante requiere explicación.",
      evidencia: `${u(m.unidadesAnterior)} → ${u(m.unidades)} u. (${pct(m.variacion)}), ` +
                 `participación ${(m.participacion * 100).toFixed(1)}%` +
                 (m.cambioPosicion
                   ? `, ${m.cambioPosicion > 0 ? "sube" : "baja"} ${Math.abs(m.cambioPosicion)} ` +
                     `posición${Math.abs(m.cambioPosicion) === 1 ? "" : "es"} ` +
                     `(${m.posicionAnterior} → ${m.posicion})`
                   : ""),
      prioridad: esNuestra || esCompetidor ? "alta" : "media",
      periodo: etiquetaPeriodo,
    });
  }

  // Cambios fuertes de posicion SIN variacion abrupta: se mueve en el
  // ranking porque el resto del mercado se movio, que es otra historia.
  for (const m of marcas.slice(0, 25)) {
    if (yaAlertadas.has(m.marca)) continue;
    if (m.cambioPosicion === null || Math.abs(m.cambioPosicion) < 4) continue;
    if (m.unidades < 100) continue;
    const sube = m.cambioPosicion > 0;
    items.push({
      tipo: "alerta",
      titulo: `${m.marca} ${sube ? "sube" : "baja"} ${Math.abs(m.cambioPosicion)} posiciones ` +
              `sin un cambio abrupto de volumen`,
      motivo: "Se movió en el ranking por lo que hicieron las demás, no por su propio volumen.",
      evidencia: `Posición ${m.posicionAnterior} → ${m.posicion} · ` +
                 `${u(m.unidades)} u. (${pct(m.variacion)})`,
      prioridad: propias.has(m.marca) || competidores.has(m.marca) ? "alta" : "baja",
      periodo: etiquetaPeriodo,
    });
  }

  // Brecha importacion/matriculacion.
  const brecha = getBrecha([f.anio]).filter((p) => p.mes >= f.mesDesde && p.mes <= f.mesHasta);
  const totImp = brecha.reduce((s, p) => s + (p.importaciones ?? 0), 0);
  const totMat = brecha.reduce((s, p) => s + (p.matriculaciones ?? 0), 0);
  if (totImp && totMat) {
    const rel = totMat / totImp;
    if (rel < 0.9 || rel > 1.1) {
      items.push({
        tipo: "alerta",
        titulo: rel < 0.9
          ? "Se está importando bastante más de lo que se patenta"
          : "Se está patentando bastante más de lo que se importa",
        motivo: "Una brecha sostenida sugiere un cambio de ritmo entre el ingreso de unidades y su venta. " +
                "Es orientativo: no equivale a stock real.",
        evidencia: `Importación ${u(totImp)} u. vs matriculación ${u(totMat)} u. ` +
                   `Relación matric./import. ${rel.toFixed(2)}`,
        prioridad: "media",
        periodo: etiquetaPeriodo,
      });
    }
  }

  // Calidad de datos como alerta de primera clase.
  if (cobertura.mesesFaltantes.matriculacion.length) {
    items.push({
      tipo: "alerta",
      titulo: "Faltan meses en la serie de matriculación",
      motivo: "Un hueco en el histórico distorsiona promedios, tendencias y proyecciones.",
      evidencia: `Meses sin datos en el origen: ${cobertura.mesesFaltantes.matriculacion.join(", ")}`,
      prioridad: "media",
      periodo: etiquetaPeriodo,
    });
  }
  if (cobertura.primerAnioConSegmento !== null && f.anio < cobertura.primerAnioConSegmento) {
    items.push({
      tipo: "alerta",
      titulo: `Sin clasificación de segmento en ${f.anio}`,
      motivo: "CADAM no publica el segmento antes de " + cobertura.primerAnioConSegmento +
              ": el análisis por segmento de este año no es posible.",
      evidencia: `El segmento aparece recién desde ${cobertura.primerAnioConSegmento}.`,
      prioridad: "baja",
      periodo: etiquetaPeriodo,
    });
  }

  // ----------------------------------------------------- oportunidades
  for (const s of segmentos) {
    if (s.unidades < 200) continue;
    const marcasSeg = getRankingMarcas("matriculacion", { ...f, segmento: s.valor });
    const propiasSeg = marcasSeg.filter((m) => propias.has(m.marca))
      .reduce((acc, m) => acc + m.unidades, 0);
    const share = s.unidades ? propiasSeg / s.unidades : 0;
    const creciendo = s.variacion !== null && s.variacion > 0.15;
    if (share < 0.05 && creciendo) {
      items.push({
        tipo: "oportunidad",
        titulo: `Baja participación propia en ${s.valor}, que además está creciendo`,
        motivo: "Segmento en expansión donde las marcas propias casi no están presentes.",
        evidencia: `Segmento ${u(s.unidades)} u. (${pct(s.variacion)}); marcas propias ` +
                   `${u(propiasSeg)} u. = ${(share * 100).toFixed(1)}% del segmento`,
        prioridad: "alta",
        impacto: `Cada punto de participación en este segmento son ~${u(Math.round(s.unidades / 100))} unidades`,
        periodo: etiquetaPeriodo,
      });
    }
  }

  for (const t of tecnologias) {
    if (t.valor === "ICE" || t.variacion === null || t.unidades < 50) continue;
    if (t.variacion < 0.5) continue;
    const marcasTec = getRankingMarcas("matriculacion", { ...f, tecnologia: t.valor });
    const propiasTec = marcasTec.filter((m) => propias.has(m.marca))
      .reduce((acc, m) => acc + m.unidades, 0);
    const share = t.unidades ? propiasTec / t.unidades : 0;
    items.push({
      tipo: share < 0.1 ? "oportunidad" : "hallazgo",
      titulo: share < 0.1
        ? `${t.valor} crece fuerte y las marcas propias casi no participan`
        : `Posición fuerte en ${t.valor}, una tecnología en expansión`,
      motivo: share < 0.1
        ? "Tecnología emergente donde todavía hay espacio para entrar."
        : "Las marcas propias están sobre-representadas en una tecnología que crece.",
      evidencia: `${t.valor}: ${u(t.unidadesAnterior)} → ${u(t.unidades)} u. (${pct(t.variacion)}); ` +
                 `marcas propias ${u(propiasTec)} u. = ${(share * 100).toFixed(1)}%`,
      prioridad: "alta",
      periodo: etiquetaPeriodo,
    });
  }

  // ------------------------------------------------------------ riesgos
  for (const m of marcasConBase) {
    if (!propias.has(m.marca)) continue;
    if (m.variacion !== null && m.variacion > 0 && m.cambioPosicion !== null && m.cambioPosicion < 0) {
      items.push({
        tipo: "riesgo",
        titulo: `${m.marca} crece en unidades pero pierde posiciones`,
        motivo: "El mercado crece más rápido que la marca: se avanza en volumen y se retrocede en relevancia.",
        evidencia: `${u(m.unidadesAnterior)} → ${u(m.unidades)} u. (${pct(m.variacion)}) ` +
                   `pero cae de la posición ${m.posicionAnterior} a la ${m.posicion}`,
        prioridad: "alta",
        periodo: etiquetaPeriodo,
      });
    }
    if (m.variacion !== null && m.variacion < -0.15) {
      items.push({
        tipo: "riesgo",
        titulo: `Caída sostenida de ${m.marca} (marca propia)`,
        motivo: "Pérdida de volumen sobre una base relevante en una marca del portafolio.",
        evidencia: `${u(m.unidadesAnterior)} → ${u(m.unidades)} u. (${pct(m.variacion)})`,
        prioridad: "alta",
        periodo: etiquetaPeriodo,
      });
    }
  }

  // Dependencia excesiva de un modelo dentro de las marcas propias.
  for (const marca of propias) {
    const mods = modelos.filter((m) => m.marca === marca);
    const totalMarca = mods.reduce((s, m) => s + m.unidades, 0);
    if (totalMarca < 100 || !mods.length) continue;
    const lider = mods[0];
    const conc = lider.unidades / totalMarca;
    if (conc > 0.6) {
      items.push({
        tipo: "riesgo",
        titulo: `${marca} depende de un solo modelo`,
        motivo: "Una caída de ese modelo arrastra a toda la marca; poco margen para compensar.",
        evidencia: `${lider.modelo} concentra ${u(lider.unidades)} de ${u(totalMarca)} u. ` +
                   `= ${(conc * 100).toFixed(0)}% de la marca`,
        prioridad: conc > 0.75 ? "alta" : "media",
        periodo: etiquetaPeriodo,
      });
    }
  }

  // Competidores acelerando.
  for (const m of marcasConBase) {
    if (!competidores.has(m.marca)) continue;
    if (m.variacion === null || m.variacion < 1) continue;
    items.push({
      tipo: "riesgo",
      titulo: `${m.marca} (competidor clave) más que duplicó su volumen`,
      motivo: "Un competidor directo acelerando a este ritmo redistribuye participación del resto.",
      evidencia: `${u(m.unidadesAnterior)} → ${u(m.unidades)} u. (${pct(m.variacion)}), ` +
                 `ahora ${(m.participacion * 100).toFixed(1)}% del mercado`,
      prioridad: "alta",
      periodo: etiquetaPeriodo,
    });
  }

  // ------------------------------------------- lectura del historico
  // Todo lo de arriba mira el periodo filtrado contra el anio anterior.
  // Esta seccion mira TODA la serie cargada: estacionalidad, tendencia
  // desestacionalizada, anomalias contra el propio patron y proyeccion
  // de cierre. Es lo que separa "junio cayo 54% contra mayo" de "junio
  // cayo lo esperable para un junio".
  const serie = getSerieHistorica("matriculacion");
  const est = calcularEstacionalidad(serie);
  const mesNombre = (m: number) => MESES_LARGOS[m - 1] ?? String(m);

  if (est) {
    items.push({
      tipo: "historico",
      titulo: `El mercado tiene estacionalidad real: ${mesNombre(est.mesMasFuerte)} fuerte, ${mesNombre(est.mesMasDebil)} débil`,
      motivo: "Comparar un mes contra el anterior sin descontar este patrón lleva a conclusiones falsas.",
      evidencia: `Índice de ${mesNombre(est.mesMasFuerte)}: ${est.indice[est.mesMasFuerte - 1].toFixed(2)} ` +
                 `(${((est.indice[est.mesMasFuerte - 1] - 1) * 100).toFixed(0)}% sobre un mes promedio); ` +
                 `${mesNombre(est.mesMasDebil)}: ${est.indice[est.mesMasDebil - 1].toFixed(2)}. ` +
                 `Calculado sobre ${est.aniosUsados.length} años completos (${est.aniosUsados.join(", ")}).`,
      prioridad: "media",
      periodo: `${est.aniosUsados[0]}–${est.aniosUsados[est.aniosUsados.length - 1]}`,
    });

    const tend = calcularTendencia(serie, est);
    if (tend && tend.pendienteMensual !== null && Math.abs(tend.rachaMeses) >= 3) {
      items.push({
        tipo: "historico",
        titulo: `El mercado acumula ${Math.abs(tend.rachaMeses)} meses ` +
                `${tend.rachaMeses > 0 ? "subiendo" : "bajando"} (sin contar la estacionalidad)`,
        motivo: "Racha medida sobre la serie desestacionalizada: es dirección real, no el calendario.",
        evidencia: `Pendiente de los últimos 12 meses: ${tend.pendienteMensual > 0 ? "+" : ""}` +
                   `${u(Math.round(tend.pendienteMensual))} unidades/mes` +
                   (tend.aceleracion !== null
                     ? `; últimos 3 meses vs los 3 previos: ${pct(tend.aceleracion)}` : ""),
        prioridad: "media",
        periodo: "últimos 12 meses",
      });
    }

    const anomalias = detectarAnomalias(serie, est).slice(0, 3);
    for (const a of anomalias) {
      items.push({
        tipo: "historico",
        titulo: `${mesNombre(a.mes)} ${a.anio} fue atípico incluso para un ${mesNombre(a.mes)}`,
        motivo: "Se desvía de lo esperable ya descontada la estacionalidad: hubo algo más que el calendario.",
        evidencia: `${u(a.unidades)} unidades contra ~${u(a.esperado)} esperables ` +
                   `(${a.sigmas > 0 ? "+" : ""}${a.sigmas.toFixed(1)}σ)`,
        prioridad: Math.abs(a.sigmas) >= 3 ? "alta" : "media",
        periodo: `${mesNombre(a.mes)} ${a.anio}`,
      });
    }

    const proy = proyectarCierre(serie, f.anio, est);
    if (proy && proy.usaEstacionalidad) {
      items.push({
        tipo: "historico",
        titulo: `Proyección de cierre ${f.anio}: ~${u(proy.cierreProyectado)} matriculaciones`,
        motivo: "A diferencia de la proyección simple, esta aplica el patrón estacional a los meses que faltan.",
        evidencia: `Acumulado real ${u(proy.acumuladoReal)} u. en ${12 - proy.mesesFaltantes} meses; ` +
                   `los ${proy.mesesFaltantes} restantes se estiman con el índice estacional de cada mes.` +
                   (proy.confiable ? "" : " Base estacional corta: tomar con cautela."),
        prioridad: "media",
        impacto: proy.confiable ? undefined : "Proyección orientativa",
        periodo: String(f.anio),
      });
    }
  }

  // Trayectorias de mediano plazo: ultimos 12 meses vs los 12 previos,
  // independiente del corte de anio calendario.
  const tray = getTrayectorias("matriculacion", "marca", 200);
  const acelerando = tray
    .filter((t) => t.variacion !== null && t.variacion > 0.3 &&
                   (propias.has(t.valor) || competidores.has(t.valor)))
    .sort((a, b) => (b.variacion ?? 0) - (a.variacion ?? 0))
    .slice(0, 4);
  if (acelerando.length) {
    items.push({
      tipo: "historico",
      titulo: "Marcas del radar con trayectoria ascendente sostenida (12m vs 12m)",
      motivo: "La ventana móvil de 12 meses no depende de dónde caiga el corte del año: es tendencia de fondo.",
      evidencia: acelerando.map((t) =>
        `${t.valor}${propias.has(t.valor) ? " (propia)" : ""}: ` +
        `${u(t.unidades12Previos)} → ${u(t.unidadesUlt12)} u. (${pct(t.variacion)})`
      ).join(" · "),
      prioridad: "media",
      periodo: "últimos 24 meses",
    });
  }

  const orden: Record<Prioridad, number> = { alta: 0, media: 1, baja: 2 };
  items.sort((a, b) => orden[a.prioridad] - orden[b.prioridad]);

  return {
    periodo: etiquetaPeriodo,
    resumen,
    items,
    datosSuficientes: hayBase && kpiMat.valor > 0,
    advertencias,
  };
}
