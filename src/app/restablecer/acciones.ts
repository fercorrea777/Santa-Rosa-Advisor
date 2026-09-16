"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { NOMBRE_COOKIE } from "@/lib/auth/sesion";
import { ipDe } from "@/lib/auth/freno";
import { olvidarVigencia } from "@/lib/auth/vigencia";
import {
  problemaConLaClave, registrarEvento, restablecerConToken, usuarioDeRecuperacion,
} from "@/lib/auth/usuarios";

export interface EstadoRestablecer {
  error?: string;
}

/**
 * Pone la clave nueva con el enlace del correo. El token se consume en la
 * misma transacción que guarda la clave: usado una vez, no sirve más. Las
 * sesiones abiertas de esa cuenta se cortan (sube la versión) y se manda a
 * entrar con la clave nueva, sin dejar sesión abierta desde acá: quien
 * tiene el enlace demuestra que tiene el correo, no que es quien está
 * sentado frente a esta pantalla.
 */
export async function restablecerClave(
  _prev: EstadoRestablecer | null,
  form: FormData
): Promise<EstadoRestablecer> {
  const token = String(form.get("token") ?? "");
  const nueva = String(form.get("nueva") ?? "");
  const repetida = String(form.get("repetida") ?? "");
  const ip = ipDe(await headers());

  if (nueva !== repetida) return { error: "Las dos claves no coinciden." };

  // Se busca al dueño ANTES de consumir el token, para validar la clave
  // contra su correo; si el token ya no vale, se dice y no se gasta nada.
  const persona = await usuarioDeRecuperacion(token);
  if (!persona) {
    return {
      error:
        "Este enlace ya no sirve: venció, ya se usó o no es válido. " +
        "Pedí uno nuevo desde «Olvidé mi clave».",
    };
  }
  const problema = problemaConLaClave(nueva, persona.usuario);
  if (problema) return { error: problema };

  const listo = await restablecerConToken(token, nueva);
  if (!listo) {
    return { error: "Este enlace ya no sirve. Pedí uno nuevo desde «Olvidé mi clave»." };
  }
  olvidarVigencia(listo.id);
  void registrarEvento("clave_restablecida", { correo: listo.usuario, usuarioId: listo.id, ip });

  // Si había una sesión en este navegador, se borra: la versión ya no cierra.
  (await cookies()).delete(NOMBRE_COOKIE);
  redirect("/entrar?aviso=clave-lista");
}
