import { getVigencia } from "./usuarios";
import type { Sesion } from "./sesion";

/**
 * ¿La sesión sigue valiendo según la BASE?
 *
 * La puerta (proxy.ts) valida la firma sin consultar Postgres, en cada
 * request. Eso deja un hueco: una persona dada de baja, o a la que le
 * cambiaron la clave, seguía entrando hasta que le venciera la cookie (14
 * días). Acá se cierra: el layout llama esto una vez por página y compara la
 * versión de sesión del token con la de la fila.
 *
 * CON CACHÉ DE UN MINUTO por usuario, en memoria del proceso: sin caché es
 * una consulta por cada página que abre cada persona; con un minuto, una
 * baja tarda a lo sumo un minuto en hacer efecto, que es lo que uno espera.
 *
 * SI POSTGRES NO RESPONDE, LA SESIÓN SE DA POR BUENA. Es a propósito: la
 * firma ya cerró, y dejar a todo el equipo afuera porque la base parpadeó
 * es peor que que una baja tarde en aplicarse mientras dura la caída.
 */

const CACHE_MS = 60_000;
const cache = new Map<number, { hasta: number; activo: boolean; version: number }>();

export type Vigencia = "vigente" | "cortada";

export async function vigenciaDe(sesion: Sesion): Promise<Vigencia> {
  if (sesion.tipo !== "usuario") return "vigente";
  const ahora = Date.now();
  let dato = cache.get(sesion.id);
  if (!dato || dato.hasta <= ahora) {
    try {
      const fila = await getVigencia(sesion.id);
      dato = {
        hasta: ahora + CACHE_MS,
        activo: fila?.activo ?? false,
        version: fila?.sesion_version ?? -1,
      };
      cache.set(sesion.id, dato);
    } catch (e) {
      console.error("vigencia: no se pudo consultar la base:", (e as Error).message);
      return "vigente";
    }
  }
  return dato.activo && dato.version === sesion.version ? "vigente" : "cortada";
}

/** Para que un cambio hecho desde Configuración (baja, reset, rol) o por la
 *  propia persona (cambio de clave) se sienta al instante en este proceso,
 *  sin esperar el minuto de caché. */
export function olvidarVigencia(id: number): void {
  cache.delete(id);
}
