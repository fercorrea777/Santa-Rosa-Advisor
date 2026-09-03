"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { IconOjo, IconOjoTachado } from "@/components/icons";

/**
 * Campo de clave con ojito para mostrar y ocultar.
 *
 * POR QUE UN COMPONENTE Y NO EL OJITO PEGADO EN CADA FORMULARIO. Hay claves
 * en cuatro lugares (entrar, mi clave x3, crear usuario, resetear) y en dos
 * estilos distintos —el navy del login y el de la app—. Repetir el toggle
 * seis veces garantiza que alguno quede sin `type="button"` y mande el
 * formulario al hacer clic, que es el bug clasico de este control.
 *
 * `visiblePorDefecto` existe por un caso real: cuando un admin CREA o RESETEA
 * la clave de otra persona, la tiene que poder leer para pasarsela, asi que
 * ahi arranca visible. En cambio la clave PROPIA (entrar, mi clave) arranca
 * oculta, como corresponde. El ojito cubre los dos casos en cualquier
 * momento — si hay alguien atras, se tapa.
 *
 * El estado NO se comparte entre campos: en "Mi clave" hay tres, y ver la
 * actual no tiene por que revelar la nueva.
 */
export function CampoClave({
  className,
  claseBoton,
  visiblePorDefecto = false,
  ...props
}: Omit<React.ComponentProps<"input">, "type"> & {
  /** Clases del botón, para el login (que va sobre navy) */
  claseBoton?: string;
  visiblePorDefecto?: boolean;
}) {
  const [visible, setVisible] = React.useState(visiblePorDefecto);

  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? "text" : "password"}
        // pr-10: deja lugar al botón para que el texto no le pase por debajo.
        // font-mono cuando se ve: una clave generada se lee mal en
        // proporcional (l vs 1, O vs 0) y es justo cuando hay que dictarla.
        className={cn("pr-10", visible && "font-mono", className)}
      />
      <button
        type="button" // NO submit: sin esto, mostrar la clave manda el formulario
        onClick={() => setVisible((v) => !v)}
        // aria-pressed y no un aria-label que cambie: quien usa lector de
        // pantalla escucha "mostrar clave, activado" en vez de que el botón
        // le cambie de nombre abajo del dedo.
        aria-pressed={visible}
        aria-label="Mostrar la clave"
        title={visible ? "Ocultar la clave" : "Mostrar la clave"}
        // -translate-y-1/2 con top-1/2: centrado vertical sea cual sea el
        // alto del campo (el login usa uno y la app otro).
        className={cn(
          "absolute top-1/2 right-1.5 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
          claseBoton
        )}
      >
        {visible ? <IconOjoTachado size={16} /> : <IconOjo size={16} />}
      </button>
    </div>
  );
}
