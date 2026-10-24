"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import { enviarEnlaceClave, hayCorreo } from "@/lib/auth/correo";
import { anotarFallo, bloqueadoPor, ipDe } from "@/lib/auth/freno";
import { getI18n } from "@/lib/i18n/servidor";
import {
  crearRecuperacion, getUsuarioPorCorreo, MINUTOS_RECUPERACION, normalizarUsuario,
  problemaConElUsuario, registrarEvento,
} from "@/lib/auth/usuarios";

export interface EstadoOlvide {
  error?: string;
  ok?: string;
}

/** Tres pedidos por IP cada 15 minutos, y uno por casilla cada 5: nadie
 *  puede inundar el correo de alguien ni usar esto para probar correos. */
const FRENO_IP = { max: 3, esperaMs: 15 * 60_000 };
const FRENO_CORREO = { max: 1, esperaMs: 5 * 60_000 };

/**
 * "Olvidé mi clave": manda por correo un enlace de un solo uso para poner
 * una clave nueva.
 *
 * RESPONDE SIEMPRE LO MISMO, exista o no la cuenta, y el correo sale
 * DESPUÉS de responder (`after`): así ni el texto ni el tiempo de respuesta
 * le dicen a nadie qué correos tienen cuenta. Si el envío falla queda en el
 * log y en la auditoría, no en la pantalla.
 */
export async function pedirRecuperacion(
  _prev: EstadoOlvide | null,
  form: FormData
): Promise<EstadoOlvide> {
  // Todo lo que vuelve a la pantalla (y el correo) sale en el idioma de quien lo pide.
  const i18n = await getI18n();
  const { t } = i18n;
  // Siempre la misma respuesta, exista o no la cuenta (ver arriba).
  const respuesta = t(
    "Si ese correo tiene cuenta, en un minuto le llega un enlace para poner " +
    "una clave nueva. Vale una hora. Revisá también el spam."
  );
  const h = await headers();
  const ip = ipDe(h);
  const correo = normalizarUsuario(String(form.get("correo") ?? ""));

  const problema = problemaConElUsuario(correo, t);
  if (problema) return { error: problema };

  const esperaIp = bloqueadoPor(`olvide-ip:${ip}`);
  if (esperaIp) {
    return { error: t("Demasiados pedidos. Probá de nuevo en {minutos} minutos.", { minutos: Math.ceil(esperaIp / 60) }) };
  }
  // Por casilla se frena en silencio: decir "ya pediste hace un rato" para
  // un correo ajeno sería confirmar que existe.
  const esperaCorreo = bloqueadoPor(`olvide-correo:${correo}`);
  anotarFallo(`olvide-ip:${ip}`, FRENO_IP);
  anotarFallo(`olvide-correo:${correo}`, FRENO_CORREO);
  // El detalle de la auditoría se guarda en castellano (es un dato de la base) y se traduce al mostrarlo.
  void registrarEvento("recuperacion_pedida", { correo, ip, detalle: esperaCorreo ? "frenado por casilla" : null }); // i18n-ignore
  if (esperaCorreo) return { ok: respuesta };

  if (!hayCorreo()) {
    // Esto sí se dice: es un problema de configuración nuestro, no
    // información sobre la cuenta.
    return {
      error: t(
        "El envío de correos no está configurado en el servidor. Pedile a un " +
        "administrador que te restablezca la clave."
      ),
    };
  }

  after(async () => {
    try {
      const persona = await getUsuarioPorCorreo(correo);
      if (!persona || !persona.activo) return;
      const { token } = await crearRecuperacion(persona.id, "olvido", ip);
      await enviarEnlaceClave({
        para: persona.usuario,
        nombre: persona.nombre,
        token,
        tipo: "olvido",
        minutosValido: MINUTOS_RECUPERACION,
        i18n,
      });
      void registrarEvento("recuperacion_enviada", { correo, usuarioId: persona.id, ip });
    } catch (e) {
      console.error("Recuperación: no se pudo enviar el correo:", (e as Error).message);
      void registrarEvento("recuperacion_fallo_envio", { correo, ip, detalle: (e as Error).message });
    }
  });

  return { ok: respuesta };
}
