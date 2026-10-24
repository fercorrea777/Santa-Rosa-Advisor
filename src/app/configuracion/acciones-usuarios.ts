"use server";

import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { leerSesion, NOMBRE_COOKIE, type Sesion } from "@/lib/auth/sesion";
import { enviarEnlaceClave, hayCorreo, urlApp } from "@/lib/auth/correo";
import { ipDe } from "@/lib/auth/freno";
import { olvidarVigencia } from "@/lib/auth/vigencia";
import { getI18n } from "@/lib/i18n/servidor";
import type { I18n } from "@/lib/i18n/crear";
import type { T } from "@/lib/i18n/traducir";
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
 *
 * IDIOMA. Lo que vuelve a la pantalla (errores y confirmaciones) sale en el idioma
 * de quien administra. El `detalle` que se anota en la auditoría NO: es un dato de
 * la base, queda siempre en castellano, y `usuarios.tsx` lo traduce al mostrarlo.
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

async function exigirAdmin(t: T): Promise<Quien | { error: string }> {
  const clave = process.env.ADVISOR_CLAVE;
  if (!clave) {
    // Sin clave configurada no hay sesiones y el tablero está abierto: crear
    // usuarios ahí daría una falsa sensación de control de acceso.
    return {
      error: t(
        "El tablero todavía no tiene clave general (ADVISOR_CLAVE). " +
        "Ponela primero: sin eso no hay sesiones y los usuarios no protegen nada."
      ),
    };
  }
  const store = await cookies();
  const sesion = leerSesion(store.get(NOMBRE_COOKIE)?.value, clave);
  if (!sesion) return { error: t("Sesión vencida. Volvé a entrar.") };
  if (sesion.rol !== "admin") return { error: t("Necesitás rol de administrador.") };
  let etiqueta = "clave general";
  if (sesion.tipo === "usuario") {
    const yo = await getUsuario(sesion.id);
    if (!yo || !yo.activo) return { error: t("Tu usuario ya no está activo.") };
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
  quien: Quien,
  i18n: I18n
): Promise<{ ok: string } | { error: string }> {
  const { t } = i18n;
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
      correo: persona.usuario, usuarioId: persona.id, ip: quien.ip, detalle: `sin SMTP, enlace mostrado a ${quien.etiqueta}`, // i18n-ignore
    });
    return {
      ok: t(
        "El envío de correo no está configurado en el servidor. Pasale este enlace a " +
        "{nombre} por un canal privado (vale {horas} h, un solo uso): {enlace}",
        { nombre: persona.nombre, horas: Math.round(minutos / 60), enlace }
      ),
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
      i18n,
    });
  } catch (e) {
    void registrarEvento("recuperacion_fallo_envio", {
      correo: persona.usuario, usuarioId: persona.id, ip: quien.ip, detalle: (e as Error).message,
    });
    return { error: t("No se pudo enviar el correo a {correo}: {motivo}", { correo: persona.usuario, motivo: (e as Error).message }) };
  }
  void registrarEvento(tipo === "invitacion" ? "invitacion_enviada" : "enlace_reset_enviado", {
    correo: persona.usuario, usuarioId: persona.id, ip: quien.ip, detalle: `por ${quien.etiqueta}`,
  });
  const validez = minutos >= 60 * 24
    ? t("{n} días", { n: Math.round(minutos / (60 * 24)) })
    : t("{n} minutos", { n: minutos });
  return {
    ok: tipo === "invitacion"
      ? t("Le mandamos a {correo} un enlace para elegir su clave (vale {validez}, un solo uso).", { correo: persona.usuario, validez })
      : t("Le mandamos a {correo} un enlace para poner una clave nueva (vale {validez}, un solo uso).", { correo: persona.usuario, validez }),
  };
}

