"use client";

import { EchartsAuto } from "@/components/charts/echarts-auto";
import { FUENTE_MONO_EJES, TOOLTIP_BASE, useChartTheme } from "@/lib/chart-theme";
import { formatUnidades } from "@/lib/format";

export interface PeldanoPrecio {
  modelo: string;
  /** Precio de lista "desde" y "hasta" (US$). */
  desde: number;
  hasta: number;
  versiones: number;
  unidades: number;
  clase: string;
}

/**
 * Escalera de precios: cada modelo de la marca es una barra horizontal que
 * va de su versión más barata a la más cara, ordenadas de menor a mayor.
 * Es la foto del portafolio que pidió Fernando (15/09/2026): dónde se
 * para cada modelo en precio, qué huecos deja la gama y cuánto se pisa
 * un modelo con el siguiente.
 *
 * Barra apilada sobre una base transparente: es la forma de dibujar un
 * rango [desde, hasta] con barras normales sin recurrir a una serie
 * custom. Un modelo con una sola versión (desde = hasta) se dibuja con un
 * ancho mínimo para que se vea como un punto, no como nada.
 */
export function EscaleraPreciosChart({ filas }: { filas: PeldanoPrecio[] }) {
  const theme = useChartTheme();
  if (!filas.length) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Ningún modelo de esta marca tiene precio de lista en las fuentes cargadas.
      </p>
    );
  }
  // Ascendente: ECharts pinta las categorías de abajo hacia arriba, y la
  // escalera se lee mejor con lo barato abajo.
  const ordenadas = [...filas].sort((a, b) => a.desde - b.desde);
  const maxU = Math.max(...ordenadas.map((f) => f.unidades), 1);
  const minAncho = Math.max(400, Math.round(Math.max(...ordenadas.map((f) => f.hasta)) * 0.01));
  const usd = (n: number) => `US$ ${formatUnidades(Math.round(n))}`;

  const option = {
    animationDuration: 700,
    animationEasing: "cubicOut" as const,
    grid: { left: 8, right: 110, top: 8, bottom: 8, containLabel: true },
    tooltip: {
      ...TOOLTIP_BASE,
      trigger: "item",
      formatter: (p: { dataIndex: number }) => {
        const f = ordenadas[p.dataIndex];
        return (
          `<b>${f.modelo}</b> · ${f.clase}<br/>` +
          `${usd(f.desde)}${f.hasta > f.desde ? ` a ${usd(f.hasta)}` : ""}` +
          `<br/><span style="font-size:11px;opacity:.75">${f.versiones} ${f.versiones === 1 ? "versión" : "versiones"} con precio · ${formatUnidades(f.unidades)} u. matriculadas</span>`
        );
      },
    },
    xAxis: {
      type: "value",
      splitLine: { lineStyle: { color: theme.grid } },
      axisLabel: {
        color: theme.text, fontSize: 11, fontFamily: FUENTE_MONO_EJES,
        formatter: (v: number) => `${Math.round(v / 1000)}k`,
      },
    },
    yAxis: {
      type: "category",
      data: ordenadas.map((f) => f.modelo),
      axisLine: { lineStyle: { color: theme.grid } },
      axisTick: { show: false },
      axisLabel: { color: theme.etiqueta, fontSize: 11 },
    },
    series: [
      {
        type: "bar",
        stack: "precio",
        silent: true,
        barMaxWidth: 18,
        itemStyle: { color: "transparent" },
        data: ordenadas.map((f) => f.desde),
      },
      {
        type: "bar",
        stack: "precio",
        barMaxWidth: 18,
        itemStyle: {
          borderRadius: 4,
          // La intensidad sigue al volumen: el modelo que más vende, más
          // pleno. Así la escalera dice precio Y peso de un vistazo.
          color: (p: { dataIndex: number }) => {
            const peso = 0.35 + 0.65 * (ordenadas[p.dataIndex].unidades / maxU);
            const alfa = Math.round(peso * 255).toString(16).padStart(2, "0");
            return `${theme.series[0]}${alfa}`;
          },
        },
        label: {
          show: true,
          position: "right",
          color: theme.etiqueta,
          fontSize: 11,
          fontFamily: FUENTE_MONO_EJES,
          formatter: (p: { dataIndex: number }) => {
            const f = ordenadas[p.dataIndex];
            return f.hasta > f.desde
              ? `${formatUnidades(Math.round(f.desde))}–${formatUnidades(Math.round(f.hasta))}`
              : formatUnidades(Math.round(f.desde));
          },
        },
        data: ordenadas.map((f) => Math.max(f.hasta - f.desde, minAncho)),
      },
    ],
  };

  return (
    <EchartsAuto
      option={option}
      notMerge
      style={{ height: Math.max(220, 30 * ordenadas.length + 40), width: "100%" }}
    />
  );
}
