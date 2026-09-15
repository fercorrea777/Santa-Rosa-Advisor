"use client";

import * as React from "react";
import { DURACION, gsap, menosMovimiento, ScrollTrigger, SUAVE } from "@/lib/movimiento";
import { cn } from "@/lib/utils";

/**
 * Qué entra en escena. Lo que la página muestra de primeras: el título y
 * su descripción, la barra de filtros, las tarjetas y los encabezados de
 * sección. `[data-revelar]` es el opt-in para lo que no es ninguna de esas
 * cosas pero vive al mismo nivel (una nota de dato, una barra pegajosa).
 *
 * Las filas de tabla y las cifras NO están acá: tienen su propia entrada
 * (ver ui/table.tsx y movimiento/cifra.tsx) que corre adentro de la tarjeta
 * cuando esta ya se ve.
 */
const OBJETIVOS = [
  ":scope > header > *",
  "[data-revelar]",
  '[data-slot="card"]',
  "[data-seccion] > :first-child",
].join(", ");

/** Los mismos, sin el `:scope` (que en `closest` no significa nada): para
 *  saber si un objetivo está adentro de otro. */
const CONTENEDORES = '[data-revelar], [data-slot="card"], [data-seccion] > :first-child';

/**
 * Raíz de cada pantalla: la columna con gap que antes cada page.tsx
 * escribía a mano, más la entrada en escena.
 *
 * CÓMO ENTRA UNA PÁGINA. Título, filtros y tarjetas aparecen en cascada
 * corta (0,6 s en total, tope fijo: doce bloques no tardan más que seis).
 * Lo que queda debajo del pliegue no se anima al montar —nadie lo vería—
 * sino cuando el scroll lo trae, con ScrollTrigger y una sola vez.
 *
 * POR QUÉ ES UN CLIENT COMPONENT Y NO template.tsx. El template monta
 * mientras loading.tsx todavía muestra el spinner: cuando el contenido
 * llega del servidor, el efecto ya corrió y no encontró nada. Este
 * componente monta CON el contenido, así que ve las tarjetas.
 *
 * POR QUÉ NO PARPADEA EN F5. Con SSR el HTML se pinta antes de que corra
 * JavaScript: si la animación arrancara de cero recién al hidratar, todo se
 * vería un instante y desaparecería para volver a entrar. Por eso la raíz
 * nace con `data-entrando` y globals.css deja los objetivos en opacidad 0
 * mientras el atributo está. El primer layout effect lo saca y desde ahí
 * mandan los estilos inline de GSAP — sin un frame pintado en el medio.
 * Si JavaScript nunca llega (o tarda), el mismo CSS suelta todo solo a los
 * 1,5 s: la página nunca puede quedar en blanco por una animación.
 *
 * Los cambios de filtro NO reinician nada: la URL cambia, el Server
 * Component vuelve a consultar y React actualiza en el lugar, y este
 * componente sigue montado. Lo que sí reacciona a un filtro son las cifras
 * (recuentan hasta el valor nuevo) y las filas (vuelven a entrar si la
 * lista cambió), cada una por su cuenta.
 */
export function Pagina({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useLayoutEffect(() => {
    const raiz = ref.current;
    if (!raiz) return;
    // Pase lo que pase de acá en adelante, la página deja de estar
    // "entrando": el CSS suelta y mandan los estilos inline.
    raiz.removeAttribute("data-entrando");
    if (menosMovimiento()) return;

    let respaldo = 0;
    const ctx = gsap.context(() => {
      const objetivos = Array.from(raiz.querySelectorAll<HTMLElement>(OBJETIVOS)).filter(
        // Una tarjeta adentro de otra entra con su contenedor: animarla
        // aparte la haría aparecer dos veces.
        (el) => !el.parentElement?.closest(CONTENEDORES)
      );
      if (!objetivos.length) return;

      const alto = window.innerHeight;
      const visibles: HTMLElement[] = [];
      const restantes: HTMLElement[] = [];
      for (const el of objetivos) {
        (el.getBoundingClientRect().top < alto ? visibles : restantes).push(el);
      }

      if (visibles.length) {
        const entrada = gsap.from(visibles, {
          autoAlpha: 0,
          y: 16,
          duration: DURACION.media,
          ease: SUAVE,
          // Escalonado con tope: la cascada entera dura lo mismo tenga
          // cinco bloques o quince.
          stagger: Math.min(0.06, 0.6 / visibles.length),
          clearProps: "opacity,visibility,transform",
        });
        // En una pestaña de fondo requestAnimationFrame no corre y la
        // cascada quedaría congelada en opacidad 0 hasta que alguien
        // vuelva. setTimeout sí corre (delayedCall de GSAP no: va por el
        // mismo ticker): a los 1,5 s todo está en su lugar.
        respaldo = window.setTimeout(() => entrada.progress(1), 1500);
      }

      if (restantes.length) {
        gsap.set(restantes, { autoAlpha: 0, y: 16 });
        ScrollTrigger.batch(restantes, {
          start: "top 94%",
          once: true,
          onEnter: (lote) =>
            gsap.to(lote, {
              autoAlpha: 1,
              y: 0,
              duration: DURACION.media,
              ease: SUAVE,
              stagger: 0.06,
              overwrite: true,
              clearProps: "opacity,visibility,transform",
            }),
        });
      }
    }, raiz);

    // Las posiciones de disparo se calculan al montar; un filtro que
    // cambia el alto de la página (o un gráfico que termina de dibujarse)
    // las deja viejas. Recalcular al cambiar el tamaño de la raíz cubre
    // los dos casos.
    let cuadro = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(cuadro);
      cuadro = requestAnimationFrame(() => ScrollTrigger.refresh());
    });
    ro.observe(raiz);

    return () => {
      ro.disconnect();
      cancelAnimationFrame(cuadro);
      window.clearTimeout(respaldo);
      ctx.revert();
    };
  }, []);

  return (
    <div ref={ref} data-entrando="" className={cn("flex flex-col gap-5", className)}>
      {children}
    </div>
  );
}
