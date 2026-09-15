"use client";

import { MotionConfig } from "motion/react";

/**
 * Configuración de Motion para toda la app.
 *
 * `reducedMotion="user"`: si el sistema pide menos movimiento, Motion salta
 * las animaciones de transform y opacidad (deja el estado final) sin que
 * cada componente tenga que preguntarlo. Es el equivalente, del lado de
 * Motion, del `menosMovimiento()` que consultan los efectos de GSAP y del
 * bloque `prefers-reduced-motion` de globals.css que corta las de CSS. Tres
 * capas, una sola preferencia.
 *
 * Es un archivo aparte y "use client" porque el layout raíz es Server
 * Component y MotionConfig usa contexto.
 */
export function ProveedorMovimiento({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
