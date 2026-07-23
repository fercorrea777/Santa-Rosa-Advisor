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
}

const FALLBACK: ChartTheme = {
  // Mismos ocho tonos que --chart-1..8 en globals.css (modo claro), por si
  // getComputedStyle todavia no resolvio los tokens.
  series: ["#2a78d6", "#008300", "#e87ba4", "#eda100", "#1baf7a", "#eb6834", "#4a3aa7", "#e34948"],
  primary: "#2563eb",
  positive: "#10b981",
  negative: "#f43f5e",
  axis: "#94a3b8",
  text: "#64748b",
  grid: "#e2e8f0",
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
    });
  }, [resolvedTheme]);

  return theme;
}
