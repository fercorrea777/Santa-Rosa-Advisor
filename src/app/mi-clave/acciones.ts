"use server";

import { cookies, headers } from "next/headers";
import { crearTokenUsuario, leerSesion, NOMBRE_COOKIE, opcionesCookie } from "@/lib/auth/sesion";
import { esHttps, ipDe } from "@/lib/auth/freno";
import { olvidarVigencia } from "@/lib/auth/vigencia";
import {
  cambiarClave, getUsuario, problemaConLaClave, registrarEvento, verificarCredenciales,
} from "@/lib/auth/usuarios";

export interface EstadoMiClave {
  error?: string;
  ok?: string;
}

/**
 * Cambiar la propia clave.
 *
 * POR QUE HACE FALTA. Cuando un admin da de alta a alguien le pone una clave
 * inicial que ese admin CONOCE, y la fila queda marcada "clave puesta por un
 * admin". Sin esta pantalla esa marca no se puede sacar nunca y la clave que
 * el admin escribio sigue siendo la que usa esa persona para siempre.
 *
 * PIDE LA CLAVE ACTUAL. No es tramite de mas: sin eso, cualquiera que agarre
 * una sesion abierta —una notebook sin bloquear— se queda con la cuenta
 * cambiandole la clave a su dueño.
 */
export async function cambiarMiClave(
  _prev: EstadoMiClave | null,
  form: FormData
): Promise<EstadoMiClave> {
  const claveEntorno = process.env.ADVISOR_CLAVE;
  if (!claveEntorno) {
    return { error: "El tablero no tiene claves configuradas." };
  }

  const store = await cookies();
  const sesion = leerSesion(store.get(NOMBRE_COOKIE)?.value, claveEntorno);
  if (!sesion) return { error: "Sesión vencida. Volvé a entrar." };
  if (sesion.tipo !== "usuario") {
    return {
      error:
        "Entraste con la clave general del equipo, que no es de nadie en " +
        "particular: esa se cambia en Coolify. Entrá con tu usuario para " +
        "cambiar tu clave.",
    };
  }

  const actual = String(form.get("actual") ?? "");
  const nueva = String(form.get("nueva") ?? "");
  const repetida = String(form.get("repetida") ?? "");

  if (nueva !== repetida) return { error: "Las dos claves nuevas no coinciden." };
  if (nueva === actual) return { error: "La clave nueva es igual a la actual." };

  const persona = await getUsuario(sesion.id);
  if (!persona) return { error: "Tu usuario ya no existe." };
  const problema = problemaConLaClave(nueva, persona.usuario);
  if (problema) return { error: problema };

  if (!(await verificarCredenciales(persona.usuario, actual))) {
    return { error: "La clave actual no es correcta." };
  }

  // Cambiar la clave sube la versión de sesión (cierra las demás sesiones
  // de esta cuenta: una notebook olvidada, un teléfono prestado). La de
  // ESTE navegador se reemite con la versión nueva para no echar a quien
  // acaba de cambiarla.
  const version = await cambiarClave(persona.id, nueva, true);
  olvidarVigencia(persona.id);
  const h = await headers();
  store.set(
    NOMBRE_COOKIE,
    crearTokenUsuario(claveEntorno, { id: persona.id, rol: persona.rol, version }),
    opcionesCookie(esHttps(h))
  );
  void registrarEvento("clave_cambiada", { correo: persona.usuario, usuarioId: persona.id, ip: ipDe(h) });
  return {
    ok: "Listo, tu clave quedó cambiada. Esta sesión sigue abierta; " +
      "las que tuvieras abiertas en otros dispositivos se cerraron.",
  };
}
