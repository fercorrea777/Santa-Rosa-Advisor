"use client";

import { useEffect, useState } from "react";

/**
 * Anima un numero de 0 al valor final en `duracionMs`. Salta directo al
 * valor final si el usuario configuro prefers-reduced-motion.
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
    return () => cancelAnimationFrame(frame);
  }, [valorFinal, duracionMs]);

  return valor;
}
