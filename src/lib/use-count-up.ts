"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const CONSULTA = "(prefers-reduced-motion: reduce)";

function suscribir(alCambiar: () => void) {
  const mq = window.matchMedia(CONSULTA);
  mq.addEventListener("change", alCambiar);
  return () => mq.removeEventListener("change", alCambiar);
}
const leerCliente = () => window.matchMedia(CONSULTA).matches;
/** En el servidor no hay forma de saberlo. `false` es lo que ya pasaba antes
 *  (el chequeo vivía en un efecto, que solo corre en el cliente) y además es
 *  lo que hace que el HTML del servidor coincida con la primera pasada de
 *  hidratación; React vuelve a renderizar enseguida con el valor real. */
const leerServidor = () => false;

/**
 * Anima un numero desde el valor mostrado actual hasta el valor final en
 * `duracionMs`.
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
 *
 * PREFERS-REDUCED-MOTION SE LEE EN EL RENDER, NO EN UN EFECTO. Antes se
 * consultaba adentro del efecto y se hacia `setValor(valorFinal)` ahi mismo:
 * eso es un setState sincrono dentro de un efecto, o sea un render en
 * cascada (render -> efecto -> setState -> render) para llegar a un numero
 * que ya se conocia — y lo que marcaba `react-hooks/set-state-in-effect`.
 * Ahora el valor sale directo por el `return`, sin pasar por el estado.
 *
 * `useSyncExternalStore` y no un `useState` con listener: matchMedia es un
 * store externo y esta es la forma que React tiene para eso. De paso arregla
 * algo que antes no andaba — si alguien cambia la preferencia del sistema con
 * la pagina abierta, ahora se entera; antes solo se releia cuando cambiaba
 * `valorFinal`.
 */
export function useCountUp(valorFinal: number, duracionMs = 260): number {
  const menosMovimiento = useSyncExternalStore(suscribir, leerCliente, leerServidor);
  const [valor, setValor] = useState(0);
  const valorRef = useRef(0);

  useEffect(() => {
    if (menosMovimiento) {
      // Nada que animar. Se actualiza el ref igual —no el estado— para que
      // si la preferencia se apaga a mitad de sesion, la animacion siguiente
      // arranque desde el numero que hay en pantalla y no desde cero.
      valorRef.current = valorFinal;
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
  }, [valorFinal, duracionMs, menosMovimiento]);

  return menosMovimiento ? valorFinal : valor;
}
