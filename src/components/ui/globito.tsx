"use client";

import * as React from "react";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import { cn } from "@/lib/utils";

/**
 * El globito: una esfera con cara que acompaña lo que hace la persona.
 *
 * Es la mascota del tablero (pedido de Croman, 19/10/2026, sobre la pantalla de
 * acceso de una referencia): vive arriba del formulario de entrada y como cara
 * del Copiloto. Cada movimiento dice algo del estado, no decora:
 *
 *   reposo    sonríe, parpadea de vez en cuando y sigue el puntero con la mirada.
 *   atento    abre los ojos y mira hacia el campo que se está llenando.
 *   privado   cierra los ojos: se está escribiendo una clave y no mira.
 *   pensando  mira hacia arriba mientras algo se procesa (entrar, consultar).
 *   feliz     sonrisa grande y un salto: salió bien.
 *   error     se sacude y frunce la boca: algo no salió.
 *
 * DECORATIVO PARA LA ACCESIBILIDAD: `aria-hidden`. Nada de lo que expresa es
 * información que no esté también en texto (el error se anuncia con su
 * `role="alert"`, la espera con el botón deshabilitado), así que quitarlo del
 * árbol no le saca nada a quien usa un lector de pantalla.
 *
 * MOVIMIENTO. Con `prefers-reduced-motion` no flota, no parpadea, no sigue el
 * puntero ni salta; el gesto de la cara sí cambia, porque eso es información.
 * La flotación es CSS (`.globito-flota`, globals.css), que la regla global de
 * movimiento reducido ya apaga; la mirada y el parpadeo son MotionValues, que
 * no vuelven a renderizar React en cada cuadro.
 */

export type EstadoGlobito = "reposo" | "atento" | "privado" | "pensando" | "feliz" | "error";

/** La mirada, normalizada: x e y entre -1 y 1 (derecha / abajo son positivos). */
export interface MiradaGlobito {
  x: number;
  y: number;
}

/** Todas las bocas comparten estructura (M x y Q cx cy x y): así Motion las
 *  interpola de una a otra en vez de cambiarlas de golpe. */
const BOCA: Record<EstadoGlobito, string> = {
  reposo: "M 39 61 Q 50 69 61 61",
  atento: "M 37 60 Q 50 72 63 60",
  privado: "M 42 63 Q 50 67 58 63",
  pensando: "M 43 64 Q 50 64 57 64",
  feliz: "M 35 57 Q 50 81 65 57",
  error: "M 39 68 Q 50 60 61 68",
};

/** Ojos por estado: alto de la elipse, altura del centro y giro (los ojos
 *  caen hacia afuera cuando algo salió mal, que es lo que da el gesto de
 *  preocupación). */
const OJOS: Record<EstadoGlobito, { ry: number; cy: number; giro: number }> = {
  reposo: { ry: 8.4, cy: 46, giro: 0 },
  atento: { ry: 9.4, cy: 45.5, giro: 0 },
  privado: { ry: 1.2, cy: 48, giro: 0 },
  pensando: { ry: 7.6, cy: 45, giro: 0 },
  feliz: { ry: 4.6, cy: 47, giro: 0 },
  error: { ry: 6.8, cy: 47.5, giro: 10 },
};

/** Cuánto se mueve la cara con la mirada, en unidades del viewBox (100). */
const ALCANCE_X = 5.5;
const ALCANCE_Y = 4.5;