export async function accionCrearUsuario(
  _prev: EstadoUsuarios | null,
  form: FormData
): Promise<EstadoUsuarios> {
  const i18n = await getI18n();
  const { t } = i18n;
  const quien = await exigirAdmin(t);
  if (esError(quien)) return quien;

  const usuario = normalizarUsuario(String(form.get("usuario") ?? ""));
  const nombre = String(form.get("nombre") ?? "").trim();
  const rol = String(form.get("rol") ?? "lector") as RolUsuario;
  const clave = String(form.get("clave") ?? "");
  const porCorreo = !clave;

  const problemaUsuario = problemaConElUsuario(usuario, t);
  if (problemaUsuario) return { error: problemaUsuario };
  if (!nombre || nombre.length > 80) return { error: t("Falta el nombre de la persona (hasta 80 caracteres).") };
  if (rol !== "admin" && rol !== "lector") return { error: t("Rol inválido.") };
  if (!porCorreo) {
    const problemaClave = problemaConLaClave(clave, usuario, t);
    if (problemaClave) return { error: problemaClave };
  }

  let persona: Usuario;
  try {
    persona = await crearUsuario({ usuario, nombre, rol, clave: porCorreo ? claveAlAzar() : clave });
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.includes("duplicate key")) {
      return { error: t("Ya existe un usuario con el correo {correo}.", { correo: usuario }) };
    }
    return { error: t("No se pudo crear: {motivo}", { motivo: msg }) };
  }
  void registrarEvento("usuario_creado", {
    correo: usuario, usuarioId: persona.id, ip: quien.ip,
    detalle: `${rol}, por ${quien.etiqueta}${porCorreo ? ", con invitación por correo" : ", con clave inicial"}`, // i18n-ignore
  });
  revalidatePath("/configuracion");

  if (porCorreo) {
    const r = await mandarEnlace(persona, "invitacion", quien, i18n);
    if ("error" in r) return { error: t("Usuario {usuario} creado, pero {error} Podés reenviarle el enlace desde su fila.", { usuario, error: r.error }) };
    return { ok: t("Usuario {usuario} creado. {detalle}", { usuario, detalle: r.ok }) };
  }
  return {
    ok: t(
      "Usuario {usuario} creado. Pasale la clave por un canal privado — " +
      "no queda guardada en ningún lado y no se puede volver a ver.",
      { usuario }
    ),
  };
}

export async function accionResetearClave(
  _prev: EstadoUsuarios | null,
  form: FormData
): Promise<EstadoUsuarios> {
  const { t } = await getI18n();
  const quien = await exigirAdmin(t);
  if (esError(quien)) return quien;

  const id = Number(form.get("id"));
  const clave = String(form.get("clave") ?? "");
  if (!Number.isInteger(id)) return { error: t("Usuario inválido.") };

  const persona = await getUsuario(id);
  if (!persona) return { error: t("Ese usuario ya no existe.") };
  const problema = problemaConLaClave(clave, persona.usuario, t);
  if (problema) return { error: problema };

  await cambiarClave(id, clave);
  olvidarVigencia(id);
  void registrarEvento("reset_por_admin", {
    correo: persona.usuario, usuarioId: id, ip: quien.ip, detalle: `clave puesta a mano por ${quien.etiqueta}`, // i18n-ignore
  });
  revalidatePath("/configuracion");
  return {
    ok: t(
      "Clave de {correo} cambiada; sus sesiones abiertas se cerraron. " +
      "Le va a figurar como pendiente de cambiar hasta que la cambie esa persona.",
      { correo: persona.usuario }
    ),
  };
}

/** Manda el enlace de "poner clave nueva" sin que el admin conozca la
 *  clave: es la forma preferida de resetear. */
export async function accionEnviarEnlace(
  _prev: EstadoUsuarios | null,
  form: FormData
): Promise<EstadoUsuarios> {
  const i18n = await getI18n();
  const { t } = i18n;
  const quien = await exigirAdmin(t);
  if (esError(quien)) return quien;

  const id = Number(form.get("id"));
  if (!Number.isInteger(id)) return { error: t("Usuario inválido.") };
  const persona = await getUsuario(id);
  if (!persona) return { error: t("Ese usuario ya no existe.") };
  if (!persona.activo) return { error: t("Está dado de baja: habilitalo antes de mandarle el enlace.") };

  const tipo = persona.ultimo_acceso ? "reset_admin" : "invitacion";
  const r = await mandarEnlace(persona, tipo, quien, i18n);
  revalidatePath("/configuracion");
  return r;
}

export async function accionCambiarCorreo(
  _prev: EstadoUsuarios | null,
  form: FormData
): Promise<EstadoUsuarios> {
  const { t } = await getI18n();
  const quien = await exigirAdmin(t);
  if (esError(quien)) return quien;

  const id = Number(form.get("id"));
  const correo = normalizarUsuario(String(form.get("correo") ?? ""));
  if (!Number.isInteger(id)) return { error: t("Usuario inválido.") };
  const problema = problemaConElUsuario(correo, t);
  if (problema) return { error: problema };

  const persona = await getUsuario(id);
  if (!persona) return { error: t("Ese usuario ya no existe.") };
  if (persona.usuario === correo) return { ok: t("Es el mismo correo que ya tenía.") };

  try {
    await cambiarCorreo(id, correo);
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.includes("duplicate key")) return { error: t("Ya existe un usuario con el correo {correo}.", { correo }) };
    return { error: t("No se pudo cambiar: {motivo}", { motivo: msg }) };
  }
  olvidarVigencia(id);
  void registrarEvento("correo_cambiado", {
    correo, usuarioId: id, ip: quien.ip, detalle: `antes ${persona.usuario}, por ${quien.etiqueta}`, // i18n-ignore
  });
  revalidatePath("/configuracion");
  return { ok: t("{nombre} ahora entra como {correo}. Sus sesiones abiertas se cerraron.", { nombre: persona.nombre, correo }) };
}

