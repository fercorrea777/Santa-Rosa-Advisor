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
 * Posicionamiento de la gama propia: una burbuja por versión, agrupada en la
 * columna de su marca. Eje Y = PRECIO de lista · área = unidades.
 *
 * Rediseñado (2026-09) con el skill de dataviz después de que Croman mostrara
 * una captura donde esto era ilegible. Los cuatro defectos y su corrección:
 *
 * 1. TODAS las versiones de una marca caían en el MISMO x: veinte burbujas
 *    apiladas en una línea vertical se funden en una mancha. Ahora el eje X
 *    es numérico y cada versión se corre dentro de su columna con un JITTER
 *    DETERMINISTA (hash del nombre, no Math.random: aleatorio saltaría en
 *    cada render y rompería la hidratación SSR).
 * 2. Burbujas con borde de tinta y opacidad alta. La regla del skill: nunca
 *    un borde que no sea dato — la separación la hace un ANILLO de 2px del
 *    color de la SUPERFICIE, que es lo que mantiene legibles los solapes.
 * 3. Etiqueta en cada punto = ninguna etiqueta legible. Se etiqueta
 *    SELECTIVAMENTE: la versión más vendida de cada marca y los dos extremos
 *    de precio del gráfico. El resto vive en el tooltip.
 * 4. El eje Y arrancaba en 0 y la franja 0–10k quedaba vacía. En un scatter
 *    la posición no es una longitud desde cero (eso es de las barras): el
 *    piso se ancla al dato, redondeado hacia abajo al múltiplo de 5k.
 */
