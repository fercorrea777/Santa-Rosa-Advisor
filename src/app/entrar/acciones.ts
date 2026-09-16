"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { timingSafeEqual } from "node:crypto";
import {
  crearToken, crearTokenUsuario, NOMBRE_COOKIE, opcionesCookie,
} from "@/lib/auth/sesion";
import {
  normalizarUsuario, problemaConElUsuario, registrarAcceso, registrarEvento,
  verificarCredenciales,
} from "@/lib/auth/usuarios";
import { anotarFallo, bloqueadoPor, esHttps, ipDe, limpiarFallos } from "@/lib/auth/freno";

export interface EstadoLogin {
  error: string;
}

/** Cinco fallos por IP → un minuto. Ocho fallos sobre la misma cuenta desde
 *  cualquier IP → quince minutos: quien rota de IP no puede seguir con la
 *  misma cuenta. */
const FRENO_IP = { max: 5, esperaMs: 60_000 };
const FRENO_CUENTA = { max: 8, esperaMs: 15 * 60_000 };

function igual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** Solo rutas internas: `destino` viene de la URL y sin este filtro sería
 *  un redirect abierto — un enlace a nuestro dominio que termina en otro. */
function destinoSeguro(d: string | null): string {
  if (!d || !d.startsWith("/") || d.startsWith("//") || d.startsWith("/entrar")) return "/mercado";
  return d;
}

export async function entrar(
  _prev: EstadoLogin | null,
  form: FormData
): Promise<EstadoLogin> {
  const clave = process.env.ADVISOR_CLAVE;
  if (!clave) {
    return { error: "El tablero no tiene clave configurada; no hace falta entrar." };
  }

  const h = await headers();
  const ip = ipDe(h);
  const espera = bloqueadoPor(`ip:${ip}`);
  if (espera) {
    void registrarEvento("login_bloqueado", { ip, detalle: `por IP, ${espera}s` });
    return { error: `Demasiados intentos. Probá de nuevo en ${espera} segundos.` };
  }

  const enviada = String(form.get("clave") ?? "");
  const modo = String(form.get("modo") ?? "");
  const correo = normalizarUsuario(String(form.get("usuario") ?? ""));

  // DOS CAMINOS. Con correo se busca la cuenta. Sin correo y en modo
  // emergencia (/entrar?modo=emergencia, no está enlazado) se compara
  // contra la clave general del entorno: sirve aunque Postgres esté caído y
  // aunque no quede ningún admin. Ver lib/auth/usuarios.ts.
  let token: string | null = null;
  let emergencia = false;
  if (modo === "emergencia") {
    if (igual(enviada, clave)) {
      token = crearToken(clave);
      emergencia = true;
    }
  } else {
    // El correo se valida antes de tocar la base: un correo de otro dominio
    // no puede ser de nadie, y decirlo no revela nada.
    const problema = problemaConElUsuario(correo);
    if (problema) return { error: problema };
    const esperaCuenta = bloqueadoPor(`cuenta:${correo}`);
    if (esperaCuenta) {
      void registrarEvento("login_bloqueado", { correo, ip, detalle: `por cuenta, ${esperaCuenta}s` });
      return { error: `Demasiados intentos con esa cuenta. Probá de nuevo en ${Math.ceil(esperaCuenta / 60)} minutos.` };
    }
    try {
      const persona = await verificarCredenciales(correo, enviada);
      if (persona) {
        token = crearTokenUsuario(clave, { id: persona.id, rol: persona.rol, version: persona.sesion_version });
        void registrarAcceso(persona.id);
        void registrarEvento("login_ok", { correo, usuarioId: persona.id, ip });
      }
    } catch (e) {
      // Si la base no responde no se puede afirmar que las credenciales estén
      // mal: se dice lo que pasa y se ofrece la salida que sí funciona.
      console.error("Login: no se pudo consultar usuarios:", e);
      return {
        error:
          "No se pudo verificar el usuario (la base no responde). " +
          "Avisale a Croman; mientras tanto se puede entrar con la clave general.",
      };
    }
  }

  if (!token) {
    anotarFallo(`ip:${ip}`, FRENO_IP);
    if (correo) anotarFallo(`cuenta:${correo}`, FRENO_CUENTA);
    void registrarEvento("login_fallo", { correo: correo || null, ip, detalle: modo === "emergencia" ? "clave general" : null });
    // El mensaje no distingue "usuario inexistente" de "clave incorrecta" ni
    // de "clave vacía": cualquier matiz es información gratis para quien está
    // probando.
    return { error: "Correo o clave incorrectos." };
  }

  limpiarFallos(`ip:${ip}`);
  if (correo) limpiarFallos(`cuenta:${correo}`);
  if (emergencia) void registrarEvento("login_emergencia", { ip });

  const store = await cookies();
  store.set(NOMBRE_COOKIE, token, opcionesCookie(esHttps(h), emergencia));

  redirect(destinoSeguro(String(form.get("destino") ?? "")));
}

export async function salir() {
  const store = await cookies();
  store.delete(NOMBRE_COOKIE);
  redirect("/entrar");
}