export async function accionCambiarRol(
  _prev: EstadoUsuarios | null,
  form: FormData
): Promise<EstadoUsuarios> {
  const { t } = await getI18n();
  const quien = await exigirAdmin(t);
  if (esError(quien)) return quien;

  const id = Number(form.get("id"));
  const rol = String(form.get("rol") ?? "") as RolUsuario;
  if (!Number.isInteger(id)) return { error: t("Usuario inválido.") };
  if (rol !== "admin" && rol !== "lector") return { error: t("Rol inválido.") };

  const persona = await getUsuario(id);
  if (!persona) return { error: t("Ese usuario ya no existe.") };

  // No dejar el tablero sin ningún admin: si nadie es admin, nadie puede
  // volver a entrar a esta pantalla ni crear a otro. Se sale de ahí sólo con
  // la clave general, y no todo el mundo la tiene a mano.
  if (persona.rol === "admin" && rol === "lector") {
    if ((await contarAdminsActivos(id)) === 0) {
      return {
        error: t("Es el único administrador activo. Nombrá otro antes de bajarlo a lector."),
      };
    }
  }

  await cambiarRol(id, rol);
  olvidarVigencia(id);
  void registrarEvento("rol_cambiado", {
    correo: persona.usuario, usuarioId: id, ip: quien.ip, detalle: `${persona.rol} → ${rol}, por ${quien.etiqueta}`, // i18n-ignore
  });
  revalidatePath("/configuracion");
  return {
    ok: rol === "admin"
      ? t("{correo} ahora es admin. Le aplica en menos de un minuto.", { correo: persona.usuario })
      : t("{correo} ahora es lector. Le aplica en menos de un minuto.", { correo: persona.usuario }),
  };
}

export async function accionCambiarActivo(
  _prev: EstadoUsuarios | null,
  form: FormData
): Promise<EstadoUsuarios> {
  const { t } = await getI18n();
  const quien = await exigirAdmin(t);
  if (esError(quien)) return quien;

  const id = Number(form.get("id"));
  const activo = String(form.get("activo")) === "true";
  if (!Number.isInteger(id)) return { error: t("Usuario inválido.") };

  const persona = await getUsuario(id);
  if (!persona) return { error: t("Ese usuario ya no existe.") };

  if (!activo && persona.rol === "admin" && (await contarAdminsActivos(id)) === 0) {
    return { error: t("Es el único administrador activo. Nombrá otro antes de darlo de baja.") };
  }
  if (!activo && quien.sesion.tipo === "usuario" && quien.sesion.id === id) {
    return { error: t("No podés darte de baja a vos mismo.") };
  }

  await cambiarActivo(id, activo);
  olvidarVigencia(id);
  void registrarEvento(activo ? "usuario_alta" : "usuario_baja", {
    correo: persona.usuario, usuarioId: id, ip: quien.ip, detalle: `por ${quien.etiqueta}`,
  });
  revalidatePath("/configuracion");
  return {
    ok: activo
      ? t("{correo} queda habilitado.", { correo: persona.usuario })
      : t("{correo} queda deshabilitado; si tiene una sesión abierta se le cierra en menos de un minuto.", { correo: persona.usuario }),
  };
}

export async function accionBorrarUsuario(
  _prev: EstadoUsuarios | null,
  form: FormData
): Promise<EstadoUsuarios> {
  const { t } = await getI18n();
  const quien = await exigirAdmin(t);
  if (esError(quien)) return quien;

  const id = Number(form.get("id"));
  if (!Number.isInteger(id)) return { error: t("Usuario inválido.") };

  const persona = await getUsuario(id);
  if (!persona) return { error: t("Ese usuario ya no existe.") };
  if (quien.sesion.tipo === "usuario" && quien.sesion.id === id) {
    return { error: t("No podés borrarte a vos mismo.") };
  }
  if (persona.rol === "admin" && persona.activo && (await contarAdminsActivos(id)) === 0) {
    return { error: t("Es el único administrador activo. Nombrá otro antes de borrarlo.") };
  }

  await borrarUsuario(id);
  olvidarVigencia(id);
  void registrarEvento("usuario_borrado", {
    correo: persona.usuario, usuarioId: id, ip: quien.ip, detalle: `por ${quien.etiqueta}`,
  });
  revalidatePath("/configuracion");
  return { ok: t("Usuario {correo} borrado.", { correo: persona.usuario }) };
}
