"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { cambiarIdioma } from "@/lib/i18n/acciones";
import { useI18n } from "@/lib/i18n/cliente";
import { IDIOMAS, NOMBRE_IDIOMA, type Idioma } from "@/lib/i18n/idioma";
import { cn } from "@/lib/utils";

/**
 * El selector de idioma: «ES | EN», en la barra de marca y en el acceso.
 *
 * Es un grupo de dos botones (no un menú desplegable): son solo dos idiomas y
 * el que está elegido tiene que verse sin abrir nada. Cada botón dice su
 * idioma EN su idioma (`lang` + nombre completo en `aria-label`), para que quien
 * no lee el idioma actual igual encuentre el suyo.
 *
 * Elegir guarda la cookie (acción de servidor) y vuelve a pedir la pantalla:
 * la misma pantalla, en el otro idioma, con los filtros de la URL intactos.
 *
 * `sobre`: «navy» para la barra de marca (texto claro sobre el azul) y «claro»
 * para las pantallas de acceso (sigue el tema).
 */
export function SelectorIdioma({
  sobre = "navy",
  className,
}: {
  sobre?: "navy" | "claro";
  className?: string;
}) {
  const { idioma, t } = useI18n();
  const router = useRouter();
  const [pendiente, empezar] = React.useTransition();

  const elegir = (nuevo: Idioma) => {
    if (nuevo === idioma || pendiente) return;
    empezar(async () => {
      await cambiarIdioma(nuevo);
      router.refresh();
    });
  };

  return (
    <div
      role="group"
      aria-label={t("Idioma")}
      aria-busy={pendiente}
      className={cn(
        "inline-flex h-8 items-center rounded-lg p-0.5 pointer-coarse:h-11",
        sobre === "navy" ? "bg-white/10" : "bg-muted",
        pendiente && "opacity-70",
        className
      )}
    >
      {IDIOMAS.map((id) => {
        const activo = id === idioma;
        return (
          <button
            key={id}
            type="button"
            lang={id}
            aria-pressed={activo}
            aria-label={NOMBRE_IDIOMA[id]}
            title={NOMBRE_IDIOMA[id]}
            onClick={() => elegir(id)}
            className={cn(
              "h-7 min-w-8 rounded-md px-2 text-[11px] font-semibold tracking-wide outline-none transition-colors pointer-coarse:h-9 pointer-coarse:min-w-10",
              "focus-visible:ring-2",
              sobre === "navy"
                ? "focus-visible:ring-[var(--barra-foreground)]/60"
                : "focus-visible:ring-ring",
              activo
                ? sobre === "navy"
                  ? "bg-white text-[var(--barra)]"
                  : "bg-background text-foreground shadow-sm"
                : sobre === "navy"
                  ? "text-white/75 hover:text-white"
                  : "text-muted-foreground hover:text-foreground"
            )}
          >
            {id.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
