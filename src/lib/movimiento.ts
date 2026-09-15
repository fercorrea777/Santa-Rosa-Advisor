import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useSyncExternalStore } from "react";

/**
 * Punto único de entrada a GSAP.
 *
 * Todo lo que anime con GSAP importa `gsap` de acá y no de "gsap" directo,
 * por dos motivos: que el plugin de scroll quede registrado una sola vez
 * (registrarlo en cada componente es inofensivo pero ruidoso) y que la
 * curva y los tiempos sean los mismos en toda la app — una entrada de
 * página, una fila de tabla y una cifra que cuenta tienen que sentirse de
 * la misma familia, y eso se logra compartiendo constantes, no criterio.
 *
 * DOS LIBRERÍAS, DOS TRABAJOS. GSAP anima DOM que ya existe: lo que llega
 * del servidor (tarjetas, filas, cifras) y hay que hacer entrar en escena
 * sin envolver cada nodo en un componente. Motion anima lo que React monta
 * y desmonta con estado (píldora del menú, chips de filtro, mensajes del
 * copiloto): ahí la presencia y el layout compartido son lo que vale, y
 * hacerlo a mano con GSAP sería reescribir Motion.
 *
 * `registerPlugin` va detrás de un `typeof window`: los módulos de cliente
 * también se evalúan en el servidor durante el SSR, y ScrollTrigger toca
 * `window` al registrarse.
 */
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export { gsap, ScrollTrigger };

/** Curva de todas las entradas: arranca rápido y frena suave. La misma que
 *  usan las transiciones CSS del tablero (cubic-bezier(0.22, 1, 0.36, 1)),
 *  para que lo que anima GSAP y lo que anima CSS no se sientan distintos. */
export const SUAVE = "power3.out";
/** La misma curva, en el formato que entiende Motion. */
export const SUAVE_BEZIER: [number, number, number, number] = [0.22, 1, 0.36, 1];

export const DURACION = {
  /** Micro-interacciones: chips, filas, cambios de pestaña. */
  corta: 0.28,
  /** Entradas de bloques: tarjetas, encabezados. */
  media: 0.5,
  /** Cifras que cuentan: lo justo para que se vea el conteo sin que
   *  parezca que el número tarda en llegar. */
  larga: 0.9,
} as const;

const CONSULTA = "(prefers-reduced-motion: reduce)";

/** Lectura puntual, para efectos y timelines. Motion lo resuelve solo con
 *  `MotionConfig reducedMotion="user"`; esto es para GSAP, que no mira la
 *  preferencia del sistema por su cuenta. */
export function menosMovimiento(): boolean {
  return typeof window !== "undefined" && window.matchMedia(CONSULTA).matches;
}

function suscribir(alCambiar: () => void) {
  const mq = window.matchMedia(CONSULTA);
  mq.addEventListener("change", alCambiar);
  return () => mq.removeEventListener("change", alCambiar);
}
const leerCliente = () => window.matchMedia(CONSULTA).matches;
/** En el servidor no hay forma de saberlo; `false` coincide con lo que el
 *  cliente ve en su primera pasada de hidratación. */
const leerServidor = () => false;

/** Versión reactiva: se entera si la preferencia cambia con la página
 *  abierta. matchMedia es un store externo y esta es la forma de React de
 *  leerlo sin estado duplicado. */
export function useMenosMovimiento(): boolean {
  return useSyncExternalStore(suscribir, leerCliente, leerServidor);
}
