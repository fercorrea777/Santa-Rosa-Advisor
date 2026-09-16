"use server";

import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { leerSesion, NOMBRE_COOKIE, type Sesion } from "@/lib/auth/sesion";
import { enviarEnlaceClave, hayCorreo, urlApp } from "@/lib/auth/correo";
import { ipDe } from "@/lib/auth/freno";
import { olvidarVigencia } from "@/lib/auth/vigencia";
import {
  borrarUsuario, cambiarActivo, cambiarClave, cambiarCorreo, cambiarRol, claveAlAzar,
  contarAdminsActivos, crearRecuperacion, crearUsuario, getUsuario, MINUTOS_INVITACION,
  MINUTOS_RECUPERACION, normalizarUsuario, problemaConElUsuario, problemaConLaClave,
  registrarEvento, type RolUsuario, type Usuario,
} from "@/lib/auth/usuarios";

/**
 * Alta, baja y cambios de usuarios.
 *
 * TODAS VUELVEN A COMPROBAR QUE QUIEN LLAMA ES ADMIN. La puerta (proxy.ts) ya
 * bloquea /configuracion para los lectores, pero una Server Action es un
 * endpoint POST con su propia URL: se puede invocar sin pasar por la pantalla.
 * Confiar en que "el que llega acá ya pasó por el proxy" es exactamente el
 * agujero que deja abierto un panel de administración.
 *
 * TODO QUEDA EN LA AUDITORÍA con quién lo hizo: es lo mínimo para un tablero
 * con precios, costos y stock adentro.
 */

export interface EstadoUsuarios {
  error?: string;
  ok?: string;
}

interface Quien {
  sesion: Sesion;
  /** Para la auditoría y el correo: el correo del admin, o "clave general". */
  etiqueta: string;
  ip: string;
}

async function exigirAdmin(): Promise<Quien | { error: string }> {
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
  let etiqueta = "clave general";
  if (sesion.tipo === "usuario") {
    const yo = await getUsuario(sesion.id);
    if (!yo || !yo.activo) return { error: "Tu usuario ya no está activo." };
    etiqueta = yo.usuario;
  }
  return { sesion, etiqueta, ip: ipDe(await headers()) };
}

function esError(v: unknown): v is { error: string } {
  return typeof v === "object" && v !== null && "error" in v;
}

/** Manda el enlace para poner clave. Devuelve el texto para la pantalla; si
 *  el correo no sale, lo dice con la causa (acá sí: es un admin mirando). */
async function mandarEnlace(
  persona: Usuario,
  tipo: "invitacion" | "reset_admin",
  quien: Quien
): Promise<{ ok: string } | { error: string }> {
  const { token } = await crearRecuperacion(
    persona.id,
    tipo === "invitacion" ? "invitacion" : "reset_admin",
    quien.ip
  );
  const minutos = tipo === "invitacion" ? MINUTOS_INVITACION : MINUTOS_RECUPERACION;
  if (!hayCorreo()) {
    // Sin SMTP el enlace igual existe: el admin lo puede pasar por otro canal.
    const enlace = `${urlApp()}/restablecer?token=${encodeURIComponent(token)}`;
    void registrarEvento(tipo === "invitacion" ? "invitacion_enviada" : "enlace_reset_enviado", {
      correo: persona.usuario, usuarioId: persona.id, ip: quien.ip, detalle: `sin SMTP, enlace mostrado a ${quien.etiqueta}`,
    });
    return {
      ok:
        `El envío de correo no está configurado en el servidor. Pasale este enlace a ` +
        `${persona.nombre} por un canal privado (vale ${Math.round(minutos / 60)} h, un solo uso): ${enlace}`,
    };
  }
  try {
    await enviarEnlaceClave({
      para: persona.usuario,
      nombre: persona.nombre,
      token,
      tipo,
      minutosValido: minutos,
      porQuien: quien.etiqueta === "clave general" ? undefined : quien.etiqueta,
    });
  } catch (e) {
    void registrarEvento("recuperacion_fallo_envio", {
      correo: persona.usuario, usuarioId: persona.id, ip: quien.ip, detalle: (e as Error).message,
    });
    return { error: `No se pudo enviar el correo a ${persona.usuario}: ${(e as Error).message}` };
  }
  void registrarEvento(tipo === "invitacion" ? "invitacion_enviada" : "enlace_reset_enviado", {
    correo: persona.usuario, usuarioId: persona.id, ip: quien.ip, detalle: `por ${quien.etiqueta}`,
  });
  return {
    ok:
      `Le mandamos a ${persona.usuario} un enlace para ${tipo === "invitacion" ? "elegir su clave" : "poner una clave nueva"} ` +
      `(vale ${minutos >= 60 * 24 ? `${Math.round(minutos / (60 * 24))} días` : `${minutos} minutos`}, un solo uso).`,
  };
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
  const porCorreo = !clave;

  const problemaUsuario = problemaConElUsuario(usuario);
  if (problemaUsuario) return { error: problemaUsuario };
  if (!nombre || nombre.length > 80) return { error: "Falta el nombre de la persona (hasta 80 caracteres)." };
  if (rol !== "admin" && rol !== "lector") return { error: "Rol inválido." };
  if (!porCorreo) {
    const problemaClave = problemaConLaClave(clave, usuario);
    if (problemaClave) return { error: problemaClave };
  }

  let persona: Usuario;
  try {
    persona = await crearUsuario({ usuario, nombre, rol, clave: porCorreo ? claveAlAzar() : clave });
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.includes("duplicate key")) {
      return { error: `Ya existe un usuario con el correo ${usuario}.` };
    }
    return { error: `No se pudo crear: ${msg}` };
  }
  void registrarEvento("usuario_creado", {
    correo: usuario, usuarioId: persona.id, ip: quien.ip,
    detalle: `${rol}, por ${quien.etiqueta}${porCorreo ? ", con invitación por correo" : ", con clave inicial"}`,
  });
  revalidatePath("/configuracion");

  if (porCorreo) {
    const r = await mandarEnlace(persona, "invitacion", quien);
    if ("error" in r) return { error: `Usuario ${usuario} creado, pero ${r.error} Podés reenviarle el enlace desde su fila.` };
    return { ok: `Usuario ${usuario} creado. ${r.ok}` };
  }
  return {
    ok: `Usuario ${usuario} creado. Pasale la clave por un canal privado — ` +
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

  const persona = await getUsuario(id);
  if (!persona) return { error: "Ese usuario ya no existe." };
  const problema = problemaConLaClave(clave, persona.usuario);
  if (problema) return { error: problema };

  await cambiarClave(id, clave);
  olvidarVigencia(id);
  void registrarEvento("reset_por_admin", {
    correo: persona.usuario, usuarioId: id, ip: quien.ip, detalle: `clave puesta a mano por ${quien.etiqueta}`,
  });
  revalidatePath("/configuracion");
  return {
    ok: `Clave de ${persona.usuario} cambiada; sus sesiones abiertas se cerraron. ` +
      `Le va a figurar como pendiente de cambiar hasta que la cambie esa persona.`,
  };
}

