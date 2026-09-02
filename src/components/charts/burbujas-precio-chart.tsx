"use client";

import { EchartsAuto } from "@/components/charts/echarts-auto";
import { TOOLTIP_BASE, useChartTheme } from "@/lib/chart-theme";
import { formatUnidades } from "@/lib/format";

export interface BurbujaPrecio {
  marca: string;
  modelo: string;
  /** Unidades del período. Define el TAMAÑO de la burbuja. */
  unidades: number;
  precio: number;
  moneda: string;
  periodoPrecio: string;
}

/**
 * Posicionamiento de la gama propia: una burbuja por modelo, agrupada en la
 * columna de su marca. Eje Y = PRECIO de lista · tamaño = unidades.
 *
 * Es el gráfico que el tablero de referencia hace con precio, y que acá solo
 * se puede armar sobre la gama propia: CADAM no trae importes, así que los
 * únicos precios que existen son los de la lista de Santa Rosa. No compara
 * contra competencia — no hay con qué.
 *
 * Deliberadamente separado de BurbujasMarcaChart en vez de generalizarlo con
 * props: ese tiene recorte de eje, línea del 0% y símbolos de desborde que
 * acá no aplican (un precio no se dispara ni es negativo). Un componente con
 * la mitad de su lógica apagada por bandera se lee peor que dos.
 *
 * El área (no el diámetro) es proporcional a las unidades: de ahí el sqrt.
 */
/** Nombre de version recortado para la etiqueta. Los de Cars llegan a
 *  "TANK 400 PHEV 4WD PREMIUM": entero tapa a la burbuja vecina, y cortado
 *  sigue siendo reconocible porque lo que identifica al modelo va al
 *  principio. El nombre completo queda en el tooltip. */
function recortar(nombre: string, max = 22): string {
  return nombre.length <= max ? nombre : `${nombre.slice(0, max - 1).trimEnd()}…`;
}

export function BurbujasPrecioChart({
  datos,
  altura = 420,
  etiquetas = false,
}: {
  datos: BurbujaPrecio[];
  altura?: number;
  /** Escribe el nombre de cada burbuja al lado. Con pocas burbujas ayuda;
   *  con muchas, ECharts esconde las que se pisan (`hideOverlap`) y quedan
   *  rotuladas las que tienen aire. */
  etiquetas?: boolean;
}) {
  const theme = useChartTheme();

  if (!datos.length) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        Ningún modelo propio con ventas tiene precio en la lista cargada.
      </p>
    );
  }

  // Marcas por volumen. Acá no hace falta poner las propias primero: todas
  // lo son.
  const volPorMarca = new Map<string, number>();
  for (const d of datos) {
    volPorMarca.set(d.marca, (volPorMarca.get(d.marca) ?? 0) + d.unidades);
  }
  const marcas = [...volPorMarca.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([m]) => m);
  const indice = new Map(marcas.map((m, i) => [m, i]));

  const maxU = Math.max(...datos.map((d) => d.unidades));
  const anchoColumna = 820 / Math.max(marcas.length, 1);
  const MIN_PX = 5;
  const MAX_PX = Math.max(14, Math.min(34, anchoColumna));
  const radio = (u: number) => MIN_PX + (MAX_PX - MIN_PX) * Math.sqrt(u / maxU);

  const moneda = datos[0].moneda;
  const fmt = (v: number) =>
    v >= 1_000_000
      ? `${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1)} M`
      : formatUnidades(v);

  const puntos = datos.map((d) => ({
    value: [indice.get(d.marca) ?? 0, d.precio, d.unidades],
    name: d.modelo,
    marca: d.marca,
    periodoPrecio: d.periodoPrecio,
    moneda: d.moneda,
    itemStyle: {
      color: theme.series[(indice.get(d.marca) ?? 0) % theme.series.length],
      opacity: 0.75,
      borderColor: theme.text,
      borderWidth: 1,
    },
  }));

  // Precio promedio PONDERADO por unidades, no promedio simple: el promedio
  // simple le da el mismo peso a un modelo que vendió 3 unidades que a uno
  // que vendió 300, y describe la lista en vez de describir lo que se vende.
  const unidadesTotal = datos.reduce((s, d) => s + d.unidades, 0);
  const ponderado =
    datos.reduce((s, d) => s + d.precio * d.unidades, 0) / (unidadesTotal || 1);

  const option = {
    animationDuration: 700,
    animationEasing: "cubicOut" as const,
    grid: { left: 72, right: 16, top: 16, bottom: 84 },
    tooltip: {
      ...TOOLTIP_BASE,
      trigger: "item",
      formatter: (p: {
        name: string;
        value: number[];
        data: { marca: string; periodoPrecio: string; moneda: string };
      }) =>
        `<b>${p.data.marca}</b> · ${p.name}<br/>` +
        `${p.data.moneda} ${p.value[1].toLocaleString("es-PY")}<br/>` +
        `${formatUnidades(p.value[2])} u. en el período` +
        `<br/><span style="font-size:11px;opacity:.75">Lista de ${p.data.periodoPrecio}</span>`,
    },
    xAxis: {
      type: "category" as const,
      data: marcas,
      axisLabel: {
        // La marca en el acento y en negrita: en este gráfico la columna ES
        // la marca, no una etiqueta de escala. Mismo papel que en la
        // referencia, con nuestro color y no el de ellos.
        color: theme.primary,
        fontSize: 10,
        fontWeight: "bold" as const,
        // `rotate: 45` fijo dejaba las marcas cortas torcidas sin necesidad.
        // Con muchas columnas no hay lugar horizontal y ahí sí se rota.
        rotate: marcas.length > 12 ? 45 : 0,
        interval: 0,
      },
      axisLine: { lineStyle: { color: theme.grid } },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value" as const,
      name: `Precio de lista (${moneda})`,
      nameTextStyle: { color: theme.text, fontSize: 11, align: "left" as const },
      axisLabel: { color: theme.text, fontSize: 11, formatter: fmt },
      splitLine: { lineStyle: { color: theme.grid, type: "dashed" as const } },
    },
    series: [
      {
        type: "scatter" as const,
        symbolSize: (val: number[]) => radio(val[2]) * 2,
        data: puntos,
        label: etiquetas
          ? {
              show: true,
              position: "right" as const,
              distance: 4,
              color: theme.text,
              fontSize: 9,
              formatter: (p: { name: string }) => recortar(p.name),
            }
          : { show: false },
        // Sin esto, con 130 burbujas las etiquetas se apilan hasta volverse
        // una mancha. `hideOverlap` deja rotuladas las que tienen aire y
        // esconde el resto — que igual se leen en el tooltip.
        labelLayout: { hideOverlap: true },
        emphasis: { focus: "self" as const, itemStyle: { opacity: 1, borderWidth: 2 } },
        markLine: {
          silent: true,
          symbol: "none" as const,
          lineStyle: { color: theme.primary, type: "dashed" as const, width: 1 },
          label: {
            show: true,
            position: "insideEndTop" as const,
            formatter: `Ponderado ${fmt(ponderado)}`,
            color: theme.primary,
            fontSize: 10,
          },
          data: [{ yAxis: ponderado }],
        },
      },
    ],
  };

  return <EchartsAuto option={option} style={{ height: altura, width: "100%" }} />;
}
