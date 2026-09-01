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
  techo,
}: {
  datos: Burbuja[];
  altura?: number;
  /** Techo del eje de variación, en %. Llega por prop y no como constante
   *  exportada de acá: este módulo es "use client", y un Server Component que
   *  importara la constante recibiría la referencia de cliente en vez del
   *  número — `x > undefined` es siempre false y el recorte se contaba como
   *  cero sin fallar en ningún lado. La página es la dueña del valor. */
  techo: number;
}) {
  const TECHO_VARIACION = techo;
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

  // Un color por marca, de la paleta categórica de la app (--chart-1..8, la
  // que ya está validada para daltonismo). Son más marcas que colores, así
  // que la paleta cicla: es aceptable porque el color acá NO es el canal de
  // identidad — cada marca tiene su propia columna y su etiqueta en el eje.
  // El color sirve para seguir un grupo de burbujas de un vistazo, no para
  // decir cuál es cuál.
  const colorDeMarca = (marca: string) =>
    theme.series[(indice.get(marca) ?? 0) % theme.series.length];

  // Las burbujas que se pasan del techo NO se descartan: se fijan en el borde
  // y cambian de círculo a TRIÁNGULO, que apunta hacia afuera. Poner un `max`
  // en el eje sin esto haría que ECharts directamente no las dibuje — el dato
  // desaparecería sin que nadie se entere, que es peor que el eje estirado.
  // El tooltip siempre muestra el valor real, no el recortado.
  const puntos = datos.map((d) => {
    const real = d.variacion * 100;
    const recortada = real > TECHO_VARIACION;
    return {
      value: [indice.get(d.marca) ?? 0, Math.min(real, TECHO_VARIACION), d.unidades],
      name: d.modelo,
      marca: d.marca,
      anterior: d.unidadesAnterior,
      real,
      recortada,
      symbol: recortada ? ("triangle" as const) : ("circle" as const),
      itemStyle: {
        color: colorDeMarca(d.marca),
        // Las propias van opacas y con borde marcado; el resto translúcido,
        // para que se lean como fondo de comparación y no compitan.
        opacity: d.esPropia ? 0.9 : 0.55,
        borderColor: d.esPropia ? theme.text : "transparent",
        borderWidth: d.esPropia ? 1.5 : 0,
      },
    };
  });

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
        data: { marca: string; anterior: number; real: number; recortada: boolean };
      }) =>
        `<b>${p.data.marca}</b> · ${p.name}<br/>` +
        `${formatUnidades(p.value[2])} u. ` +
        `<span style="opacity:.7">(antes ${formatUnidades(p.data.anterior)})</span><br/>` +
        `<b>${p.data.real >= 0 ? "+" : ""}${p.data.real.toFixed(1)}%</b> vs. año anterior` +
        (p.data.recortada
          ? `<br/><span style="font-size:11px;opacity:.75">Se sale del eje: dibujada en el tope de +${TECHO_VARIACION}%</span>`
          : ""),
    },
    xAxis: {
      type: "category" as const,
      data: marcas,
      axisLabel: {
        color: theme.text,
        fontSize: 10,
        rotate: 55,
        interval: 0,
        // Las marcas propias van en negrita y en el acento: con la paleta
        // ciclando entre las burbujas, la etiqueta es lo que las hace
        // encontrables de un vistazo.
        formatter: (m: string) => (propiaPorMarca.get(m) ? `{propia|${m}}` : m),
        rich: {
          propia: { color: theme.primary, fontWeight: "bold" as const, fontSize: 10 },
        },
      },
      axisLine: { lineStyle: { color: theme.grid } },
      axisTick: { show: false },
      splitLine: { show: false },
    },
    yAxis: {
      type: "value" as const,
      name: "% vs. año anterior",
      nameTextStyle: { color: theme.text, fontSize: 11, align: "left" as const },
      max: TECHO_VARIACION,
      axisLabel: {
        color: theme.text,
        fontSize: 11,
        // El tope se rotula con ≥ para que se lea que ahí hay valores
        // mayores, no que el máximo del dato sea ese.
        formatter: (v: number) =>
          v === TECHO_VARIACION ? `≥ +${v}%` : `${v > 0 ? "+" : ""}${v}%`,
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
