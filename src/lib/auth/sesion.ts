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
 *
 * DOS TOKENS. `v1` es la clave general (emergencia): admin por un día.
 * `v3` es una persona con cuenta: lleva id, rol y la VERSIÓN DE SESIÓN de
 * esa cuenta. La puerta no consulta la base (corre en cada request); el
 * layout sí, con caché de un minuto, y si la versión del token quedó vieja
 * —cambió la clave, la dieron de baja, le cambiaron el rol— manda a entrar
 * de nuevo (ver vigencia.ts). El `v2` de antes (sin versión) ya no se
 * acepta: quien lo tenga vuelve a entrar una vez.
 */

const VERSION = "v1";
/** `v3.<id>.<rol>.<version>.<vence>.<firma>` */
const VERSION_USUARIO = "v3";
/** Dos semanas. Suficiente para no pedir la clave todos los días en una
 *  herramienta de trabajo diario, corto para que un equipo prestado o una
 *  sesión olvidada no quede abierta para siempre. */
const DURACION_MS = 14 * 24 * 60 * 60 * 1000;
/** La clave general es de emergencia: la sesión que abre dura un día. */
const DURACION_EMERGENCIA_MS = 24 * 60 * 60 * 1000;

export const NOMBRE_COOKIE = "advisor_sesion";

export type RolSesion = "admin" | "lector";

export type Sesion =
  /** Entró con la clave compartida del entorno. Es la llave de emergencia:
   *  se le da rol admin porque quien la tiene ya puede todo. */
  | { tipo: "compartida"; rol: "admin" }
  | { tipo: "usuario"; id: number; rol: RolSesion; version: number };

function firmar(datos: string, clave: string): string {
  return createHmac("sha256", clave).update(datos).digest("base64url");
}

/** Token para la cookie: `v1.<vence>.<firma>`. */
export function crearToken(clave: string): string {
  const vence = String(Date.now() + DURACION_EMERGENCIA_MS);
  const cuerpo = `${VERSION}.${vence}`;
  return `${cuerpo}.${firmar(cuerpo, clave)}`;
}

/** Token de una persona con cuenta: `v3.<id>.<rol>.<version>.<vence>.<firma>`. */
export function crearTokenUsuario(
  clave: string,
  usuario: { id: number; rol: RolSesion; version: number }
): string {
  const vence = String(Date.now() + DURACION_MS);
  const cuerpo = `${VERSION_USUARIO}.${usuario.id}.${usuario.rol}.${usuario.version}.${vence}`;
  return `${cuerpo}.${firmar(cuerpo, clave)}`;
}

function firmaCierra(cuerpo: string, firma: string, clave: string): boolean {
  const esperada = firmar(cuerpo, clave);
  // Comparación en tiempo constante: comparar firmas con === filtra por el
  // tiempo de respuesta cuántos caracteres iniciales acertó quien prueba.
  const a = Buffer.from(firma);
  const b = Buffer.from(esperada);
  return a.length === b.length && timingSafeEqual(a, b);
}

function noVencio(vence: string): boolean {
  // El vencimiento se valida DESPUÉS de la firma: antes sería confiar en un
  // número que todavía no se sabe si el servidor escribió.
  const n = Number(vence);
  return Number.isFinite(n) && n > Date.now();
}

/**
 * Lee la cookie y dice quién es, o null.
 *
 * NO CONSULTA LA BASE, a propósito: corre en la puerta, o sea en CADA
 * request, y una consulta ahí ataría el tablero entero a que Postgres esté
 * bien. La vigencia contra la base la revisa el layout (vigencia.ts), con
 * caché, una vez por página y no por request.
 */
export function leerSesion(
  token: string | undefined,
  clave: string
): Sesion | null {
  if (!token) return null;
  const partes = token.split(".");

  if (partes.length === 3) {
    const [version, vence, firma] = partes;
    if (version !== VERSION) return null;
    if (!firmaCierra(`${version}.${vence}`, firma, clave)) return null;
    return noVencio(vence) ? { tipo: "compartida", rol: "admin" } : null;
  }

  if (partes.length === 6) {
    const [version, id, rol, ver, vence, firma] = partes;
    if (version !== VERSION_USUARIO) return null;
    if (rol !== "admin" && rol !== "lector") return null;
    if (!firmaCierra(`${version}.${id}.${rol}.${ver}.${vence}`, firma, clave)) return null;
    if (!noVencio(vence)) return null;
    const n = Number(id);
    const v = Number(ver);
    if (!Number.isInteger(n) || n <= 0 || !Number.isInteger(v) || v < 0) return null;
    return { tipo: "usuario", id: n, rol, version: v };
  }

  return null;
}

export function tokenValido(token: string | undefined, clave: string): boolean {
  return leerSesion(token, clave) !== null;
}

/** Opciones de la cookie. `secure` sale del protocolo real y no de
 *  NODE_ENV: en desarrollo se entra por http y una cookie `secure` no
 *  viajaría, dejando el login en un bucle imposible de depurar. */
export function opcionesCookie(esHttps: boolean, emergencia = false) {
  return {
    httpOnly: true, // ningún script de la página puede leerla
    secure: esHttps,
    sameSite: "lax" as const, // no viaja en peticiones desde otros sitios
    path: "/",
    maxAge: (emergencia ? DURACION_EMERGENCIA_MS : DURACION_MS) / 1000,
  };
}
