"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { leerSesion, NOMBRE_COOKIE, type Sesion } from "@/lib/auth/sesion";
import {
  borrarUsuario, cambiarActivo, cambiarClave, cambiarRol, contarAdminsActivos,
  crearUsuario, getUsuario, normalizarUsuario, problemaConElUsuario,
  problemaConLaClave, type RolUsuario,
} from "@/lib/auth/usuarios";

/**
 * Alta, baja y cambios de usuarios.
 *
 * TODAS VUELVEN A COMPROBAR QUE QUIEN LLAMA ES ADMIN. La puerta (proxy.ts) ya
 * bloquea /configuracion para los lectores, pero una Server Action es un
 * endpoint POST con su propia URL: se puede invocar sin pasar por la pantalla.
 * Confiar en que "el que llega acá ya pasó por el proxy" es exactamente el
 * agujero que deja abierto un panel de administración.
 */

export interface EstadoUsuarios {
  error?: string;
  ok?: string;
}

async function exigirAdmin(): Promise<Sesion | { error: string }> {
  const clave = process.env.ADVISOR_CLAVE;
  if (!clave) {
    // Sin clave configurada no hay sesiones y el tablero está abierto: crear
    // usuarios ahí daría una falsa sensación de control de acceso.
    return {
      error:
        "El tablero todavía no tiene clave general (ADVISOR_CLAVE). " +
        "Ponela primero: sin eso no hay sesiones y los usuarios no protegen nada.",
    };
  }
  const store = await cookies();
  const sesion = leerSesion(store.get(NOMBRE_COOKIE)?.value, clave);
  if (!sesion) return { error: "Sesión vencida. Volvé a entrar." };
  if (sesion.rol !== "admin") return { error: "Necesitás rol de administrador." };
  return sesion;
}

function esError(v: unknown): v is { error: string } {
  return typeof v === "object" && v !== null && "error" in v;
}

export async function accionCrearUsuario(
  _prev: EstadoUsuarios | null,
  form: FormData
): Promise<EstadoUsuarios> {
  const quien = await exigirAdmin();
  if (esError(quien)) return quien;

  const usuario = normalizarUsuario(String(form.get("usuario") ?? ""));
  const nombre = String(form.get("nombre") ?? "").trim();
  const rol = String(form.get("rol") ?? "lector") as RolUsuario;
  const clave = String(form.get("clave") ?? "");

  const problemaUsuario = problemaConElUsuario(usuario);
  if (problemaUsuario) return { error: problemaUsuario };
  if (!nombre) return { error: "Falta el nombre de la persona." };
  if (rol !== "admin" && rol !== "lector") return { error: "Rol inválido." };
  const problemaClave = problemaConLaClave(clave);
  if (problemaClave) return { error: problemaClave };

  try {
    await crearUsuario({ usuario, nombre, rol, clave });
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.includes("duplicate key")) {
      return { error: `Ya existe un usuario "${usuario}".` };
    }
    return { error: `No se pudo crear: ${msg}` };
  }

  revalidatePath("/configuracion");
  return {
    ok: `Usuario "${usuario}" creado. Pasale la clave por un canal privado — ` +
      `no queda guardada en ningún lado y no se puede volver a ver.`,
  };
}

export async function accionResetearClave(
  _prev: EstadoUsuarios | null,
  form: FormData
): Promise<EstadoUsuarios> {
  const quien = await exigirAdmin();
  if (esError(quien)) return quien;

  const id = Number(form.get("id"));
  const clave = String(form.get("clave") ?? "");
  if (!Number.isInteger(id)) return { error: "Usuario inválido." };
  const problema = problemaConLaClave(clave);
  if (problema) return { error: problema };

  const persona = await getUsuario(id);
  if (!persona) return { error: "Ese usuario ya no existe." };

  await cambiarClave(id, clave);
  revalidatePath("/configuracion");
  return {
    ok: `Clave de "${persona.usuario}" cambiada. Le va a figurar como ` +
      `pendiente de cambiar hasta que la cambie esa persona.`,
  };
}

export async function accionCambiarRol(
  _prev: EstadoUsuarios | null,
  form: FormData
): Promise<EstadoUsuarios> {
  const quien = await exigirAdmin();
  if (esError(quien)) return quien;

  const id = Number(form.get("id"));
  const rol = String(form.get("rol") ?? "") as RolUsuario;
  if (!Number.isInteger(id)) return { error: "Usuario inválido." };
  if (rol !== "admin" && rol !== "lector") return { error: "Rol inválido." };

  const persona = await getUsuario(id);
  if (!persona) return { error: "Ese usuario ya no existe." };

  // No dejar el tablero sin ningún admin: si nadie es admin, nadie puede
  // volver a entrar a esta pantalla ni crear a otro. Se sale de ahí sólo con
  // la clave general, y no todo el mundo la tiene a mano.
  if (persona.rol === "admin" && rol === "lector") {
    if ((await contarAdminsActivos(id)) === 0) {
      return {
        error: "Es el único administrador activo. Nombrá otro antes de bajarlo a lector.",
      };
    }
  }

  await cambiarRol(id, rol);
  revalidatePath("/configuracion");
  return { ok: `"${persona.usuario}" ahora es ${rol}. Le aplica cuando vuelva a entrar.` };
}

export async function accionCambiarActivo(
  _prev: EstadoUsuarios | null,
  form: FormData
): Promise<EstadoUsuarios> {
  const quien = await exigirAdmin();
  if (esError(quien)) return quien;

  const id = Number(form.get("id"));
  const activo = String(form.get("activo")) === "true";
  if (!Number.isInteger(id)) return { error: "Usuario inválido." };

  const persona = await getUsuario(id);
  if (!persona) return { error: "Ese usuario ya no existe." };

  if (!activo && persona.rol === "admin" && (await contarAdminsActivos(id)) === 0) {
    return { error: "Es el único administrador activo. Nombrá otro antes de darlo de baja." };
  }
  if (!activo && quien.tipo === "usuario" && quien.id === id) {
    return { error: "No podés darte de baja a vos mismo." };
  }

  await cambiarActivo(id, activo);
  revalidatePath("/configuracion");
  return {
    ok: activo
      ? `"${persona.usuario}" queda habilitado.`
      : `"${persona.usuario}" queda deshabilitado. Ojo: si tiene una sesión ` +
        `abierta le dura hasta que venza (14 días).`,
  };
}

export async function accionBorrarUsuario(
  _prev: EstadoUsuarios | null,
  form: FormData
): Promise<EstadoUsuarios> {
  const quien = await exigirAdmin();
  if (esError(quien)) return quien;

  const id = Number(form.get("id"));
  if (!Number.isInteger(id)) return { error: "Usuario inválido." };

  const persona = await getUsuario(id);
  if (!persona) return { error: "Ese usuario ya no existe." };
  if (quien.tipo === "usuario" && quien.id === id) {
    return { error: "No podés borrarte a vos mismo." };
  }
  if (persona.rol === "admin" && persona.activo && (await contarAdminsActivos(id)) === 0) {
    return { error: "Es el único administrador activo. Nombrá otro antes de borrarlo." };
  }

  await borrarUsuario(id);
  revalidatePath("/configuracion");
  return { ok: `Usuario "${persona.usuario}" borrado.` };
}
