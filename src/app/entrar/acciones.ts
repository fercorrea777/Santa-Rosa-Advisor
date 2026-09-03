"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { timingSafeEqual } from "node:crypto";
import { crearToken, NOMBRE_COOKIE, opcionesCookie } from "@/lib/auth/sesion";

export interface EstadoLogin {
  error: string;
}

/**
 * Freno de fuerza bruta, en memoria del proceso.
 *
 * Una clave COMPARTIDA sin freno se prueba a miles por minuto: es el ataque
 * realista contra esto, no el criptoanálisis. Cinco intentos y después un
 * minuto de espera por IP.
 *
 * En memoria y no en base a propósito: reiniciar el contenedor limpia los
 * contadores, y eso es aceptable —un atacante no controla los deploys— a
 * cambio de no meter una tabla y una escritura por intento fallido. Si
 * alguna vez hay varias réplicas, esto hay que mover a Postgres: cada
 * réplica contaría por su lado y el freno se aflojaría por el número de
 * réplicas.
 */
const intentos = new Map<string, { fallos: number; hasta: number }>();
const MAX_FALLOS = 5;
const ESPERA_MS = 60_000;

function ipDe(h: Headers): string {
  // Detrás de Cloudflare y del proxy de Coolify, la IP real viaja en estas
  // cabeceras; `x-forwarded-for` puede traer una lista y la primera es el
  // cliente.
  return (
    h.get("cf-connecting-ip") ??
    h.get("x-forwarded-for")?.split(",")[0].trim() ??
    "desconocida"
  );
}

function igual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** Solo rutas internas: `destino` viene de la URL y sin este filtro sería
 *  un redirect abierto — un enlace a nuestro dominio que termina en otro. */
function destinoSeguro(d: string | null): string {
  if (!d || !d.startsWith("/") || d.startsWith("//")) return "/mercado";
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
  const ahora = Date.now();
  const registro = intentos.get(ip);
  if (registro && registro.hasta > ahora) {
    const seg = Math.ceil((registro.hasta - ahora) / 1000);
    return { error: `Demasiados intentos. Probá de nuevo en ${seg} segundos.` };
  }

  const enviada = String(form.get("clave") ?? "");
  if (!igual(enviada, clave)) {
    const fallos = (registro?.fallos ?? 0) + 1;
    intentos.set(ip, {
      fallos,
      hasta: fallos >= MAX_FALLOS ? ahora + ESPERA_MS : 0,
    });
    // El mensaje no distingue "clave vacía" de "clave incorrecta": cualquier
    // matiz es información gratis para quien está probando.
    return { error: "Clave incorrecta." };
  }

  intentos.delete(ip);

  const esHttps =
    h.get("x-forwarded-proto") === "https" || h.get("origin")?.startsWith("https:") === true;
  const store = await cookies();
  store.set(NOMBRE_COOKIE, crearToken(clave), opcionesCookie(esHttps));

  redirect(destinoSeguro(String(form.get("destino") ?? "")));
}

export async function salir() {
  const store = await cookies();
  store.delete(NOMBRE_COOKIE);
  redirect("/entrar");
}
