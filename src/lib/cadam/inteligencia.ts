import type { I18n } from "@/lib/i18n/crear";
import {
  acotarAFuente, getBrecha, getCobertura, getKpi, getPorDimension, getRankingMarcas,
  getRankingModelos, TECNOLOGIAS, type Filtro,
} from "./mercado";
import {
  calcularEstacionalidad, calcularTendencia, detectarAnomalias,
  getSerieHistorica, getTrayectorias, proyectarCierre,
} from "./historico";
import { getMarcasPropiasSet, getParametros } from "./config";

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
 *
 * IDIOMA. Este modulo ESCRIBE las frases de la lectura (titulos, motivos,
 * evidencia): por eso recibe el `i18n` del pedido y arma cada frase entera con
 * `t()`, con las cifras ya formateadas por `fmt`. No lee el idioma por su
 * cuenta: en el servidor no hay un idioma global.
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

export function generarInforme(f: Filtro, etiquetaPeriodo: string, i18n: I18n): Informe {
  const { t, fmt } = i18n;
  const {
    decimal, formatUnidades: u, formatPuntosPct: pp, mesCorto, mesesLargos,
    etiquetaPeriodo: rotuloPeriodo, nombreDeSegmento,
  } = fmt;
  const pct = (v: number | null) =>
    v === null ? "—" : `${v > 0 ? "+" : ""}${decimal(v * 100, 1)}%`;
  // El segmento se muestra como lo escribe CADAM («Automovil», sin tilde): asi
  // lo dice el castellano desde siempre y no cambia. En ingles va por su nombre.
  const seg = (valor: string) => (i18n.idioma === "en" ? nombreDeSegmento(valor) : valor);
  // «antes → ahora» de una fila (marca, modelo, tecnologia): la misma frase en todas.
  const deA = (nombre: string, antes: number, ahora: number, variacion: number | null) =>
    t("{nombre}: {antes} → {ahora} u. ({variacion})", {
      nombre, antes: u(antes), ahora: u(ahora), variacion: pct(variacion),
    });
  // El cambio de puesto de una marca, para colgarlo de su evidencia.
  // «posiciónes» (con tilde) es como lo escribe el castellano de siempre y se conserva.
  const cambioDePuesto = (cambio: number, antes: number | null, ahora: number) => {
    const vars = { n: Math.abs(cambio), antes: String(antes), ahora };
    if (cambio > 0) {
      return Math.abs(cambio) === 1
        ? t("sube {n} posición ({antes} → {ahora})", vars)
        : t("sube {n} posiciónes ({antes} → {ahora})", vars);
    }
    return Math.abs(cambio) === 1
      ? t("baja {n} posición ({antes} → {ahora})", vars)
      : t("baja {n} posiciónes ({antes} → {ahora})", vars);
  };

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
      t(
        "No hay datos de {anio} cargados, así que no se puede comparar " +
        "contra el año anterior. Los hallazgos que dependen de esa comparación " +
        "no se generan.",
        { anio: anioPrevio }
      )
    );
  }

  const kpiMat = getKpi("matriculacion", f);
  const kpiImp = getKpi("importacion", f);
  // Lo que se resta o se divide entre las dos fuentes (diferencia, relación
  // matric./import.) va sobre el tramo que tienen las dos: con un mes de
  // ventaja de una fuente, restarlas inventa una brecha de ese mes entero.
  const hastaImp = acotarAFuente("importacion", f).mesHasta;
  const hastaMat = acotarAFuente("matriculacion", f).mesHasta;
  const fComun: Filtro = { ...f, mesHasta: Math.max(f.mesDesde, Math.min(hastaImp, hastaMat)) };
  const comunRecorta = fComun.mesHasta < f.mesHasta;
  const kpiMatComun = comunRecorta ? getKpi("matriculacion", fComun) : kpiMat;
  const kpiImpComun = comunRecorta ? getKpi("importacion", fComun) : kpiImp;
  const rotuloComun = rotuloPeriodo(fComun.anio, fComun.mesDesde, fComun.mesHasta);
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
    kpiMat.variacion === null
      ? t("En {periodo} se matricularon {n} unidades. No hay período anterior cargado para comparar.", {
          periodo: etiquetaPeriodo, n: u(kpiMat.valor),
        })
      : kpiMat.variacion >= 0
        ? t("En {periodo} se matricularon {n} unidades, un alza de {variacion} frente a las {base} del mismo período de {anio}.", {
            periodo: etiquetaPeriodo, n: u(kpiMat.valor), variacion: pct(kpiMat.variacion),
            base: u(kpiMat.baseValor), anio: anioPrevio,
          })
        : t("En {periodo} se matricularon {n} unidades, una baja de {variacion} frente a las {base} del mismo período de {anio}.", {
            periodo: etiquetaPeriodo, n: u(kpiMat.valor), variacion: pct(kpiMat.variacion),
            base: u(kpiMat.baseValor), anio: anioPrevio,
          })
  );
  if (kpiImp.sinDatos) {
    resumen.push(
      t(
        "CADAM todavía no publicó la importación de {periodo}: no hay cifra de " +
        "importaciones ni diferencia contra matriculación para este período.",
        { periodo: etiquetaPeriodo }
      )
    );
  } else {
    const impAtrasada = hastaImp < f.mesHasta;
    const mesesImpFaltan = hastaImp + 1 === f.mesHasta
      ? mesCorto(f.mesHasta)
      : `${mesCorto(hastaImp + 1)}–${mesCorto(f.mesHasta)}`;
    // Dos oraciones, cada una entera: la primera cuenta cuanto sumaron las
    // importaciones (y si falta un mes de CADAM), la segunda la diferencia.
    const sumaron = {
      n: u(kpiImp.valor), hasta: mesCorto(hastaImp),
      variacion: pct(kpiImp.variacion), faltan: mesesImpFaltan,
    };
    const sumaronImp = impAtrasada
      ? kpiImp.variacion !== null
        ? t("Las importaciones sumaron {n} unidades hasta {hasta} ({variacion}), porque CADAM todavía no publicó la importación de {faltan}.", sumaron)
        : t("Las importaciones sumaron {n} unidades hasta {hasta}, porque CADAM todavía no publicó la importación de {faltan}.", sumaron)
      : kpiImp.variacion !== null
        ? t("Las importaciones sumaron {n} unidades ({variacion}).", sumaron)
        : t("Las importaciones sumaron {n} unidades.", sumaron);
    const diferencia = {
      n: u(Math.abs(kpiImpComun.valor - kpiMatComun.valor)),
      lado: kpiImpComun.valor > kpiMatComun.valor ? t("la importación") : t("la matriculación"),
      tramo: rotuloComun,
    };
    const diferenciaImp = comunRecorta
      ? t("La diferencia contra matriculación es de {n} unidades a favor de {lado} en {tramo}, el tramo que tienen las dos fuentes, una señal orientativa y no una medida de stock.", diferencia)
      : t("La diferencia contra matriculación es de {n} unidades a favor de {lado}, una señal orientativa y no una medida de stock.", diferencia);
    resumen.push(`${sumaronImp} ${diferenciaImp}`);
  }
  if (marcas.length) {
    resumen.push(
      t("Lidera {marca} con {n} unidades ({pct}% del mercado).", {
        marca: marcas[0].marca, n: u(marcas[0].unidades),
        pct: decimal(marcas[0].participacion * 100, 1),
      })
    );
  }
  const propiasU = marcas.filter((m) => propias.has(m.marca))
    .reduce((s, m) => s + m.unidades, 0);
  const totalU = marcas.reduce((s, m) => s + m.unidades, 0) || 1;
  resumen.push(
    t("Las marcas propias suman {n} unidades, {pct}% del mercado.", {
      n: u(propiasU), pct: decimal((propiasU / totalU) * 100, 1),
    })
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
      titulo: t("{marca} lidera el crecimiento en unidades", { marca: top[0].marca }),
      motivo: t("Es quien más volumen agregó al mercado en el período; marca la dirección de la demanda."),
      evidencia: top.map((m) =>
        t("{marca}: {antes} → {ahora} u. ({variacion}, {delta} u.)", {
          marca: m.marca, antes: u(m.unidadesAnterior), ahora: u(m.unidades),
          variacion: pct(m.variacion),
          delta: `${m.unidades - m.unidadesAnterior > 0 ? "+" : ""}${u(m.unidades - m.unidadesAnterior)}`,
        })
      ).join(" · "),
      prioridad: "media",
      periodo: etiquetaPeriodo,
    });
  }
  if (caen.length) {
    const top = caen.slice(0, 3);
    items.push({
      tipo: "hallazgo",
      titulo: t("{marca} lidera la caída en unidades", { marca: top[0].marca }),
      motivo: t("Pérdida de volumen sostenida sobre una base relevante."),
      evidencia: top.map((m) =>
        deA(m.marca, m.unidadesAnterior, m.unidades, m.variacion)
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
      titulo: t("Modelos que más crecieron"),
      motivo: t("El movimiento a nivel modelo anticipa el de la marca."),
      evidencia: modCrecen.slice(0, 5).map((m) =>
        deA(`${m.marca} ${m.modelo}`, m.unidadesAnterior, m.unidades, m.variacion)
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
      titulo: t("{n} modelos nuevos con volumen relevante", { n: nuevos.length }),
      motivo: t("No tenían matriculaciones en el período anterior: son lanzamientos o ingresos al mercado."),
      evidencia: nuevos.slice(0, 6).map((m) =>
        t("{marca} {modelo} ({n} u.)", { marca: m.marca, modelo: m.modelo ?? "", n: u(m.unidades) })
      ).join(" · "),
      prioridad: "media",
      impacto: t("{n} unidades en total", { n: u(nuevos.reduce((s, m) => s + m.unidades, 0)) }),
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
      titulo: sube
        ? t("El segmento {segmento} gana peso en el mercado", { segmento: seg(s.valor) })
        : t("El segmento {segmento} pierde peso en el mercado", { segmento: seg(s.valor) }),
      motivo: sube
        ? t("Está creciendo más rápido que el mercado: se lleva participación de los demás.")
        : t("Crece menos que el mercado (o cae): otros segmentos le sacan participación."),
      evidencia: t("{antes} → {ahora} u. ({variacion}), participación {delta} hasta {pct}%", {
        antes: u(s.unidadesAnterior), ahora: u(s.unidades), variacion: pct(s.variacion),
        delta: pp(s.deltaParticipacion), pct: decimal(s.participacion * 100, 1),
      }),
      prioridad: Math.abs(s.deltaParticipacion * 100) >= 3 ? "alta" : "media",
      periodo: etiquetaPeriodo,
    });
  }

  // Tecnologias con mayor adopcion.
  const tecOrden = new Map(TECNOLOGIAS.map((tec, i) => [tec as string, i]));
  const tecCrecen = tecnologias
    .filter((tec) => tec.variacion !== null && tec.valor !== "ICE" && tec.unidades >= 50)
    .sort((a, b) => (b.variacion ?? 0) - (a.variacion ?? 0));
  if (tecCrecen.length) {
    items.push({
      tipo: "hallazgo",
      titulo: t("{tecnologia} es la tecnología de mayor crecimiento", { tecnologia: tecCrecen[0].valor }),
      motivo: t("La adopción de tecnologías alternativas marca hacia dónde va el mix de producto."),
      evidencia: tecCrecen.slice(0, 4)
        .sort((a, b) => (tecOrden.get(a.valor) ?? 9) - (tecOrden.get(b.valor) ?? 9))
        .map((tec) => deA(tec.valor, tec.unidadesAnterior, tec.unidades, tec.variacion))
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
    const marcaConEtiqueta = esNuestra
      ? t("{marca} (marca propia)", { marca: m.marca })
      : esCompetidor ? t("{marca} (competidor clave)", { marca: m.marca }) : m.marca;
    items.push({
      tipo: "alerta",
      titulo: sube
        ? t("Crecimiento abrupto de {marca}", { marca: marcaConEtiqueta })
        : t("Caída abrupta de {marca}", { marca: marcaConEtiqueta }),
      motivo: sube
        ? t("Un salto de esta magnitud cambia el equilibrio competitivo del período.")
        : t("Una caída de esta magnitud sobre una base relevante requiere explicación."),
      evidencia: t("{antes} → {ahora} u. ({variacion}), participación {pct}%", {
                    antes: u(m.unidadesAnterior), ahora: u(m.unidades), variacion: pct(m.variacion),
                    pct: decimal(m.participacion * 100, 1),
                  }) +
                 (m.cambioPosicion
                   ? `, ${cambioDePuesto(m.cambioPosicion, m.posicionAnterior, m.posicion)}`
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
      titulo: sube
        ? t("{marca} sube {n} posiciones sin un cambio abrupto de volumen", { marca: m.marca, n: Math.abs(m.cambioPosicion) })
        : t("{marca} baja {n} posiciones sin un cambio abrupto de volumen", { marca: m.marca, n: Math.abs(m.cambioPosicion) }),
      motivo: t("Se movió en el ranking por lo que hicieron las demás, no por su propio volumen."),
      evidencia: t("Posición {antes} → {ahora} · {n} u. ({variacion})", {
        antes: String(m.posicionAnterior), ahora: m.posicion, n: u(m.unidades), variacion: pct(m.variacion),
      }),
      prioridad: propias.has(m.marca) || competidores.has(m.marca) ? "alta" : "baja",
      periodo: etiquetaPeriodo,
    });
  }

  // Brecha importacion/matriculacion.
  const brecha = getBrecha([f.anio]).filter((p) => p.mes >= f.mesDesde && p.mes <= fComun.mesHasta);
  const totImp = brecha.reduce((s, p) => s + (p.importaciones ?? 0), 0);
  const totMat = brecha.reduce((s, p) => s + (p.matriculaciones ?? 0), 0);
  if (totImp && totMat) {
    const rel = totMat / totImp;
    if (rel < 0.9 || rel > 1.1) {
      const brechaVars = { imp: u(totImp), mat: u(totMat), rel: decimal(rel, 2), tramo: rotuloComun };
      items.push({
        tipo: "alerta",
        titulo: rel < 0.9
          ? t("Se está importando bastante más de lo que se patenta")
          : t("Se está patentando bastante más de lo que se importa"),
        motivo: t(
          "Una brecha sostenida sugiere un cambio de ritmo entre el ingreso de unidades y su venta. " +
          "Es orientativo: no equivale a stock real."
        ),
        evidencia: comunRecorta
          ? t("Importación {imp} u. vs matriculación {mat} u. Relación matric./import. {rel} · {tramo}, el tramo que tienen las dos fuentes", brechaVars)
          : t("Importación {imp} u. vs matriculación {mat} u. Relación matric./import. {rel}", brechaVars),
        prioridad: "media",
        periodo: etiquetaPeriodo,
      });
    }
  }

  // Calidad de datos como alerta de primera clase.
  if (cobertura.mesesFaltantes.matriculacion.length) {
    items.push({
      tipo: "alerta",
      titulo: t("Faltan meses en la serie de matriculación"),
      motivo: t("Un hueco en el histórico distorsiona promedios, tendencias y proyecciones."),
      evidencia: t("Meses sin datos en el origen: {meses}", {
        meses: cobertura.mesesFaltantes.matriculacion.join(", "),
      }),
      prioridad: "media",
      periodo: etiquetaPeriodo,
    });
  }
  if (cobertura.primerAnioConSegmento !== null && f.anio < cobertura.primerAnioConSegmento) {
    items.push({
      tipo: "alerta",
      titulo: t("Sin clasificación de segmento en {anio}", { anio: f.anio }),
      motivo: t("CADAM no publica el segmento antes de {anio}: el análisis por segmento de este año no es posible.", {
        anio: cobertura.primerAnioConSegmento,
      }),
      evidencia: t("El segmento aparece recién desde {anio}.", { anio: cobertura.primerAnioConSegmento }),
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
        titulo: t("Baja participación propia en {segmento}, que además está creciendo", { segmento: seg(s.valor) }),
        motivo: t("Segmento en expansión donde las marcas propias casi no están presentes."),
        evidencia: t("Segmento {n} u. ({variacion}); marcas propias {propias} u. = {pct}% del segmento", {
          n: u(s.unidades), variacion: pct(s.variacion), propias: u(propiasSeg),
          pct: decimal(share * 100, 1),
        }),
        prioridad: "alta",
        impacto: t("Cada punto de participación en este segmento son ~{n} unidades", {
          n: u(Math.round(s.unidades / 100)),
        }),
        periodo: etiquetaPeriodo,
      });
    }
  }

  for (const tec of tecnologias) {
    if (tec.valor === "ICE" || tec.variacion === null || tec.unidades < 50) continue;
    if (tec.variacion < 0.5) continue;
    const marcasTec = getRankingMarcas("matriculacion", { ...f, tecnologia: tec.valor });
    const propiasTec = marcasTec.filter((m) => propias.has(m.marca))
      .reduce((acc, m) => acc + m.unidades, 0);
    const share = tec.unidades ? propiasTec / tec.unidades : 0;
    items.push({
      tipo: share < 0.1 ? "oportunidad" : "hallazgo",
      titulo: share < 0.1
        ? t("{tecnologia} crece fuerte y las marcas propias casi no participan", { tecnologia: tec.valor })
        : t("Posición fuerte en {tecnologia}, una tecnología en expansión", { tecnologia: tec.valor }),
      motivo: share < 0.1
        ? t("Tecnología emergente donde todavía hay espacio para entrar.")
        : t("Las marcas propias están sobre-representadas en una tecnología que crece."),
      evidencia: t("{tecnologia}: {antes} → {ahora} u. ({variacion}); marcas propias {propias} u. = {pct}%", {
        tecnologia: tec.valor, antes: u(tec.unidadesAnterior), ahora: u(tec.unidades),
        variacion: pct(tec.variacion), propias: u(propiasTec), pct: decimal(share * 100, 1),
      }),
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
        titulo: t("{marca} crece en unidades pero pierde posiciones", { marca: m.marca }),
        motivo: t("El mercado crece más rápido que la marca: se avanza en volumen y se retrocede en relevancia."),
        evidencia: t("{antes} → {ahora} u. ({variacion}) pero cae de la posición {posAntes} a la {posAhora}", {
          antes: u(m.unidadesAnterior), ahora: u(m.unidades), variacion: pct(m.variacion),
          posAntes: String(m.posicionAnterior), posAhora: m.posicion,
        }),
        prioridad: "alta",
        periodo: etiquetaPeriodo,
      });
    }
    if (m.variacion !== null && m.variacion < -0.15) {
      items.push({
        tipo: "riesgo",
        titulo: t("Caída sostenida de {marca} (marca propia)", { marca: m.marca }),
        motivo: t("Pérdida de volumen sobre una base relevante en una marca del portafolio."),
        evidencia: t("{antes} → {ahora} u. ({variacion})", {
          antes: u(m.unidadesAnterior), ahora: u(m.unidades), variacion: pct(m.variacion),
        }),
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
        titulo: t("{marca} depende de un solo modelo", { marca }),
        motivo: t("Una caída de ese modelo arrastra a toda la marca; poco margen para compensar."),
        evidencia: t("{modelo} concentra {n} de {total} u. = {pct}% de la marca", {
          modelo: lider.modelo ?? "", n: u(lider.unidades), total: u(totalMarca), pct: decimal(conc * 100, 0),
        }),
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
      titulo: t("{marca} (competidor clave) más que duplicó su volumen", { marca: m.marca }),
      motivo: t("Un competidor directo acelerando a este ritmo redistribuye participación del resto."),
      evidencia: t("{antes} → {ahora} u. ({variacion}), ahora {pct}% del mercado", {
        antes: u(m.unidadesAnterior), ahora: u(m.unidades), variacion: pct(m.variacion),
        pct: decimal(m.participacion * 100, 1),
      }),
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
  const mesNombre = (m: number) => mesesLargos[m - 1] ?? String(m);

  if (est) {
    items.push({
      tipo: "historico",
      titulo: t("El mercado tiene estacionalidad real: {fuerte} fuerte, {debil} débil", {
        fuerte: mesNombre(est.mesMasFuerte), debil: mesNombre(est.mesMasDebil),
      }),
      motivo: t("Comparar un mes contra el anterior sin descontar este patrón lleva a conclusiones falsas."),
      evidencia: t(
        "Índice de {fuerte}: {indiceFuerte} ({sobre}% sobre un mes promedio); " +
        "{debil}: {indiceDebil}. " +
        "Calculado sobre {n} años completos ({anios}).",
        {
          fuerte: mesNombre(est.mesMasFuerte),
          indiceFuerte: decimal(est.indice[est.mesMasFuerte - 1], 2),
          sobre: decimal((est.indice[est.mesMasFuerte - 1] - 1) * 100, 0),
          debil: mesNombre(est.mesMasDebil),
          indiceDebil: decimal(est.indice[est.mesMasDebil - 1], 2),
          n: est.aniosUsados.length,
          anios: est.aniosUsados.join(", "),
        }
      ),
      prioridad: "media",
      periodo: `${est.aniosUsados[0]}–${est.aniosUsados[est.aniosUsados.length - 1]}`,
    });

    const tend = calcularTendencia(serie, est);
    if (tend && tend.pendienteMensual !== null && Math.abs(tend.rachaMeses) >= 3) {
      const pendiente = `${tend.pendienteMensual > 0 ? "+" : ""}${u(Math.round(tend.pendienteMensual))}`;
      items.push({
        tipo: "historico",
        titulo: tend.rachaMeses > 0
          ? t("El mercado acumula {n} meses subiendo (sin contar la estacionalidad)", { n: Math.abs(tend.rachaMeses) })
          : t("El mercado acumula {n} meses bajando (sin contar la estacionalidad)", { n: Math.abs(tend.rachaMeses) }),
        motivo: t("Racha medida sobre la serie desestacionalizada: es dirección real, no el calendario."),
        evidencia: tend.aceleracion !== null
          ? t("Pendiente de los últimos 12 meses: {pendiente} unidades/mes; últimos 3 meses vs los 3 previos: {aceleracion}", {
              pendiente, aceleracion: pct(tend.aceleracion),
            })
          : t("Pendiente de los últimos 12 meses: {pendiente} unidades/mes", { pendiente }),
        prioridad: "media",
        periodo: t("últimos 12 meses"),
      });
    }

    const anomalias = detectarAnomalias(serie, est).slice(0, 3);
    for (const a of anomalias) {
      items.push({
        tipo: "historico",
        titulo: t("{mes} {anio} fue atípico incluso para un {mes}", { mes: mesNombre(a.mes), anio: a.anio }),
        motivo: t("Se desvía de lo esperable ya descontada la estacionalidad: hubo algo más que el calendario."),
        evidencia: t("{n} unidades contra ~{esperado} esperables ({sigmas}σ)", {
          n: u(a.unidades), esperado: u(a.esperado),
          sigmas: `${a.sigmas > 0 ? "+" : ""}${decimal(a.sigmas, 1)}`,
        }),
        prioridad: Math.abs(a.sigmas) >= 3 ? "alta" : "media",
        periodo: `${mesNombre(a.mes)} ${a.anio}`,
      });
    }

    const proy = proyectarCierre(serie, f.anio, est);
    if (proy && proy.usaEstacionalidad) {
      items.push({
        tipo: "historico",
        titulo: t("Proyección de cierre {anio}: ~{n} matriculaciones", { anio: f.anio, n: u(proy.cierreProyectado) }),
        motivo: t("A diferencia de la proyección simple, esta aplica el patrón estacional a los meses que faltan."),
        evidencia: t(
          "Acumulado real {acumulado} u. en {meses} meses; " +
          "los {faltan} restantes se estiman con el índice estacional de cada mes.",
          { acumulado: u(proy.acumuladoReal), meses: 12 - proy.mesesFaltantes, faltan: proy.mesesFaltantes }
        ) +
                   (proy.confiable ? "" : ` ${t("Base estacional corta: tomar con cautela.")}`),
        prioridad: "media",
        impacto: proy.confiable ? undefined : t("Proyección orientativa"),
        periodo: String(f.anio),
      });
    }
  }

  // Trayectorias de mediano plazo: ultimos 12 meses vs los 12 previos,
  // independiente del corte de anio calendario.
  const tray = getTrayectorias("matriculacion", "marca", 200);
  const acelerando = tray
    .filter((tra) => tra.variacion !== null && tra.variacion > 0.3 &&
                   (propias.has(tra.valor) || competidores.has(tra.valor)))
    .sort((a, b) => (b.variacion ?? 0) - (a.variacion ?? 0))
    .slice(0, 4);
  if (acelerando.length) {
    items.push({
      tipo: "historico",
      titulo: t("Marcas del radar con trayectoria ascendente sostenida (12m vs 12m)"),
      motivo: t("La ventana móvil de 12 meses no depende de dónde caiga el corte del año: es tendencia de fondo."),
      evidencia: acelerando.map((tra) =>
        deA(
          propias.has(tra.valor) ? t("{marca} (propia)", { marca: tra.valor }) : tra.valor,
          tra.unidades12Previos, tra.unidadesUlt12, tra.variacion
        )
      ).join(" · "),
      prioridad: "media",
      periodo: t("últimos 24 meses"),
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
