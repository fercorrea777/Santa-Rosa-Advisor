import { URL_FOTO } from "@/lib/foto-perfil";
import { getPerfil } from "./usuarios";
import type { Sesion } from "./sesion";

/**
 * Lo que el menú lateral y la barra de arriba muestran de quien está mirando:
 * nombre, correo, rol y foto.
 *
 * Mismo criterio que vigencia.ts, y por la misma razón: el layout corre en
 * cada página, y una consulta por página es mucho para un dato que casi no
 * cambia. Caché de un minuto por persona en la memoria del proceso; quien
 * cambia su foto la ve al instante porque la ruta que la guarda llama a
 * `olvidarPerfil`.
 *
 * SI POSTGRES NO RESPONDE, EL MENÚ SE ARMA IGUAL: con el rol que ya viaja en
 * la sesión firmada y sin foto. La cara de la persona no es motivo para
 * tumbar una pantalla.
 */

export const ETIQUETA_ROL = { admin: "Administrador", lector: "Lector" } as const;

export interface PerfilVisible {
  nombre: string;
  /** Correo, o la aclaración que lo reemplaza cuando no hay cuenta. */
  detalle: string;
  rolEtiqueta: string;
  /** URL de la foto con su versión (`?v=`), o null si no puso ninguna. */
  fotoUrl: string | null;
  /** true cuando entró con la clave general del equipo: no es una persona, no
   *  tiene foto ni cuenta que editar. */
  emergencia: boolean;
}

const CACHE_MS = 60_000;
// En globalThis y no en una variable de módulo: Next compila cada ruta con su
// propia copia de los módulos, así que un Map de módulo NO se comparte entre la
// ruta que guarda la foto (y llama a `olvidarPerfil`) y el layout que la lee.
// Con una variable de módulo, la foto nueva tardaba hasta un minuto en
// aparecer en el menú. El pool de Postgres (informes/db.ts) hace lo mismo.
const global_ = globalThis as unknown as {
  cachePerfilAdvisor?: Map<number, { hasta: number; perfil: PerfilVisible }>;
};
const cache = (global_.cachePerfilAdvisor ??= new Map());

export function urlDeFoto(version: string | null | undefined): string | null {
  return version ? `${URL_FOTO}?v=${version}` : null;
}

export async function perfilDe(sesion: Sesion): Promise<PerfilVisible> {
  if (sesion.tipo === "compartida") {
    return {
      nombre: "Acceso de emergencia",
      detalle: "Clave general del equipo",
      rolEtiqueta: ETIQUETA_ROL.admin,
      fotoUrl: null,
      emergencia: true,
    };
  }
  const ahora = Date.now();
  const guardado = cache.get(sesion.id);
  if (guardado && guardado.hasta > ahora) return guardado.perfil;

  try {
    const fila = await getPerfil(sesion.id);
    if (fila) {
      const perfil: PerfilVisible = {
        nombre: fila.nombre,
        detalle: fila.usuario,
        rolEtiqueta: ETIQUETA_ROL[fila.rol] ?? fila.rol,
        fotoUrl: urlDeFoto(fila.foto_version),
        emergencia: false,
      };
      cache.set(sesion.id, { hasta: ahora + CACHE_MS, perfil });
      return perfil;
    }
  } catch (e) {
    console.error("perfil: no se pudo consultar la base:", (e as Error).message);
  }
  return {
    nombre: "Tu cuenta",
    detalle: "",
    rolEtiqueta: ETIQUETA_ROL[sesion.rol],
    fotoUrl: null,
    emergencia: false,
  };
}

/** Para que un cambio de foto se vea al instante en este proceso, sin esperar
 *  el minuto de caché. */
export function olvidarPerfil(id: number): void {
  cache.delete(id);
}
