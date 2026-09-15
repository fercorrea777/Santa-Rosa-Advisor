"use client";

import * as React from "react";
import { DURACION, gsap, menosMovimiento } from "@/lib/movimiento";

/**
 * Una cifra que cuenta hasta su valor.
 *
 * Recibe el texto YA FORMATEADO ("34.472", "13.0%", "+4,2 %", "1.14") y lo
 * descompone en signo, número y sufijo; anima el número y lo vuelve a
 * escribir con los mismos separadores. Así la página sigue formateando
 * como siempre (formatUnidades, formatPct) y este componente no necesita
 * saber qué es lo que muestra. Lo que no es un número ("—", "TOYOTA",
 * "SUV") se muestra tal cual, sin animar.
 *
 * ESCRIBE EN EL DOM, NO EN EL ESTADO. Un contador por estado de React
 * (setValor en cada frame) re-renderiza el árbol sesenta veces por segundo
 * por cada cifra; con diez KPIs en pantalla es un costo tonto. GSAP tuerce
 * un objeto y en cada frame escribe `textContent` del nodo, que es lo único
 * que cambia. React no se entera y no le hace falta: cuando `texto` cambia
 * de verdad, React escribe el texto nuevo y el efecto arranca a contar
 * desde el número que había en pantalla, no desde cero (retarget, como
 * una transición CSS interrumpida).
 *
 * EL VALOR REAL SIEMPRE GANA. `onComplete` escribe `texto` literal (no el
 * número reformateado) y la limpieza también, así que ninguna cifra puede
 * quedar a mitad de camino ni con un redondeo distinto al del servidor.
 * Con prefers-reduced-motion no hay conteo: se ve el número final y listo.
 */
export function Cifra({
  texto,
  como = "span",
  className,
}: {
  texto: string;
  /** Etiqueta que se dibuja. `p` para el número grande de un KPI, `span`
   *  para una cifra en línea. */
  como?: "p" | "span";
  className?: string;
}) {
  const ref = React.useRef<HTMLElement>(null);
  /** Último número que quedó escrito, para que el conteo siguiente arranque
   *  de ahí. null = lo que hay en pantalla no es un número. */
  const anterior = React.useRef<number | null>(null);

  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const partes = descomponer(texto);
    if (!partes || menosMovimiento()) {
      anterior.current = partes?.numero ?? null;
      return;
    }
    const desde = anterior.current ?? 0;
    if (desde === partes.numero) return;

    const obj = { n: desde };
    const escribir = () => {
      el.textContent = partes.prefijo + partes.formatear(obj.n) + partes.sufijo;
    };
    escribir();
    const tween = gsap.to(obj, {
      n: partes.numero,
      // Desde cero (primera vez) cuenta más largo; el retarget por un
      // filtro es más corto, porque el ojo ya está en el número.
      duration: anterior.current === null ? DURACION.larga : DURACION.media,
      ease: "power2.out",
      onUpdate: escribir,
      onComplete: () => {
        el.textContent = texto;
        anterior.current = partes.numero;
      },
    });
    // Red de seguridad: GSAP anima con requestAnimationFrame, que en una
    // pestaña de fondo no corre. El timer sí corre, y fuerza el final: una
    // cifra a medio contar no es un dato, y este tablero no muestra números
    // que no sean el de verdad. (Es el mismo principio del hook anterior.)
    const respaldo = window.setTimeout(() => tween.progress(1), tween.duration() * 1000 + 500);
    return () => {
      // Si `texto` cambia a mitad del conteo, el próximo arranca desde el
      // número que se ve ahora, no desde el que nunca llegó.
      window.clearTimeout(respaldo);
      anterior.current = obj.n;
      tween.kill();
      el.textContent = texto;
    };
  }, [texto]);

  // createElement y no <Etiqueta>: con la etiqueta como unión ("p" |
  // "span") JSX no acepta un ref de HTMLElement genérico.
  return React.createElement(como, { ref, className }, texto);
}

interface Partes {
  prefijo: string;
  sufijo: string;
  numero: number;
  formatear: (n: number) => string;
}

// Signo opcional, el número con sus separadores, y un sufijo corto (%, pp,
// u.). Cualquier otra cosa alrededor —letras, meses, monedas— y no es una
// cifra que valga la pena contar.
const PATRON = /^([+\-−]?\s?)(\d[\d.,]*)(\s?(?:%|pp|u\.?)?)$/;

/**
 * "34.472" -> 34472 con miles "." · "13.0%" -> 13.0 con un decimal ·
 * "1.14" -> 1.14 con dos decimales · "1.234,5" -> miles "." y decimal ",".
 *
 * La ambigüedad es el punto: es miles en las unidades (es-PY) y decimal en
 * los porcentajes (toFixed). Regla: si hay coma, la coma es el decimal. Si
 * no, el último punto es decimal salvo que TODOS los grupos que siguen a un
 * punto tengan tres dígitos, que es la firma de los miles.
 */
export function descomponer(texto: string): Partes | null {
  const m = PATRON.exec(texto.trim());
  if (!m) return null;
  const [, prefijo, cuerpo, sufijo] = m;

  let miles = "";
  let decimal = "";
  let decimales = 0;
  let entero = cuerpo;
  let fraccion = "";

  if (cuerpo.includes(",")) {
    decimal = ",";
    miles = cuerpo.includes(".") ? "." : "";
    [entero, fraccion] = cuerpo.split(",");
  } else if (cuerpo.includes(".")) {
    const grupos = cuerpo.split(".");
    const sonMiles = grupos.slice(1).every((g) => g.length === 3) && !sufijo.includes("%");
    if (sonMiles) {
      miles = ".";
    } else {
      decimal = ".";
      fraccion = grupos.pop() ?? "";
      entero = grupos.join(".");
      miles = grupos.length > 1 ? "." : "";
    }
  }
  decimales = fraccion.length;
  // El signo queda en el prefijo y se escribe tal cual: lo que cuenta es
  // siempre el valor absoluto.
  const numero = Number(
    (miles ? entero.split(miles).join("") : entero) + (fraccion ? "." + fraccion : "")
  );
  if (!Number.isFinite(numero)) return null;

  const formatear = (n: number) => {
    const fijo = Math.abs(n).toFixed(decimales);
    const [ent, dec] = fijo.split(".");
    const conMiles = miles ? ent.replace(/\B(?=(\d{3})+(?!\d))/g, miles) : ent;
    return dec !== undefined ? conMiles + decimal + dec : conMiles;
  };

  return { prefijo, sufijo, numero, formatear };
}
