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
/** Sesión de una persona con cuenta propia: `v2.<id>.<rol>.<vence>.<firma>`.
 *  El rol viaja FIRMADO adentro para que la puerta pueda decidir si alguien
 *  entra a Configuración sin ir a la base en cada request. */
const VERSION_USUARIO = "v2";
/** Dos semanas. Suficiente para no pedir la clave todos los días en una
 *  herramienta de trabajo diario, corto para que un equipo prestado o una
 *  sesión olvidada no quede abierta para siempre. */
const DURACION_MS = 14 * 24 * 60 * 60 * 1000;

export const NOMBRE_COOKIE = "advisor_sesion";

export type RolSesion = "admin" | "lector";

export type Sesion =
  /** Entró con la clave compartida del entorno. Es la llave de emergencia:
   *  se le da rol admin porque quien la tiene ya puede todo. */
  | { tipo: "compartida"; rol: "admin" }
  | { tipo: "usuario"; id: number; rol: RolSesion };

function firmar(datos: string, clave: string): string {
  return createHmac("sha256", clave).update(datos).digest("base64url");
}

/** Token para la cookie: `v1.<vence>.<firma>`. */
export function crearToken(clave: string): string {
  const vence = String(Date.now() + DURACION_MS);
  const cuerpo = `${VERSION}.${vence}`;
  return `${cuerpo}.${firmar(cuerpo, clave)}`;
}

/** Token de una persona con cuenta: `v2.<id>.<rol>.<vence>.<firma>`. */
export function crearTokenUsuario(
  clave: string,
  usuario: { id: number; rol: RolSesion }
): string {
  const vence = String(Date.now() + DURACION_MS);
  const cuerpo = `${VERSION_USUARIO}.${usuario.id}.${usuario.rol}.${vence}`;
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
 * bien. El precio es que dar de baja a alguien no le corta la sesión en el
 * acto: le vence sola (14 días) o se corta antes cambiando ADVISOR_CLAVE, que
 * invalida TODAS las firmas de una. Está dicho en la pantalla de usuarios
 * para que nadie descubra el detalle el día que lo necesita.
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

  if (partes.length === 5) {
    const [version, id, rol, vence, firma] = partes;
    if (version !== VERSION_USUARIO) return null;
    if (rol !== "admin" && rol !== "lector") return null;
    if (!firmaCierra(`${version}.${id}.${rol}.${vence}`, firma, clave)) return null;
    if (!noVencio(vence)) return null;
    const n = Number(id);
    if (!Number.isInteger(n) || n <= 0) return null;
    return { tipo: "usuario", id: n, rol };
  }

  return null;
}

export function tokenValido(token: string | undefined, clave: string): boolean {
  return leerSesion(token, clave) !== null;
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
