"use client";

import { useEffect, useRef } from "react";
import ReactECharts, { type EChartsReactProps } from "echarts-for-react";

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
export function EchartsAuto(props: EChartsReactProps) {
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

  return (
    <div ref={divRef}>
      <ReactECharts ref={chartRef} {...props} />
    </div>
  );
}
