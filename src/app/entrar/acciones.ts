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
import { getI18n } from "@/lib/i18n/servidor";

export interface EstadoLogin {
  error: string;
  /** El correo que se escribió, para que el formulario lo conserve: React 19
   *  vacía los campos sin controlar al terminar la acción, y escribir el correo
   *  de nuevo en cada intento fallido es la peor parte de equivocarse de clave. */
  usuario?: string;
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

/**
 * Solo rutas internas: `destino` viene de la URL y sin este filtro sería un
 * redirect abierto — un enlace a nuestro dominio que termina en otro.
 *
 * No alcanza con descartar el prefijo «//»: los navegadores leen «\» como «/»
 * en las URL con esquema web y descartan tabuladores y saltos de línea, así que
 * «/\evil.com» y «/<tab>/evil.com» terminan siendo «//evil.com». Se resuelve el
 * destino con el mismo parser que usa el navegador (WHATWG URL) contra un origen
 * de mentira: si el resultado no queda en ese origen, no era una ruta nuestra.
 * Lo que se devuelve es la ruta ya normalizada, no el texto que llegó.
 */
function destinoSeguro(d: string | null): string {
  if (!d || !d.startsWith("/")) return "/mercado";
  try {
    const u = new URL(d, "http://interno.invalid");
    if (u.origin !== "http://interno.invalid" || u.pathname.startsWith("/entrar")) return "/mercado";
    return u.pathname + u.search;
  } catch {
    return "/mercado";
  }
}

export async function entrar(
  prev: EstadoLogin | null,
  form: FormData
): Promise<EstadoLogin> {
  const r = await intentar(prev, form);
  // Solo se devuelve el correo (no la clave), y solo si el acceso falló.
  return { ...r, usuario: String(form.get("usuario") ?? "").slice(0, 200) };
}

async function intentar(
  _prev: EstadoLogin | null,
  form: FormData
): Promise<EstadoLogin> {
  // Los errores vuelven a la pantalla en el idioma de quien está entrando.
  const { t } = await getI18n();
  const clave = process.env.ADVISOR_CLAVE;
  if (!clave) {
    return { error: t("El tablero no tiene clave configurada; no hace falta entrar.") };
  }

  const h = await headers();
  const ip = ipDe(h);
  const espera = bloqueadoPor(`ip:${ip}`);
  if (espera) {
    // El detalle de la auditoría se guarda en castellano (es un dato de la base) y se traduce al mostrarlo.
    void registrarEvento("login_bloqueado", { ip, detalle: `por IP, ${espera}s` }); // i18n-ignore
    return { error: t("Demasiados intentos. Probá de nuevo en {espera} segundos.", { espera }) };
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
    const problema = problemaConElUsuario(correo, t);
    if (problema) return { error: problema };
    const esperaCuenta = bloqueadoPor(`cuenta:${correo}`);
    if (esperaCuenta) {
      void registrarEvento("login_bloqueado", { correo, ip, detalle: `por cuenta, ${esperaCuenta}s` }); // i18n-ignore
      return { error: t("Demasiados intentos con esa cuenta. Probá de nuevo en {minutos} minutos.", { minutos: Math.ceil(esperaCuenta / 60) }) };
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
        error: t(
          "No se pudo verificar el usuario (la base no responde). " +
          "Avisale a Croman; mientras tanto se puede entrar con la clave general."
        ),
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
    return { error: t("Correo o clave incorrectos.") };
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
