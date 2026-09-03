import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Sesión del tablero: un token firmado, no un flag.
 *
 * POR QUE FIRMADO. Una cookie tipo `sesion=ok` la escribe cualquiera desde
 * la consola del navegador en dos segundos, y la puerta deja de existir. El
 * token lleva su vencimiento y una firma HMAC que solo el servidor puede
 * producir: si alguien lo edita, la firma no cierra y no entra.
 *
 * LA CLAVE DE FIRMA ES `ADVISOR_CLAVE`. No es pereza de no tener un secreto
 * aparte: atarlos hace que cambiar la contraseña INVALIDE TODAS las sesiones
 * abiertas. Es lo que uno espera cuando rota una clave compartida —si se
 * filtró, se cambia y todo el mundo queda afuera— y con dos secretos
 * separados habría que acordarse de rotar los dos.
 */

const VERSION = "v1";
/** Dos semanas. Suficiente para no pedir la clave todos los días en una
 *  herramienta de trabajo diario, corto para que un equipo prestado o una
 *  sesión olvidada no quede abierta para siempre. */
const DURACION_MS = 14 * 24 * 60 * 60 * 1000;

export const NOMBRE_COOKIE = "advisor_sesion";

function firmar(datos: string, clave: string): string {
  return createHmac("sha256", clave).update(datos).digest("base64url");
}

/** Token para la cookie: `v1.<vence>.<firma>`. */
export function crearToken(clave: string): string {
  const vence = String(Date.now() + DURACION_MS);
  const cuerpo = `${VERSION}.${vence}`;
  return `${cuerpo}.${firmar(cuerpo, clave)}`;
}

export function tokenValido(token: string | undefined, clave: string): boolean {
  if (!token) return false;
  const partes = token.split(".");
  if (partes.length !== 3) return false;
  const [version, vence, firma] = partes;
  if (version !== VERSION) return false;

  const esperada = firmar(`${version}.${vence}`, clave);
  // Comparación en tiempo constante: comparar firmas con === filtra por el
  // tiempo de respuesta cuántos caracteres iniciales acertó quien prueba.
  const a = Buffer.from(firma);
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;

  // El vencimiento se valida DESPUÉS de la firma: antes sería confiar en un
  // número que todavía no se sabe si el servidor escribió.
  const n = Number(vence);
  return Number.isFinite(n) && n > Date.now();
}

/** Opciones de la cookie. `secure` sale del protocolo real y no de
 *  NODE_ENV: en desarrollo se entra por http y una cookie `secure` no
 *  viajaría, dejando el login en un bucle imposible de depurar. */
export function opcionesCookie(esHttps: boolean) {
  return {
    httpOnly: true, // ningún script de la página puede leerla
    secure: esHttps,
    sameSite: "lax" as const, // no viaja en peticiones desde otros sitios
    path: "/",
    maxAge: DURACION_MS / 1000,
  };
}
