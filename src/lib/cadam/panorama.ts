import {
  getSerieMensual,
  type FilaRanking,
  type Filtro,
  type Fuente,
  type PuntoMensual,
} from "./mercado";
import { GRUPO_PROPIO, GRUPO_RESTO, grupoDeMarca } from "./grupos";
import {
  MARCAS_EN_TREEMAP, MARCA_OTRAS, type AnioEstacional, type ItemTreemap, type MarcaPropia, type Serie12, type TreemapMarcas,
} from "./panorama-tipos";

export type { AnioEstacional, ItemTreemap, MarcaPropia, Serie12, TreemapMarcas };

/**
 * Los datos del «Panorama» (el bento de arriba del Resumen del mercado).
 *
 * Todo sale de lo que el tablero YA calcula (rankings, series mensuales): acá
 * solo se arma la forma que necesita cada tarjeta. Son funciones puras, y lo que
 * devuelven es JSON simple (números, textos, arrays) porque cruza de la página
 * (servidor) a las tarjetas (cliente; sus tipos están en panorama-tipos.ts). No hay ningún dato inventado ni
 * «en vivo»: un mes sin dato es `null` y se dibuja como hueco, nunca como cero.
 */

type Cortes = Pick<Filtro, "segmento" | "tecnologia" | "marca" | "empresa">;

/** Un año de una serie mensual como 12 posiciones. */
export function serieDeAnio(puntos: PuntoMensual[], anio: number): Serie12 {
  const v: Serie12 = Array(12).fill(null);
  for (const p of puntos) if (p.anio === anio) v[p.mes - 1] = (v[p.mes - 1] ?? 0) + p.unidades;
  return v;
}

/** El último mes (1–12) con dato en una serie, o 0 si no hay ninguno. */
export function ultimoMesConDato(serie: Serie12): number {
  for (let i = 11; i >= 0; i--) if (serie[i] !== null) return i + 1;
  return 0;
}

/**
 * Participación de las marcas propias mes a mes: unidades propias sobre
 * unidades del mercado, con los MISMOS cortes que el resto de la pantalla
 * (segmento, tecnología, importador). Con una marca elegida, la participación es
 * 100 % si la marca es nuestra y 0 si no lo es, igual que la tarjeta de arriba.
 */
export function participacionPropiaMensual(
  fuente: Fuente,
  anios: number[],
  cortes: Cortes,
  propias: Set<string>
): Record<number, Serie12> {
  const mercado = getSerieMensual(fuente, anios, cortes);
  const propiasPorMes = new Map<string, number>();
  if (cortes.marca) {
    if (propias.has(cortes.marca)) {
      for (const p of mercado) propiasPorMes.set(`${p.anio}-${p.mes}`, p.unidades);
    }
  } else {
    for (const marca of propias) {
      for (const p of getSerieMensual(fuente, anios, { ...cortes, marca })) {
        const k = `${p.anio}-${p.mes}`;
        propiasPorMes.set(k, (propiasPorMes.get(k) ?? 0) + p.unidades);
      }
    }
  }
  const salida: Record<number, Serie12> = {};
  for (const anio of anios) {
    const s: Serie12 = Array(12).fill(null);
    for (const p of mercado) {
      if (p.anio !== anio || p.unidades <= 0) continue;
      s[p.mes - 1] = (propiasPorMes.get(`${anio}-${p.mes}`) ?? 0) / p.unidades;
    }
    salida[anio] = s;
  }
  return salida;
}

// ---------------------------------------------------------------- treemap

/**
 * Arma el treemap: las `tope` marcas más grandes del PRIMER período, con lo que
 * vendieron en cada uno de los períodos, y todo lo demás sumado como «OTRAS».
 * Así las tres vistas (período, mismo período del año anterior, último mes)
 * tienen los mismos rectángulos y, al cambiar de una a otra, cada uno crece o se
 * achica en su lugar.
 */
export function armarTreemap(periodos: FilaRanking[][], tope = MARCAS_EN_TREEMAP): TreemapMarcas {
  const base = periodos[0] ?? [];
  const principales = [...base].sort((a, b) => b.unidades - a.unidades).slice(0, tope).map((m) => m.marca);
  const totales = periodos.map((p) => p.reduce((s, m) => s + m.unidades, 0));
  const items: ItemTreemap[] = principales.map((marca) => ({
    marca,
    grupo: grupoDeMarca(marca),
    valores: periodos.map((p) => p.find((m) => m.marca === marca)?.unidades ?? 0),
  }));
  const resto = periodos.map((_, i) => Math.max(0, totales[i] - items.reduce((s, it) => s + it.valores[i], 0)));
  if (resto.some((v) => v > 0)) items.push({ marca: MARCA_OTRAS, grupo: GRUPO_RESTO, valores: resto });
  return { items, totales };
}

// ---------------------------------------------------------------- marcas propias

/** Las marcas nuestras que vendieron en el período, de más a menos, hasta `tope`. */
export function marcasPropias(ranking: FilaRanking[], tope = 6): MarcaPropia[] {
  return ranking
    .filter((m) => m.esPropia && m.unidades > 0)
    .sort((a, b) => b.unidades - a.unidades)
    .slice(0, tope)
    .map((m) => ({
      marca: m.marca,
      unidades: m.unidades,
      participacion: m.participacion,
      posicion: m.posicion,
      variacion: m.variacion,
      unidadesAnterior: m.unidadesAnterior,
    }));
}

/** Para el color de cada rectángulo: ¿es del grupo propio? */
export const ES_GRUPO_PROPIO = (grupo: string) => grupo === GRUPO_PROPIO;

// ---------------------------------------------------------------- estacionalidad

/** La forma del año: de qué meses se compone cada año de la serie. */
export function estacionalidad(puntos: PuntoMensual[], anios: number[]): AnioEstacional[] {
  const salida: AnioEstacional[] = [];
  for (const anio of anios) {
    const valores = serieDeAnio(puntos, anio);
    const con: { mes: number; valor: number }[] = [];
    valores.forEach((v, i) => {
      if (v !== null) con.push({ mes: i + 1, valor: v });
    });
    if (!con.length) continue;
    const total = con.reduce((s, x) => s + x.valor, 0);
    const pico = con.reduce((a, b) => (b.valor > a.valor ? b : a));
    const valle = con.reduce((a, b) => (b.valor < a.valor ? b : a));
    const trimestres = [0, 1, 2, 3].map((q) => {
      const tres = valores.slice(q * 3, q * 3 + 3);
      return tres.every((v) => v !== null) ? (tres as number[]).reduce((s, v) => s + v, 0) : null;
    });
    salida.push({
      anio,
      valores,
      hasta: ultimoMesConDato(valores),
      total,
      promedio: total / con.length,
      pico,
      valle,
      trimestres,
    });
  }
  return salida;
}
