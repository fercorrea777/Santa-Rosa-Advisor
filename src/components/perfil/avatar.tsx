"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { iniciales, tonoDe, type TonoAvatar } from "@/lib/iniciales";

/**
 * La cara de una persona: su foto, o sus iniciales sobre un tono estable.
 *
 * Es decorativa a propósito (`aria-hidden`): al lado siempre va el nombre en
 * texto, o el enlace que la contiene lleva su propio `aria-label`. Repetir el
 * nombre en un `alt` haría que el lector de pantalla lo diga dos veces.
 *
 * Si la foto no carga (borrada, red caída) se vuelve a las iniciales en vez de
 * dejar el ícono de imagen rota: `urlFallida` recuerda cuál falló, así una
 * foto nueva (otra URL) se vuelve a intentar sola.
 */

const TAMANOS = {
  xs: "size-6 text-[10px]",
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-16 text-xl",
  xl: "size-28 text-4xl",
} as const;
export type TamanoAvatar = keyof typeof TAMANOS;

/** Sobre el lienzo claro u oscuro de la app. */
const TONOS: Record<TonoAvatar, string> = {
  acento: "bg-primary/15 text-primary",
  violeta: "bg-[var(--chip-violet)] text-[var(--chip-violet-fg)]",
  menta: "bg-[var(--chip-mint)] text-[var(--chip-mint-fg)]",
  ambar: "bg-[var(--chip-amber)] text-[var(--chip-amber-fg)]",
  rosa: "bg-[var(--chip-pink)] text-[var(--chip-pink-fg)]",
};

/** Sobre el navy de la marca (menú y barra de arriba): el acento claro se ve,
 *  el oscuro del tema claro se perdía contra el fondo. */
const TONOS_NAVY: Record<TonoAvatar, string> = {
  ...TONOS,
  acento: "bg-[oklch(0.78_0.135_205/0.24)] text-[oklch(0.9_0.08_205)]",
};

export function Avatar({
  nombre,
  fotoUrl,
  tamano = "md",
  sobre = "claro",
  className,
}: {
  nombre: string;
  fotoUrl?: string | null;
  tamano?: TamanoAvatar;
  sobre?: "claro" | "navy";
  className?: string;
}) {
  const [urlFallida, setUrlFallida] = React.useState<string | null>(null);
  const hayFoto = !!fotoUrl && fotoUrl !== urlFallida;
  const tonos = sobre === "navy" ? TONOS_NAVY : TONOS;

  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-semibold leading-none",
        sobre === "navy" ? "ring-1 ring-white/25" : "ring-1 ring-border",
        TAMANOS[tamano],
        !hayFoto && tonos[tonoDe(nombre)],
        className
      )}
    >
      {hayFoto ? (
        // eslint-disable-next-line @next/next/no-img-element -- una foto de perfil de 384 px que ya viene recortada y comprimida: next/image no aporta nada acá y complica la caché.
        <img
          src={fotoUrl}
          alt=""
          draggable={false}
          decoding="async"
          className="size-full object-cover"
          onError={() => setUrlFallida(fotoUrl)}
        />
      ) : (
        iniciales(nombre)
      )}
    </span>
  );
}
