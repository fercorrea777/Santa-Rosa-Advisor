"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

export interface ChartTheme {
  series: string[]; // paleta --chart-1..5
  primary: string;
  positive: string;
  negative: string;
  axis: string; // color de ejes/lineas
  text: string; // color de texto de labels
  grid: string; // lineas de grilla suaves
  /** Color de las etiquetas de valor dibujadas sobre las marcas. Mas oscuro
   *  que `text`: la cifra tiene que leerse a distancia de proyector, y el
   *  gris de los ejes a 11px se pierde. */
  etiqueta: string;
  /** --card resuelto: para bordes/separadores dibujados en CANVAS, donde
   *  un var() crudo no se resuelve — a diferencia del tooltip, que es HTML
   *  real. Sin uso hoy (lo usaba el donut, reemplazado por barras en
   *  2026-09); se conserva porque cualquier chart que dibuje un separador
   *  sobre la tarjeta lo necesita y no hay otra forma de leer el token. */
  card: string;
}

const FALLBACK: ChartTheme = {
  // Mismos ocho tonos que --chart-1..8 en globals.css (modo claro), por si
  // getComputedStyle todavia no resolvio los tokens. SI SE TOCAN ALLA, HAY QUE
  // TOCARLOS ACA: son la misma paleta escrita dos veces, y desincronizarlas
  // significa que el primer frame se dibuja con colores que ya no existen.
  // (2026-09-03: rosa, ambar y verde bajados para pasar 3:1 contra el panel
  // blanco — ver el comentario en globals.css.)
  series: ["#2a78d6", "#008300", "#d9739a", "#c78700", "#19a774", "#eb6834", "#4a3aa7", "#e34948"],
  primary: "#2563eb",
  positive: "#10b981",
  negative: "#f43f5e",
  axis: "#94a3b8",
  text: "#64748b",
  grid: "#e2e8f0",
  etiqueta: "#334155",
  card: "#ffffff",
};

function readVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/**
 * Tooltip base compartido por todos los charts. El tooltip de ECharts es un
 * div HTML real, así que acá SÍ funcionan las variables CSS (a diferencia
 * del canvas): sigue el tema claro/oscuro solo, sin re-leer tokens.
 */
export const TOOLTIP_BASE = {
  backgroundColor: "var(--popover)",
  borderColor: "var(--border)",
  borderWidth: 1,
  padding: [8, 12] as [number, number],
  textStyle: { color: "var(--popover-foreground)", fontSize: 12 },
  extraCssText:
    "border-radius:10px;box-shadow:0 8px 24px -12px oklch(0.2 0.05 260 / 35%);",
};

/** Los números de ejes van en la mono del sistema (tabular, como las cifras
 *  de las tarjetas) — la sans propor­cional hace bailar los ticks. */
export const FUENTE_MONO_EJES = "var(--font-geist-mono), monospace";

/**
 * ETIQUETAS DE VALOR SOBRE LA MARCA.
 *
 * Croman pidió (2026-09-03) que los gráficos muestren el número encima, como
 * el tablero de Grupo Antelo que usa de referencia: ahí cada barra lleva su
 * cifra en negrita arriba, y no hay que pasar el mouse para leer el dato.
 *
 * POR QUE IMPORTA MÁS DE LO QUE PARECE: este tablero se PROYECTA en reuniones.
 * Un tooltip no existe en un proyector — nadie va a pasar el mouse mientras
 * habla. Si el número no está dibujado, para media sala ese gráfico no tiene
 * datos, solo formas.
 *
 * `distancia` separa la etiqueta de la punta de la barra; hay que acompañarla
 * con aire en el `grid.top` del chart o la fila de arriba se corta.
 */
export function etiquetaValor(
  theme: ChartTheme,
  opciones: {
    formatter: (v: number) => string;
    posicion?: "top" | "right" | "inside";
    distancia?: number;
    /** Para series de comparación (el año anterior): más tenue, para que la
     *  serie principal siga siendo la que se lee primero. */
    tenue?: boolean;
  }
) {
  return {
    show: true,
    position: opciones.posicion ?? "top",
    distance: opciones.distancia ?? 6,
    color: opciones.tenue ? theme.text : theme.etiqueta,
    fontSize: 11,
    fontWeight: opciones.tenue ? (400 as const) : (700 as const),
    fontFamily: FUENTE_MONO_EJES,
    // Los valores nulos son huecos reales del origen (falta febrero 2022, por
    // ejemplo). Dibujar "0" ahí sería afirmar que ese mes no se vendió nada.
    formatter: (p: { value: number | null }) =>
      p.value === null || p.value === undefined ? "" : opciones.formatter(p.value),
  };
}

/**
 * Ejes al estilo de la referencia: grilla horizontal tenue, SIN línea de eje
 * ni marcas. La grilla ayuda a comparar alturas; el marco alrededor solo
 * agrega tinta que no aporta.
 */
export function ejeValor(theme: ChartTheme, formatter: (v: number) => string) {
  return {
    type: "value" as const,
    splitLine: { lineStyle: { color: theme.grid, type: "solid" as const } },
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: {
      color: theme.text, fontSize: 11,
      fontFamily: FUENTE_MONO_EJES, formatter,
    },
  };
}

/** Lee la paleta de tokens CSS (shadcn) resuelta, y se recalcula al cambiar de tema. */
export function useChartTheme(): ChartTheme {
  const { resolvedTheme } = useTheme();
  const [theme, setTheme] = useState<ChartTheme>(FALLBACK);

  useEffect(() => {
    // Sincroniza con un sistema externo (CSSOM/getComputedStyle), no con props/estado de React:
    // no hay forma de leer esto durante el render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme({
      series: FALLBACK.series.map((f, i) => readVar(`--chart-${i + 1}`, f)),
      primary: readVar("--primary", FALLBACK.primary),
      positive: readVar("--color-emerald-500", "#10b981"),
      negative: readVar("--color-rose-500", "#f43f5e"),
      axis: readVar("--border", FALLBACK.axis),
      text: readVar("--muted-foreground", FALLBACK.text),
      grid: readVar("--border", FALLBACK.grid),
      etiqueta: readVar("--foreground", FALLBACK.etiqueta),
      card: readVar("--card", FALLBACK.card),
    });
  }, [resolvedTheme]);

  return theme;
}
