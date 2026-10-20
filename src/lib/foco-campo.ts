import * as React from "react";

/**
 * Qué campo tiene el foco, leído del documento.
 *
 * Devuelve el valor de `data-campo` del ancestro marcado más cercano al
 * elemento enfocado (o null si el foco está en otra parte). Lo usa el globito
 * para mirar el campo que se está llenando.
 *
 * Se lee del documento y no de `onFocus` porque un campo con `autoFocus`
 * llega enfocado desde el HTML, antes de que React hidrate: ese evento no lo
 * ve nadie y el estado quedaría desfasado hasta el próximo cambio de foco.
 * `useSyncExternalStore` sirve null al hidratar y se corrige solo a lo que diga
 * el documento.
 */
function leer(): string | null {
  return document.activeElement?.closest("[data-campo]")?.getAttribute("data-campo") ?? null;
}

function suscribir(avisar: () => void) {
  const alSalir = (e: FocusEvent) => {
    // Con destino conocido el `focusin` siguiente ya avisa: avisar acá haría
    // pasar la cara por «reposo» entre un campo y el otro.
    if (!e.relatedTarget) avisar();
  };
  document.addEventListener("focusin", avisar);
  document.addEventListener("focusout", alSalir);
  return () => {
    document.removeEventListener("focusin", avisar);
    document.removeEventListener("focusout", alSalir);
  };
}

const sinFoco = (): string | null => null;

export function useCampoConFoco(): string | null {
  return React.useSyncExternalStore(suscribir, leer, sinFoco);
}
