"use client";

import { EchartsAuto } from "@/components/charts/echarts-auto";
import { FUENTE_MONO_EJES, TOOLTIP_BASE, useChartTheme } from "@/lib/chart-theme";
import { formatUnidades } from "@/lib/format";
import { MESES_CORTOS } from "@/lib/periodo";

export interface SerieAnio {
  /** Nombre de la serie. Normalmente el año, pero tambien se usa para
   *  comparar marcas o segmentos entre si (Market Share). */
  anio: number | string;
  /** 12 posiciones (Ene..Dic). null = mes SIN DATO, no cero. */
  valores: (number | null)[];
  punteada?: boolean;
  /** Sufijo para el tooltip, ej. '%'. Por defecto son unidades. */
  unidad?: "unidades" | "porcentaje";
}

/**
 * Evolucion mensual comparando anios.
 *
 * `connectNulls: false` es deliberado: un mes sin datos deja un hueco
 * visible en la linea en vez de unir los puntos vecinos, que sugeriria
 * una continuidad que el dato no tiene (spec sec. 13). El tooltip lo
 * dice explicitamente.
 */
export function SerieAniosChart({
  series,
  tipo = "line",
  altura = 300,
  // El cuadro que aparece al pasar el mouse lista los años de más
  // reciente a más viejo (2026 arriba). La leyenda, en cambio, queda en
  // orden natural. Market Share pasa "seriesAsc" para respetar el ranking.
  ordenTooltip = "seriesDesc",
}: {
  series: SerieAnio[];
  tipo?: "line" | "bar";
  altura?: number;
  ordenTooltip?: "seriesAsc" | "seriesDesc";
}) {
  const theme = useChartTheme();

  const option = {
    color: theme.series,
    animationDuration: 700,
    animationEasing: "cubicOut" as const,
    grid: { left: 8, right: 8, top: 36, bottom: 24, containLabel: true },
    tooltip: {
      ...TOOLTIP_BASE,
      trigger: "axis",
      // Formateador propio para controlar el ORDEN de las filas de forma
      // determinística: `tooltip.order` de ECharts no reordenaba de manera
      // confiable. Con ordenTooltip="seriesDesc" (por defecto) las series se
      // muestran de la última declarada a la primera; como vienen ascendentes
      // por año, el año más reciente (2026) queda arriba. Market Share pasa
      // "seriesAsc" para respetar su orden por ranking.
      formatter: (raw: unknown) => {
        const params = (Array.isArray(raw) ? raw : [raw]) as {
          seriesIndex: number; seriesName: string; marker: string;
          value: number | null; axisValueLabel?: string;
        }[];
        const filas = [...params].sort((a, b) =>
          ordenTooltip === "seriesDesc"
            ? b.seriesIndex - a.seriesIndex
            : a.seriesIndex - b.seriesIndex
        );
        const fmt = (v: number | null) =>
          v === null || v === undefined
            ? "Sin datos"
            : series[0]?.unidad === "porcentaje"
              ? `${v.toFixed(1)}%`
              : formatUnidades(v);
        const cabecera = filas[0]?.axisValueLabel ?? "";
        const cuerpo = filas
          .map(
            (p) =>
              `<div style="display:flex;align-items:center;justify-content:space-between;gap:18px;line-height:1.7">` +
              `<span style="display:flex;align-items:center;gap:6px">${p.marker}${p.seriesName}</span>` +
              `<span style="font-variant-numeric:tabular-nums;font-weight:600">${fmt(p.value)}</span>` +
              `</div>`
          )
          .join("");
        return `<div style="font-weight:600;margin-bottom:2px">${cabecera}</div>${cuerpo}`;
      },
    },
    legend: {
      top: 0,
      textStyle: { color: theme.text, fontSize: 12 },
      // Orden explícito = el de las series (ya vienen ordenadas por año).
      // Sin esto, con `replaceMerge` ECharts conserva la leyenda previa y
      // cuelga cada serie nueva al final: al agregar un año quedaba fuera
      // de orden (2024·2025·2026·2023 en vez de 2023·2024·2025·2026).
      data: series.map((s) => String(s.anio)),
    },
    xAxis: {
      type: "category",
      data: MESES_CORTOS,
      axisLine: { lineStyle: { color: theme.grid } },
      axisLabel: { color: theme.text, fontSize: 11 },
      // Línea guía punteada al pasar el mouse (referencia 2026-07): conecta
      // el punto con el eje, como el conector de la burbuja de tooltip.
      axisPointer: { type: "line", lineStyle: { color: theme.primary, type: "dashed", width: 1.5 } },
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: theme.grid } },
      axisLabel: {
        color: theme.text,
        fontSize: 11,
        fontFamily: FUENTE_MONO_EJES,
        formatter: (v: number) => formatUnidades(v),
      },
    },
    series: series.map((s, i) => ({
      // id estable (no solo `name`): con `replaceMerge` de abajo, ECharts
      // usa el id para reconocer una serie que sigue existiendo entre
      // updates (y la anima desde su valor previo) en vez de recrearla
      // desde cero — y para sacar del todo la que ya no viene en el
      // filtro nuevo, sin dejar una serie fantasma con datos viejos.
      id: String(s.anio),
      name: String(s.anio),
      type: tipo,
      smooth: tipo === "line",
      symbolSize: 6,
      // Ver comentario del componente: los huecos NO se conectan.
      connectNulls: false,
      lineStyle: s.punteada ? { width: 2, type: "dashed" } : { width: 3 },
      emphasis: { focus: "series" as const },
      // Relleno degradado bajo la serie principal (las punteadas son
      // referencia histórica: solo línea, para no apilar veladuras).
      ...(tipo === "line" && !s.punteada
        ? {
            areaStyle: {
              opacity: 1,
              color: {
                type: "linear" as const,
                x: 0, y: 0, x2: 0, y2: 1,
                colorStops: [
                  { offset: 0, color: `${theme.series[i % theme.series.length]}38` },
                  { offset: 1, color: `${theme.series[i % theme.series.length]}00` },
                ],
              },
            },
          }
        : {}),
      data: s.valores,
    })),
  };

  return (
    <EchartsAuto
      option={option}
      style={{ height: altura, width: "100%" }}
      replaceMerge={["series"]}
    />
  );
}
