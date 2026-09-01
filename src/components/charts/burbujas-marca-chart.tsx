"use client";

import { EchartsAuto } from "@/components/charts/echarts-auto";
import { TOOLTIP_BASE, useChartTheme } from "@/lib/chart-theme";
import { formatUnidades } from "@/lib/format";

export interface Burbuja {
  marca: string;
  modelo: string;
  /** Unidades del período actual. Define el TAMAÑO de la burbuja. */
  unidades: number;
  unidadesAnterior: number;
  /** Variación contra el mismo período del año anterior, en tanto por uno. */
  variacion: number;
  esPropia: boolean;
}

/**
 * Una burbuja por modelo, agrupadas en la columna de su marca.
 * Eje Y = variación % contra el año anterior · tamaño = unidades.
 *
 * Por qué NO es el eje del tablero de referencia: ese usaba precio, que es
 * una escala acotada y comparable. Acá no hay precios en la base (CADAM
 * trae unidades, no importes), así que el eje es la variación — que es útil
 * pero NO está acotada: un modelo que pasa de 1 a 88 unidades marca +8700%
 * y aplasta a los otros 370 contra el piso. El filtro de base mínima que
 * aplica la página es lo que hace legible este gráfico; sin él no lo es.
 *
 * El área de la burbuja (no su diámetro) es proporcional a las unidades:
 * de ahí el sqrt. Escalar el diámetro linealmente exagera las diferencias
 * al cuadrado, que es el error clásico de los bubble charts.
 */
export function BurbujasMarcaChart({
  datos,
  altura = 460,
}: {
  datos: Burbuja[];
  altura?: number;
}) {
  const theme = useChartTheme();

  if (!datos.length) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        Ningún modelo alcanza la base mínima para comparar con el año anterior.
      </p>
    );
  }

  // Marcas ordenadas por volumen, pero las propias primero — mismo criterio
  // que el tablero de referencia, que abre con las marcas de su grupo.
  const volPorMarca = new Map<string, number>();
  const propiaPorMarca = new Map<string, boolean>();
  for (const d of datos) {
    volPorMarca.set(d.marca, (volPorMarca.get(d.marca) ?? 0) + d.unidades);
    if (d.esPropia) propiaPorMarca.set(d.marca, true);
  }
  const marcas = [...volPorMarca.keys()].sort((a, b) => {
    const pa = propiaPorMarca.get(a) ? 1 : 0;
    const pb = propiaPorMarca.get(b) ? 1 : 0;
    if (pa !== pb) return pb - pa;
    return (volPorMarca.get(b) ?? 0) - (volPorMarca.get(a) ?? 0);
  });
  const indice = new Map(marcas.map((m, i) => [m, i]));

  const maxU = Math.max(...datos.map((d) => d.unidades));
  // El techo se calcula contra el ancho de columna, no a ojo: con 36 marcas
  // en ~860px cada columna mide ~24px, y una burbuja de 46px de radio (92 de
  // diámetro) tapaba cuatro columnas vecinas. Se permite hasta ~2 columnas de
  // ancho, que deja el solapamiento propio de un bubble chart sin volverlo
  // ilegible, con un piso y un techo absolutos para pocas o muchas marcas.
  const anchoColumna = 860 / Math.max(marcas.length, 1);
  const MIN_PX = 4;
  const MAX_PX = Math.max(12, Math.min(30, anchoColumna));
  const radio = (u: number) =>
    MIN_PX + (MAX_PX - MIN_PX) * Math.sqrt(u / maxU);

  const puntos = datos.map((d) => ({
    value: [indice.get(d.marca) ?? 0, d.variacion * 100, d.unidades],
    name: d.modelo,
    marca: d.marca,
    anterior: d.unidadesAnterior,
    itemStyle: {
      color: d.esPropia ? theme.primary : theme.axis,
      opacity: d.esPropia ? 0.75 : 0.4,
      borderColor: d.esPropia ? theme.primary : theme.axis,
      borderWidth: 1,
    },
  }));

  const option = {
    animationDuration: 700,
    animationEasing: "cubicOut" as const,
    grid: { left: 56, right: 16, top: 16, bottom: 96 },
    tooltip: {
      ...TOOLTIP_BASE,
      trigger: "item",
      formatter: (p: {
        name: string;
        value: number[];
        data: { marca: string; anterior: number };
      }) =>
        `<b>${p.data.marca}</b> · ${p.name}<br/>` +
        `${formatUnidades(p.value[2])} u. ` +
        `<span style="opacity:.7">(antes ${formatUnidades(p.data.anterior)})</span><br/>` +
        `<b>${p.value[1] >= 0 ? "+" : ""}${p.value[1].toFixed(1)}%</b> vs. año anterior`,
    },
    xAxis: {
      type: "category" as const,
      data: marcas,
      axisLabel: {
        color: theme.text,
        fontSize: 10,
        rotate: 55,
        interval: 0,
        // La marca propia va en el acento, para encontrarla de un vistazo
        // entre 30 columnas.
        formatter: (m: string) => m,
      },
      axisLine: { lineStyle: { color: theme.grid } },
      axisTick: { show: false },
      splitLine: { show: false },
    },
    yAxis: {
      type: "value" as const,
      name: "% vs. año anterior",
      nameTextStyle: { color: theme.text, fontSize: 11, align: "left" as const },
      axisLabel: {
        color: theme.text,
        fontSize: 11,
        formatter: (v: number) => `${v > 0 ? "+" : ""}${v}%`,
      },
      splitLine: { lineStyle: { color: theme.grid, type: "dashed" as const } },
    },
    series: [
      {
        type: "scatter" as const,
        symbolSize: (val: number[]) => radio(val[2]) * 2,
        data: puntos,
        emphasis: {
          focus: "self" as const,
          itemStyle: { opacity: 1, borderWidth: 2 },
        },
        // La línea del 0% separa crecimiento de caída: es la lectura
        // principal del gráfico, no una guía decorativa.
        markLine: {
          silent: true,
          symbol: "none" as const,
          lineStyle: { color: theme.axis, type: "solid" as const, width: 1, opacity: 0.5 },
          label: {
            show: true,
            position: "end" as const,
            formatter: "0%",
            color: theme.text,
            fontSize: 10,
          },
          data: [{ yAxis: 0 }],
        },
      },
    ],
  };

  return <EchartsAuto option={option} style={{ height: altura, width: "100%" }} />;
}
