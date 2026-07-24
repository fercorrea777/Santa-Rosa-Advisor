"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Anima un numero desde el valor mostrado actual hasta el valor final en
 * `duracionMs`. Salta directo al valor final si el usuario configuro
 * prefers-reduced-motion.
 *
 * Retarget, no restart: si `valorFinal` cambia a mitad de la animacion (ej.
 * el usuario cambia de filtro rapido), arranca desde donde esta el numero
 * EN ESE MOMENTO en pantalla, no desde 0 — lo mismo que una transicion CSS
 * interrumpida, evita el salto hacia abajo y el re-conteo completo.
 *
 * El valor real SIEMPRE gana sobre la animacion: si requestAnimationFrame
 * no llega a correr (pestaña en segundo plano, throttling del navegador,
 * renderer sin pintar) una red de seguridad con setTimeout fuerza el valor
 * final. Un dashboard cuyo principio es "nunca inventar datos" no puede
 * quedarse mostrando un 0 falso cuando el numero real es otro.
 */
export function useCountUp(valorFinal: number, duracionMs = 260): number {
  const [valor, setValor] = useState(0);
  const valorRef = useRef(0);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      valorRef.current = valorFinal;
      setValor(valorFinal);
      return;
    }
    const desde = valorRef.current;
    const delta = valorFinal - desde;
    let inicio: number | null = null;
    let frame: number;
    const paso = (t: number) => {
      if (inicio === null) inicio = t;
      const p = Math.min(1, (t - inicio) / duracionMs);
      const ease = 1 - Math.pow(1 - p, 3);
      const actual = Math.round(desde + delta * ease);
      valorRef.current = actual;
      setValor(actual);
      if (p < 1) frame = requestAnimationFrame(paso);
    };
    frame = requestAnimationFrame(paso);
    // Red de seguridad: los timers corren aunque rAF esté pausado, así que
    // esto garantiza el valor final incluso si la animacion nunca arrancó.
    const respaldo = setTimeout(() => {
      valorRef.current = valorFinal;
      setValor(valorFinal);
    }, duracionMs + 200);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(respaldo);
    };
  }, [valorFinal, duracionMs]);

  return valor;
}
