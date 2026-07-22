"use client";

import { useEffect, useRef } from "react";
import ReactECharts, { type EChartsReactProps } from "echarts-for-react";

/**
 * ReactECharts que sigue el ancho real de su contenedor. El componente base
 * solo escucha `resize` de window: si el canvas se inicializa antes de que
 * el layout asiente (hidratación, carga de fuentes, sidebar), queda con un
 * ancho interno incorrecto y se ve estirado/borroso para siempre. El
 * ResizeObserver corrige eso apenas el contenedor toma su tamaño real.
 */
export function EchartsAuto(props: EChartsReactProps) {
  const divRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReactECharts>(null);

  useEffect(() => {
    const el = divRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      chartRef.current?.getEchartsInstance().resize();
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