/** Manda el enlace de "poner clave nueva" sin que el admin conozca la
 *  clave: es la forma preferida de resetear. */
export async function accionEnviarEnlace(
  _prev: EstadoUsuarios | null,
  form: FormData
): Promise<EstadoUsuarios> {
  const quien = await exigirAdmin();
  if (esError(quien)) return quien;

  const id = Number(form.get("id"));
  if (!Number.isInteger(id)) return { error: "Usuario inválido." };
  const persona = await getUsuario(id);
  if (!persona) return { error: "Ese usuario ya no existe." };
  if (!persona.activo) return { error: "Está dado de baja: habilitalo antes de mandarle el enlace." };

  const tipo = persona.ultimo_acceso ? "reset_admin" : "invitacion";
  const r = await mandarEnlace(persona, tipo, quien);
  revalidatePath("/configuracion");
  return r;
}

export async function accionCambiarCorreo(
  _prev: EstadoUsuarios | null,
  form: FormData
): Promise<EstadoUsuarios> {
  const quien = await exigirAdmin();
  if (esError(quien)) return quien;

  const id = Number(form.get("id"));
  const correo = normalizarUsuario(String(form.get("correo") ?? ""));
  if (!Number.isInteger(id)) return { error: "Usuario inválido." };
  const problema = problemaConElUsuario(correo);
  if (problema) return { error: problema };

  const persona = await getUsuario(id);
  if (!persona) return { error: "Ese usuario ya no existe." };
  if (persona.usuario === correo) return { ok: "Es el mismo correo que ya tenía." };

  try {
    await cambiarCorreo(id, correo);
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.includes("duplicate key")) return { error: `Ya existe un usuario con el correo ${correo}.` };
    return { error: `No se pudo cambiar: ${msg}` };
  }
  olvidarVigencia(id);
  void registrarEvento("correo_cambiado", {
    correo, usuarioId: id, ip: quien.ip, detalle: `antes ${persona.usuario}, por ${quien.etiqueta}`,
  });
  revalidatePath("/configuracion");
  return { ok: `${persona.nombre} ahora entra como ${correo}. Sus sesiones abiertas se cerraron.` };
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
  olvidarVigencia(id);
  void registrarEvento("rol_cambiado", {
    correo: persona.usuario, usuarioId: id, ip: quien.ip, detalle: `${persona.rol} → ${rol}, por ${quien.etiqueta}`,
  });
  revalidatePath("/configuracion");
  return { ok: `${persona.usuario} ahora es ${rol}. Le aplica en menos de un minuto.` };
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
  if (!activo && quien.sesion.tipo === "usuario" && quien.sesion.id === id) {
    return { error: "No podés darte de baja a vos mismo." };
  }

  await cambiarActivo(id, activo);
  olvidarVigencia(id);
  void registrarEvento(activo ? "usuario_alta" : "usuario_baja", {
    correo: persona.usuario, usuarioId: id, ip: quien.ip, detalle: `por ${quien.etiqueta}`,
  });
  revalidatePath("/configuracion");
  return {
    ok: activo
      ? `${persona.usuario} queda habilitado.`
      : `${persona.usuario} queda deshabilitado; si tiene una sesión abierta se le cierra en menos de un minuto.`,
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
  if (quien.sesion.tipo === "usuario" && quien.sesion.id === id) {
    return { error: "No podés borrarte a vos mismo." };
  }
  if (persona.rol === "admin" && persona.activo && (await contarAdminsActivos(id)) === 0) {
    return { error: "Es el único administrador activo. Nombrá otro antes de borrarlo." };
  }

  await borrarUsuario(id);
  olvidarVigencia(id);
  void registrarEvento("usuario_borrado", {
    correo: persona.usuario, usuarioId: id, ip: quien.ip, detalle: `por ${quien.etiqueta}`,
  });
  revalidatePath("/configuracion");
  return { ok: `Usuario ${persona.usuario} borrado.` };
}