export function Globito({
  estado = "reposo",
  tamano = 96,
  mirada = null,
  seguirPuntero = true,
  flotar = true,
  className,
}: {
  estado?: EstadoGlobito;
  /** Lado en píxeles. */
  tamano?: number;
  /** Si viene, manda sobre el puntero: se usa para mirar un campo. */
  mirada?: MiradaGlobito | null;
  /** Seguir el puntero del mouse con la mirada. */
  seguirPuntero?: boolean;
  flotar?: boolean;
  className?: string;
}) {
  const id = React.useId().replace(/:/g, "");
  const raiz = React.useRef<HTMLDivElement>(null);
  const reducido = !!useReducedMotion();

  // La mirada: dos valores animados con resorte. Cambian cada cuadro sin que
  // React vuelva a dibujar nada.
  const gx = useMotionValue(0);
  const gy = useMotionValue(0);
  const sx = useSpring(gx, { stiffness: 170, damping: 17, mass: 0.7 });
  const sy = useSpring(gy, { stiffness: 170, damping: 17, mass: 0.7 });
  // Los ojos se adelantan un poco a la cara: da relieve.
  const ojosX = useTransform(sx, (v) => v * 0.45);
  const ojosY = useTransform(sy, (v) => v * 0.45);
  const parpadeo = useMotionValue(1);

  // Mirar al puntero (salvo que alguien le diga adónde mirar).
  React.useEffect(() => {
    if (reducido || !seguirPuntero || mirada) return;
    const alMover = (e: PointerEvent) => {
      const caja = raiz.current?.getBoundingClientRect();
      if (!caja) return;
      const dx = e.clientX - (caja.left + caja.width / 2);
      const dy = e.clientY - (caja.top + caja.height / 2);
      const d = Math.hypot(dx, dy) || 1;
      // De cerca mira directo al puntero; de lejos se acomoda hacia su lado.
      const fuerza = Math.min(1, d / 320);
      gx.set((dx / d) * fuerza * ALCANCE_X);
      gy.set((dy / d) * fuerza * ALCANCE_Y);
    };
    const alSalir = () => {
      gx.set(0);
      gy.set(0);
    };
    window.addEventListener("pointermove", alMover, { passive: true });
    document.documentElement.addEventListener("pointerleave", alSalir);
    return () => {
      window.removeEventListener("pointermove", alMover);
      document.documentElement.removeEventListener("pointerleave", alSalir);
    };
  }, [reducido, seguirPuntero, mirada, gx, gy]);

  // Mirar adonde le dicen.
  React.useEffect(() => {
    if (reducido || !mirada) return;
    gx.set(Math.max(-1, Math.min(1, mirada.x)) * ALCANCE_X);
    gy.set(Math.max(-1, Math.min(1, mirada.y)) * ALCANCE_Y);
  }, [reducido, mirada, gx, gy]);

  // Parpadear cada tanto, a intervalos irregulares: uno parejo parece un reloj.
  React.useEffect(() => {
    if (reducido || estado === "privado" || estado === "feliz") return;
    let t: ReturnType<typeof setTimeout>;
    const programar = () => {
      t = setTimeout(() => {
        animate(parpadeo, [1, 0.1, 1], { duration: 0.18 });
        programar();
      }, 2600 + Math.random() * 3600);
    };
    programar();
    return () => clearTimeout(t);
  }, [reducido, estado, parpadeo]);

  const ojos = OJOS[estado];
  const conBrillo = tamano >= 48;

  // El salto de la alegría y la sacudida del error. Con movimiento reducido no hay.
  const reaccion = reducido
    ? undefined
    : estado === "error"
      ? { x: [0, -9, 9, -6, 6, -3, 0], y: 0 }
      : estado === "feliz"
        ? { x: 0, y: [0, -14, 0, -5, 0] }
        : { x: 0, y: 0 };

  return (
    <div
      ref={raiz}
      aria-hidden="true"
      className={cn("pointer-events-none relative inline-block select-none", className)}
      style={{ width: tamano, height: tamano }}
    >
      {flotar && <span className="globito-sombra absolute left-1/2 top-[97%] h-[9%] w-[64%]" />}
      <div className={cn("size-full", flotar && "globito-flota")}>
        <motion.div
          className="size-full"
          animate={reaccion}
          transition={{ duration: estado === "error" ? 0.55 : 0.7, ease: "easeOut" }}
        >
          <svg viewBox="0 0 100 100" width={tamano} height={tamano} className="overflow-visible">
            <defs>
              <radialGradient id={`${id}-cuerpo`} cx="0.34" cy="0.27" r="0.9">
                <stop offset="0" stopColor="#c4f8ff" />
                <stop offset="0.22" stopColor="#52deef" />
                <stop offset="0.48" stopColor="#0a9fd6" />
                <stop offset="0.78" stopColor="#2a5cc0" />
                <stop offset="1" stopColor="#27226a" />
              </radialGradient>
              {/* Oscurece el borde de abajo a la derecha: es lo que le da volumen. */}
              <radialGradient id={`${id}-volumen`} cx="0.38" cy="0.32" r="0.78">
                <stop offset="0.55" stopColor="#120c46" stopOpacity="0" />
                <stop offset="1" stopColor="#120c46" stopOpacity="0.5" />
              </radialGradient>
              <linearGradient id={`${id}-brillo`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#fff" stopOpacity="0.92" />
                <stop offset="1" stopColor="#fff" stopOpacity="0" />
              </linearGradient>
              <linearGradient id={`${id}-aro`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#fff" stopOpacity="0.7" />
                <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
                <stop offset="1" stopColor="#7be9ff" stopOpacity="0.35" />
              </linearGradient>
              {conBrillo && (
                <filter id={`${id}-resplandor`} x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="1.1" result="b" />
                  <feMerge>
                    <feMergeNode in="b" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              )}
            </defs>

            <circle cx="50" cy="50" r="46" fill={`url(#${id}-cuerpo)`} />
            <circle cx="50" cy="50" r="46" fill={`url(#${id}-volumen)`} />
            <circle cx="50" cy="50" r="45.4" fill="none" stroke={`url(#${id}-aro)`} strokeWidth="1.2" />
            {/* Brillo de arriba a la izquierda y luz rebotada de abajo. */}
            <ellipse cx="33" cy="26" rx="17" ry="8.5" transform="rotate(-32 33 26)" fill={`url(#${id}-brillo)`} />
            <ellipse cx="71" cy="77" rx="10" ry="4.5" transform="rotate(-32 71 77)" fill="#9cf1ff" opacity="0.26" />

            <motion.g style={{ x: sx, y: sy }} filter={conBrillo ? `url(#${id}-resplandor)` : undefined}>
              <motion.g style={{ x: ojosX, y: ojosY }}>
                {[37, 63].map((cx, i) => (
                  <motion.ellipse
                    key={cx}
                    cx={cx}
                    rx={5.4}
                    fill="#fff"
                    initial={false}
                    animate={{ cy: ojos.cy, ry: ojos.ry, rotate: i === 0 ? ojos.giro : -ojos.giro }}
                    style={{ scaleY: parpadeo, transformBox: "fill-box", transformOrigin: "center" }}
                    transition={{ type: "spring", stiffness: 380, damping: 26 }}
                  />
                ))}
              </motion.g>
              <motion.path
                fill="none"
                stroke="#fff"
                strokeWidth={4.6}
                strokeLinecap="round"
                initial={false}
                animate={{ d: BOCA[estado] }}
                transition={{ duration: 0.28, ease: "easeOut" }}
              />
              {/* Mejillas: solo se sonrojan cuando está contento. */}
              <motion.g initial={false} animate={{ opacity: estado === "feliz" ? 0.5 : 0 }} transition={{ duration: 0.3 }}>
                <ellipse cx="27" cy="62" rx="5" ry="3" fill="#ff8fc0" />
                <ellipse cx="73" cy="62" rx="5" ry="3" fill="#ff8fc0" />
              </motion.g>
            </motion.g>
          </svg>
        </motion.div>
      </div>
    </div>
  );
}
