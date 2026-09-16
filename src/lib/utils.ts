import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { SyntheticEvent } from "react"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Puente entre el estado VISUAL de `:user-invalid` (CSS, ver globals.css) y
 * el estado PROGRAMÁTICO que necesita un lector de pantalla (`aria-invalid`).
 * Sin esto, alguien con lector de pantalla nunca se entera de que un campo
 * quedó marcado en rojo: el borde no se anuncia, `aria-invalid` sí.
 *
 * Se llama en `onBlur` y `onInput`: en `onBlur` porque ahí el navegador
 * recién actualiza la bandera "interactuado" que activa `:user-invalid`; en
 * `onInput` para que, si la persona vuelve a corregir el campo, el error se
 * retire al toque y no recién al salir de nuevo (guía modern-web-guidance
 * "accessible-error-announcement"). Sirve para cualquier input con
 * `required`/`pattern`/`minLength` — clave, correo, nombre — no solo correo.
 */
export function sincronizarAriaInvalid(e: SyntheticEvent<HTMLInputElement>) {
  const el = e.currentTarget
  el.setAttribute("aria-invalid", el.matches(":user-invalid") ? "true" : "false")
}
