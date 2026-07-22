"use client";

import { useEffect, useState } from "react";

/**
 * Anima un numero de 0 al valor final en `duracionMs`. Salta directo al
 * valor final si el usuario configuro prefers-reduced-motion.
 *
 * El valor real SIEMPRE gana sobre la animacion: si requestAnimationFrame
 * no llega a correr (pestaña en segundo plano, throttling del navegador,
 * renderer sin pintar) una red de seguridad con setTimeout fuerza el valor
 * final. Un dashboard cuyo principio es "nunca inventar datos" no puede
 * quedarse mostrando un 0 falso cuando el numero real es otro.
 */
export function useCountUp(valorFinal: number, duracionMs = 900): number {
  const [valor, setValor] = useState(0);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setValor(valorFinal);
      return;
    }
    let inicio: number | null = null;
    let frame: number;
    const paso = (t: number) => {
      if (inicio === null) inicio = t;
      const p = Math.min(1, (t - inicio) / duracionMs);
      const ease = 1 - Math.pow(1 - p, 3);
      setValor(Math.round(valorFinal * ease));
      if (p < 1) frame = requestAnimationFrame(paso);
    };
    frame = requestAnimationFrame(paso);
    // Red de seguridad: los timers corren aunque rAF esté pausado, así que
    // esto garantiza el valor final incluso si la animacion nunca arrancó.
    const respaldo = setTimeout(() => setValor(valorFinal), duracionMs + 200);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(respaldo);
    };
  }, [valorFinal, duracionMs]);

  return valor;
}