export function BurbujasPrecioChart({
  datos,
  altura = 460,
}: {
  datos: BurbujaPrecio[];
  altura?: number;
}) {
  const theme = useChartTheme();

  if (!datos.length) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        Ningún modelo propio con ventas tiene precio en la lista cargada.
      </p>
    );
  }

  // Marcas ordenadas por volumen: la columna con más unidades a la izquierda,
  // que es donde arranca la lectura.
  const volPorMarca = new Map<string, number>();
  for (const d of datos) {
    volPorMarca.set(d.marca, (volPorMarca.get(d.marca) ?? 0) + d.unidades);
  }
  const marcas = [...volPorMarca.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([m]) => m);
  const indice = new Map(marcas.map((m, i) => [m, i]));

  // Jitter determinista en [-0.32, 0.32] de la columna. El hash del nombre
  // reparte las versiones por el ancho; dos renders dan siempre lo mismo.
  const jitter = (nombre: string) => {
    let h = 0;
    for (let i = 0; i < nombre.length; i++) h = (h * 31 + nombre.charCodeAt(i)) | 0;
    return (((h >>> 0) % 1000) / 1000 - 0.5) * 0.64;
  };

  // Área ∝ unidades (de ahí el sqrt). Tope chico: en la captura que motivó
  // el rediseño el radio llegaba a ~34px y las columnas densas eran una
  // mancha; con 16px de tope el solape existe pero cada burbuja se lee.
  const maxU = Math.max(...datos.map((d) => d.unidades));
  const MIN_R = 4; // regla del skill: marcador ≥ 8px de diámetro
  const MAX_R = 16;
  const radio = (u: number) => MIN_R + (MAX_R - MIN_R) * Math.sqrt(u / maxU);

  // Piso del eje anclado al dato, techo redondeado hacia arriba.
  const precios = datos.map((d) => d.precio);
  const pisoY = Math.max(0, Math.floor(Math.min(...precios) / 5000) * 5000 - 5000);
  const techoY = Math.ceil(Math.max(...precios) / 5000) * 5000;

  // --- etiquetas selectivas: la más vendida de cada marca + extremos ---
  const etiquetadas = new Set<string>();
  for (const m of marcas) {
    const top = datos
      .filter((d) => d.marca === m)
      .sort((a, b) => b.unidades - a.unidades)[0];
    if (top && top.unidades > 0) etiquetadas.add(`${top.marca}|${top.modelo}`);
  }
  const caro = [...datos].sort((a, b) => b.precio - a.precio)[0];
  const barato = [...datos].sort((a, b) => a.precio - b.precio)[0];
  etiquetadas.add(`${caro.marca}|${caro.modelo}`);
  etiquetadas.add(`${barato.marca}|${barato.modelo}`);

  /** Nombre recortado: lo que identifica va al principio; el resto, tooltip. */
  const recortar = (n: string, max = 18) =>
    n.length <= max ? n : `${n.slice(0, max - 1).trimEnd()}…`;

  const puntos = datos.map((d) => {
    const i = indice.get(d.marca) ?? 0;
    return {
      value: [i + jitter(d.modelo), d.precio, d.unidades],
      name: d.modelo,
      marca: d.marca,
      periodoPrecio: d.periodoPrecio,
      moneda: d.moneda,
      itemStyle: {
        color: theme.series[i % theme.series.length],
        opacity: 0.82,
        // Anillo del color de la superficie, NO un borde de tinta: es lo que
        // separa dos burbujas que se tocan sin sumar tinta que no es dato.
        borderColor: theme.card,
        borderWidth: 2,
      },
      label: etiquetadas.has(`${d.marca}|${d.modelo}`)
        ? {
            show: true,
            position: "right" as const,
            distance: 4,
            // Tinta de texto, nunca el color de la serie (regla del skill).
            color: theme.text,
            fontSize: 10,
            formatter: () => recortar(d.modelo),
          }
        : { show: false },
    };
  });

  // Precio promedio PONDERADO por unidades: describe lo que se vende, no la
  // lista. El promedio simple le daría el mismo peso a 3 u. que a 300.
  const unidadesTotal = datos.reduce((s, d) => s + d.unidades, 0);
  const ponderado =
    datos.reduce((s, d) => s + d.precio * d.unidades, 0) / (unidadesTotal || 1);

  const fmtK = (v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v));

  const option = {
    animationDuration: 600,
    animationEasing: "cubicOut" as const,
    grid: { left: 8, right: 96, top: 12, bottom: 8, containLabel: true },
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
        `${formatUnidades(p.value[2])} u. facturadas en el período`,
    },
    // Eje X numérico para poder correr cada burbuja dentro de su columna;
    // las marcas entran como etiquetas de los ticks enteros.
    xAxis: {
      type: "value" as const,
      min: -0.5,
      max: marcas.length - 0.5,
      interval: 1,
      axisLabel: {
        color: theme.primary,
        fontSize: 10,
        fontWeight: "bold" as const,
        rotate: marcas.length > 9 ? 40 : 0,
        // Los ticks caen en -0.5, 0.5, 1.5… y en los enteros. Solo los
        // enteros son columnas; el resto queda vacío.
        formatter: (v: number) =>
          Number.isInteger(v) ? (marcas[v] ?? "") : "",
      },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { show: false },
    },
    yAxis: {
      type: "value" as const,
      min: pisoY,
      max: techoY,
      name: `Precio de lista (${datos[0].moneda})`,
      nameTextStyle: { color: theme.text, fontSize: 11, align: "left" as const },
      axisLabel: { color: theme.text, fontSize: 11, formatter: fmtK },
      // Hairline SOLIDA y recesiva (regla del skill: nunca punteada — el
      // punteado agrega ruido de alta frecuencia que compite con el dato).
      splitLine: { lineStyle: { color: theme.grid, width: 1 } },
    },
    series: [
      {
        type: "scatter" as const,
        symbolSize: (val: number[]) => radio(val[2]) * 2,
        data: puntos,
        // Si dos etiquetas selectivas igual chocan, se esconde una: peor es
        // mostrarlas encimadas.
        labelLayout: { hideOverlap: true },
        emphasis: {
          focus: "self" as const,
          itemStyle: { opacity: 1, shadowBlur: 8, shadowColor: "oklch(0.2 0.05 260 / 30%)" },
        },
        markLine: {
          silent: true,
          symbol: "none" as const,
          lineStyle: { color: theme.text, type: "dashed" as const, width: 1, opacity: 0.6 },
          label: {
            show: true,
            position: "insideEndTop" as const,
            formatter: `Ponderado ${fmtK(Math.round(ponderado))}`,
            color: theme.text,
            fontSize: 10,
          },
          data: [{ yAxis: ponderado }],
        },
      },
    ],
  };

  return <EchartsAuto option={option} style={{ height: altura, width: "100%" }} />;
}
