"use server";

import { cookies } from "next/headers";
import { COOKIE_IDIOMA, idiomaDe } from "./idioma";

/**
 * Guarda el idioma elegido en la cookie (un año). La pantalla se vuelve a
 * dibujar sola con el idioma nuevo: Next re-renderiza la ruta cuando una acción
 * escribe una cookie.
 *
 * Lo que llega se pasa por `idiomaDe`: cualquier cosa que no sea «es» o «en»
 * queda en castellano, así que no se puede guardar un valor raro.
 */
export async function cambiarIdioma(idioma: string): Promise<void> {
  const almacen = await cookies();
  almacen.set(COOKIE_IDIOMA, idiomaDe(idioma), {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}
