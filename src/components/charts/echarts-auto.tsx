"use client";

import { useEffect, useRef } from "react";
import ReactECharts, { type EChartsReactProps } from "echarts-for-react";
import { FUENTE_MONO_EJES, FUENTE_SANS_GRAFICOS } from "@/lib/chart-theme";

/**
 * ReactECharts que sigue el ancho real de su contenedor. El componente base
 * solo escucha `resize` de window: si el canvas se inicializa antes de que
 * el layout asiente (hidratación, carga de fuentes, sidebar), queda con un
 * ancho interno incorrecto y se ve estirado/borroso para siempre. El
 * ResizeObserver corrige eso apenas el contenedor toma su tamaño real.
 *
 * NO condicionar el montaje del chart a que el ResizeObserver dispare. Se
 * probó (para silenciar el "Can't get DOM width or height" que ECharts loguea
 * al iniciarse a 0x0) y es una trampa: hay entornos donde el RO no entrega la
 * observación inicial — un Chromium headless que no compone frames, por
 * ejemplo — y ahí el gráfico no aparece nunca. El RO tiene que ser corrección,
 * no requisito. El warning es cosmético; el chart se autocorrige.
 */
export function EchartsAuto({ option, ...props }: EChartsReactProps) {
  const divRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReactECharts>(null);

  useEffect(() => {
    const el = divRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      chartRef.current?.getEchartsInstance()?.resize();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // El texto del canvas se dibuja con la fuente que haya en el instante del
  // trazo: si Inter o JetBrains Mono todavía no bajaron, sale la de reserva y
  // ECharts no se entera de que después llegó la buena. Cuando terminan de
  // cargar se pide un repintado. Nunca condiciona el montaje (misma trampa que
  // el ResizeObserver de arriba): si la carga falla, el gráfico igual se ve.
  useEffect(() => {
    if (typeof document === "undefined" || !document.fonts) return;
    let vivo = true;
    const repintar = () => {
      if (vivo) chartRef.current?.getEchartsInstance()?.resize();
    };
    Promise.all([
      document.fonts.load(`500 11px ${FUENTE_SANS_GRAFICOS}`),
      document.fonts.load(`700 11px ${FUENTE_MONO_EJES}`),
    ]).then(repintar, () => {});
    return () => {
      vivo = false;
    };
  }, []);

  // La fuente base del gráfico es la sans del sistema (Inter); cada gráfico
  // puede pisarla (los números de ejes ya piden la mono por su cuenta).
  const conFuente = {
    ...option,
    textStyle: { fontFamily: FUENTE_SANS_GRAFICOS, ...(option?.textStyle ?? {}) },
  };

  return (
    <div ref={divRef}>
      <ReactECharts ref={chartRef} option={conFuente} {...props} />
    </div>
  );
}
