import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { getPool } from "@/lib/informes/db";

/**
 * Usuarios del tablero, con clave propia por persona.
 *
 * POR QUE, SI YA HABIA UNA CLAVE. `ADVISOR_CLAVE` es UNA sola clave para todo
 * el equipo: no se sabe quien entro, no se le puede sacar el acceso a una
 * persona sin cambiarsela a todas, y cuando alguien se va hay que rotarla y
 * volver a repartirla. Con usuarios eso se resuelve de a uno.
 *
 * EL USUARIO ES EL CORREO (Croman, 16/09/2026): "el usuario en formato de
 * correo y todos los autorizados deben ser los correos con dominio
 * @santarosa.com.py". Un correo del dominio es una identidad que la empresa
 * ya administra: cuando alguien se va, se le cierra el correo y con eso
 * pierde también la recuperación de clave de acá. Las cuentas viejas con
 * nombre corto ("fernando.correa") se completan con el dominio al arrancar.
 *
 * LA CLAVE COMPARTIDA NO SE ELIMINA, Y ES A PROPOSITO. Es la llave de
 * emergencia:
 *   - si Postgres esta caido, esta tabla no se puede leer y NADIE podria
 *     entrar; con la compartida el tablero sigue accesible.
 *   - si se borra por error al ultimo admin, hay como volver a entrar.
 * Vive en el entorno del contenedor, no en la base, justamente para que un
 * problema de base no la arrastre. Quien entra con ella queda como admin,
 * por un día, y solo desde /entrar?modo=emergencia (no está enlazada).
 *
 * VERSION DE SESION. Las sesiones son un token firmado que la puerta valida
 * sin tocar la base (ver sesion.ts). Para poder CORTAR una sesión —cambio de
 * clave, baja, cambio de rol— cada usuario lleva un número de versión que
 * viaja en el token: cuando cambia, el layout (que sí puede consultar la
 * base, con caché de un minuto) manda a entrar de nuevo. Antes una baja
 * tardaba hasta 14 días en hacer efecto.
 *
 * HASH: scrypt de node:crypto, sin dependencias nuevas. No es bcrypt por
 * gusto: bcrypt son binarios nativos que hay que recompilar en cada imagen, y
 * scrypt viene en el runtime y es igual de valido para esto. Cada clave lleva
 * su propia sal, asi que dos personas con la misma clave tienen hashes
 * distintos y no se puede saber mirando la tabla.
 */

export type RolUsuario = "admin" | "lector";

export interface Usuario {
  id: number;
  /** El correo, en minúsculas. Se llama `usuario` porque así se llamaba la
   *  columna antes de que fuera obligatorio que sea un correo. */
  usuario: string;
  nombre: string;
  rol: RolUsuario;
  activo: boolean;
  /** true mientras la clave la haya puesto un admin y la persona todavia no
   *  la haya cambiado. Se le avisa al entrar. */
  debe_cambiar: boolean;
  /** Sube con cada cambio de clave, rol o baja: invalida las sesiones
   *  abiertas (ver sesion.ts / vigencia.ts). */
  sesion_version: number;
  creado_en: string;
  ultimo_acceso: string | null;
}

/** El dominio de correo de la empresa. Todo usuario tiene que ser un correo
 *  de acá; se puede pisar por entorno para probar en local. */
export const DOMINIO_CORREO = (process.env.ADVISOR_DOMINIO_CORREO ?? "santarosa.com.py").toLowerCase();

/** N=16384 tarda ~50 ms por verificacion: imperceptible al entrar, y
 *  suficientemente caro como para que probar claves a lo bruto no rinda.
 *  Los parametros van GUARDADOS en el hash para poder subirlos mas adelante
 *  sin invalidar las claves ya guardadas. */
const N = 16384;
const R = 8;
const P = 1;
const LARGO = 32;

function hashear(clave: string): string {
  const sal = randomBytes(16);
  const dk = scryptSync(clave.normalize("NFKC"), sal, LARGO, { N, r: R, p: P });
  return [
    "scrypt", N, R, P,
    sal.toString("base64url"),
    dk.toString("base64url"),
  ].join("$");
}

function verificarHash(clave: string, guardado: string): boolean {
  const partes = guardado.split("$");
  if (partes.length !== 6 || partes[0] !== "scrypt") return false;
  const [, n, r, p, sal, esperado] = partes;
  try {
    const dk = scryptSync(clave.normalize("NFKC"), Buffer.from(sal, "base64url"), LARGO, {
      N: Number(n), r: Number(r), p: Number(p),
    });
    const b = Buffer.from(esperado, "base64url");
    // Comparacion en tiempo constante: con === el tiempo de respuesta filtra
    // cuantos bytes iniciales acerto quien esta probando.
    return dk.length === b.length && timingSafeEqual(dk, b);
  } catch {
    return false;
  }
}

/** Minimo real, no simbolico. Una clave de 6 caracteres para un tablero con
 *  toda la inteligencia comercial adentro no es una clave. */
export const LARGO_MINIMO_CLAVE = 10;

/** Las que aparecen en cualquier lista de claves filtradas y las que alguien
 *  de la casa elegiría "por ahora". */
const CLAVES_OBVIAS = new Set([
  "1234567890", "0123456789", "qwertyuiop", "password12", "password123",
  "contraseña1", "contrasena1", "santarosa1", "santarosa12", "santarosa123",
  "santarosa2026", "santarosa2025", "advisor2026", "renault123", "jetour1234",
]);

/**
 * @param correo si se pasa, la clave no puede contener la parte local del
 *  correo ("fernando.correa" en fernando.correa@…): es lo primero que prueba
 *  quien conoce el usuario.
 */
export function problemaConLaClave(clave: string, correo?: string): string | null {
  if (clave.length < LARGO_MINIMO_CLAVE) {
    return `La clave necesita al menos ${LARGO_MINIMO_CLAVE} caracteres.`;
  }
  if (clave.length > 200) return "La clave no puede pasar los 200 caracteres.";
  if (/^\s|\s$/.test(clave)) {
    // Un espacio al principio o al final casi siempre es un pegado
    // accidental, y despues nadie entiende por que "la clave correcta" falla.
    return "La clave no puede empezar ni terminar con espacios.";
  }
  const baja = clave.toLowerCase();
  if (CLAVES_OBVIAS.has(baja) || /^(.)\1+$/.test(baja)) {
    return "Esa clave es demasiado fácil de adivinar. Elegí otra.";
  }
  if (baja.includes("santarosa") || baja.includes("santa rosa")) {
    return "La clave no puede contener el nombre de la empresa.";
  }
  if (correo) {
    const local = correo.split("@")[0]?.toLowerCase();
    if (local && local.length >= 4 && baja.includes(local)) {
      return "La clave no puede contener tu usuario de correo.";
    }
  }
  return null;
}

/** El correo con el que se entra. Se guarda en minusculas para que
 *  "Pablo@" y "pablo@" no sean dos cuentas distintas. */
export function normalizarUsuario(v: string): string {
  return v.trim().toLowerCase();
}

/** Correo válido y del dominio de la empresa. Se es estricto a propósito:
 *  el correo es también adonde llega el enlace para restablecer la clave. */
export function problemaConElUsuario(usuario: string): string | null {
  if (!usuario) return "Falta el correo.";
  if (usuario.length > 120) return "El correo no puede pasar los 120 caracteres.";
  const partes = usuario.split("@");
  if (partes.length !== 2 || !partes[0] || !partes[1]) {
    return `El usuario tiene que ser un correo de la empresa (nombre@${DOMINIO_CORREO}).`;
  }
  const [local, dominio] = partes;
  if (!/^[a-z0-9](?:[a-z0-9._+-]*[a-z0-9])?$/.test(local) || local.includes("..")) {
    return "El correo tiene caracteres que no van (solo letras, números, punto, guion y guion bajo).";
  }
  if (dominio !== DOMINIO_CORREO) {
    return `Solo pueden entrar correos @${DOMINIO_CORREO}.`;
  }
  return null;
}

export async function crearTablaUsuarios(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    create table if not exists usuarios (
      id             bigserial primary key,
      usuario        text not null unique,
      nombre         text not null,
      rol            text not null default 'lector',
      hash           text not null,
      activo         boolean not null default true,
      debe_cambiar   boolean not null default true,
      sesion_version integer not null default 1,
      creado_en      timestamptz not null default now(),
      ultimo_acceso  timestamptz
    );
  `);
  // Migraciones sobre una tabla que ya existía (create table if not exists
  // no agrega columnas). Idempotentes.
  await pool.query(
    `alter table usuarios add column if not exists sesion_version integer not null default 1`
  );
  // Las cuentas de antes del 16/09/2026 tenían un nombre corto; el usuario
  // pasa a ser el correo del dominio. Si el correo real de alguien es otro,
  // el admin lo corrige desde Configuración.
  await pool.query(
    `update usuarios set usuario = usuario || '@' || $1 where usuario not like '%@%'`,
    [DOMINIO_CORREO]
  );
  await pool.query(`
    create table if not exists recuperaciones (
      id          bigserial primary key,
      usuario_id  bigint not null references usuarios(id) on delete cascade,
      token_hash  text not null unique,
      motivo      text not null default 'olvido',
      expira_en   timestamptz not null,
      usado_en    timestamptz,
      creado_en   timestamptz not null default now(),
      ip          text
    );
  `);
  await pool.query(`
    create table if not exists auditoria_acceso (
      id         bigserial primary key,
      momento    timestamptz not null default now(),
      evento     text not null,
      correo     text,
      usuario_id bigint,
      ip         text,
      detalle    text
    );
  `);
  await pool.query(
    `create index if not exists auditoria_acceso_momento on auditoria_acceso (momento desc)`
  );
}

const COLUMNAS = `id, usuario, nombre, rol, activo, debe_cambiar, sesion_version,
                  creado_en, ultimo_acceso`;

/**
 * Toda lectura crea la tabla si falta. Es un `create table if not exists`
 * (barato, idempotente) y evita el arranque en dos tiempos: sin esto, la
 * primera visita a Configuracion en una base nueva explota con "relation
 * usuarios does not exist" y hay que acordarse de correr un script a mano.
 * Se corre una vez por proceso: después de la primera, es un no-op.
 */
let tablaLista: Promise<void> | null = null;
async function asegurarTabla(): Promise<void> {
  if (!tablaLista) {
    tablaLista = crearTablaUsuarios().catch((e) => {
      tablaLista = null;
      throw e;
    });
  }
  await tablaLista;
}

export async function listarUsuarios(): Promise<Usuario[]> {
  await asegurarTabla();
  const { rows } = await getPool().query<Usuario>(
    `select ${COLUMNAS} from usuarios order by activo desc, usuario asc`
  );
  return rows;
}

export async function contarAdminsActivos(excepto?: number): Promise<number> {
  await asegurarTabla();
  const { rows } = await getPool().query<{ n: string }>(
    `select count(*)::text as n from usuarios
     where rol = 'admin' and activo and ($1::bigint is null or id <> $1)`,
    [excepto ?? null]
  );
  return Number(rows[0]?.n ?? 0);
}

export async function hayUsuarios(): Promise<boolean> {
  await asegurarTabla();
  const { rows } = await getPool().query<{ n: string }>(
    `select count(*)::text as n from usuarios where activo`
  );
  return Number(rows[0]?.n ?? 0) > 0;
}

export async function getUsuario(id: number): Promise<Usuario | null> {
  await asegurarTabla();
  const { rows } = await getPool().query<Usuario>(
    `select ${COLUMNAS} from usuarios where id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function getUsuarioPorCorreo(correo: string): Promise<Usuario | null> {
  await asegurarTabla();
  const { rows } = await getPool().query<Usuario>(
    `select ${COLUMNAS} from usuarios where usuario = $1`,
    [normalizarUsuario(correo)]
  );
  return rows[0] ?? null;
}

/** Lo mínimo que hace falta para saber si una sesión sigue valiendo, sin
 *  traer la fila entera. */
export async function getVigencia(id: number): Promise<{ activo: boolean; sesion_version: number } | null> {
  await asegurarTabla();
  const { rows } = await getPool().query<{ activo: boolean; sesion_version: number }>(
    `select activo, sesion_version from usuarios where id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

/** Una clave al azar para las cuentas que se crean por invitación: nadie la
 *  conoce, y la persona pone la suya con el enlace que le llega. */
export function claveAlAzar(): string {
  return randomBytes(24).toString("base64url");
}

export async function crearUsuario(datos: {
  usuario: string;
  nombre: string;
  rol: RolUsuario;
  clave: string;
}): Promise<Usuario> {
  await asegurarTabla();
  const { rows } = await getPool().query<Usuario>(
    `insert into usuarios (usuario, nombre, rol, hash, debe_cambiar)
     values ($1, $2, $3, $4, true)
     returning ${COLUMNAS}`,
    [
      normalizarUsuario(datos.usuario),
      datos.nombre.trim(),
      datos.rol,
      hashear(datos.clave),
    ]
  );
  return rows[0];
}

/**
 * Cambia la clave y sube la versión de sesión: toda sesión abierta con la
 * clave vieja deja de valer en menos de un minuto.
 *
 * @param porElMismo true cuando la persona cambia SU clave (o la pone con el
 *  enlace de recuperación): ahi deja de estar pendiente. Si la resetea un
 *  admin, sigue pendiente hasta que la cambie quien la usa.
 * @returns la versión nueva, para reemitir la cookie de quien la cambió.
 */
export async function cambiarClave(
  id: number,
  clave: string,
  porElMismo = false
): Promise<number> {
  await asegurarTabla();
  const { rows } = await getPool().query<{ sesion_version: number }>(
    `update usuarios
       set hash = $2, debe_cambiar = $3, sesion_version = sesion_version + 1
     where id = $1
     returning sesion_version`,
    [id, hashear(clave), !porElMismo]
  );
  return rows[0]?.sesion_version ?? 0;
}

export async function cambiarRol(id: number, rol: RolUsuario): Promise<void> {
  await asegurarTabla();
  await getPool().query(
    `update usuarios set rol = $2, sesion_version = sesion_version + 1 where id = $1`,
    [id, rol]
  );
}

export async function cambiarActivo(id: number, activo: boolean): Promise<void> {
  await asegurarTabla();
  await getPool().query(
    `update usuarios set activo = $2, sesion_version = sesion_version + 1 where id = $1`,
    [id, activo]
  );
}

export async function cambiarCorreo(id: number, correo: string): Promise<void> {
  await asegurarTabla();
  await getPool().query(
    `update usuarios set usuario = $2, sesion_version = sesion_version + 1 where id = $1`,
    [id, normalizarUsuario(correo)]
  );
}

export async function borrarUsuario(id: number): Promise<void> {
  await asegurarTabla();
  await getPool().query(`delete from usuarios where id = $1`, [id]);
}

/**
 * Verifica correo + clave.
 *
 * Devuelve null tanto si el usuario no existe como si la clave esta mal, y
 * gasta el mismo tiempo en los dos casos: un login que responde mas rapido
 * ante un usuario inexistente le regala a quien prueba la lista de usuarios
 * validos, que es la mitad del trabajo.
 */
export async function verificarCredenciales(
  usuario: string,
  clave: string
): Promise<Usuario | null> {
  await asegurarTabla();
  const { rows } = await getPool().query<Usuario & { hash: string }>(
    `select ${COLUMNAS}, hash from usuarios where usuario = $1`,
    [normalizarUsuario(usuario)]
  );
  const fila = rows[0];
  if (!fila) {
    // Hash de descarte para que el "no existe" tarde lo mismo que el
    // "clave incorrecta".
    verificarHash(clave, hashear("comparacion-de-descarte"));
    return null;
  }
  if (!verificarHash(clave, fila.hash)) return null;
  if (!fila.activo) return null;

  const { hash: _descartado, ...limpio } = fila;
  void _descartado;
  return limpio;
}

export async function registrarAcceso(id: number): Promise<void> {
  try {
    await getPool().query(`update usuarios set ultimo_acceso = now() where id = $1`, [id]);
  } catch {
    // Que no se pueda anotar la fecha del ultimo acceso no es motivo para
    // dejar a alguien afuera. Se pierde el dato, no la sesion.
  }
}

// ----------------------------------------------------- recuperación de clave

/** Cuánto vale el enlace. Una hora alcanza para abrir el correo; un enlace
 *  que vale días es un enlace que alguien puede encontrar después. */
export const MINUTOS_RECUPERACION = 60;
/** La invitación (alta sin clave) vale más: la persona puede no estar
 *  mirando el correo ese día. */
export const MINUTOS_INVITACION = 60 * 24 * 3;

export type MotivoRecuperacion = "olvido" | "invitacion" | "reset_admin";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}

/**
 * Crea un token de un solo uso para poner clave nueva. Se guarda su hash,
 * no el token: si alguien lee la tabla no puede usar los enlaces. Los
 * tokens anteriores de la misma persona que sigan vivos se anulan: vale el
 * último enlace que le llegó.
 */
export async function crearRecuperacion(
  usuarioId: number,
  motivo: MotivoRecuperacion,
  ip: string | null
): Promise<{ token: string; expira: Date }> {
  await asegurarTabla();
  const token = randomBytes(32).toString("base64url");
  const minutos = motivo === "invitacion" ? MINUTOS_INVITACION : MINUTOS_RECUPERACION;
  const expira = new Date(Date.now() + minutos * 60_000);
  const cliente = await getPool().connect();
  try {
    await cliente.query("begin");
    await cliente.query(
      `update recuperaciones set usado_en = now()
       where usuario_id = $1 and usado_en is null`,
      [usuarioId]
    );
    await cliente.query(
      `insert into recuperaciones (usuario_id, token_hash, motivo, expira_en, ip)
       values ($1, $2, $3, $4, $5)`,
      [usuarioId, hashToken(token), motivo, expira, ip]
    );
    await cliente.query("commit");
  } catch (e) {
    await cliente.query("rollback");
    throw e;
  } finally {
    cliente.release();
  }
  return { token, expira };
}

/** El usuario dueño de un token vivo, o null. No lo consume. */
export async function usuarioDeRecuperacion(token: string): Promise<Usuario | null> {
  await asegurarTabla();
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  const { rows } = await getPool().query<Usuario>(
    `select ${COLUMNAS_U} from recuperaciones r join usuarios u on u.id = r.usuario_id
     where r.token_hash = $1 and r.usado_en is null and r.expira_en > now() and u.activo`,
    [hashToken(token)]
  );
  return rows[0] ?? null;
}

const COLUMNAS_U = `u.id, u.usuario, u.nombre, u.rol, u.activo, u.debe_cambiar,
                    u.sesion_version, u.creado_en, u.ultimo_acceso`;

/**
 * Consume el token y pone la clave nueva, en una transacción: el mismo
 * enlace no sirve dos veces ni aunque lleguen dos pedidos a la vez.
 * @returns el usuario con su versión de sesión nueva, o null si el token
 *  no vale (usado, vencido, inexistente).
 */
export async function restablecerConToken(
  token: string,
  clave: string
): Promise<Usuario | null> {
  await asegurarTabla();
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  const cliente = await getPool().connect();
  try {
    await cliente.query("begin");
    const { rows } = await cliente.query<{ usuario_id: number }>(
      `update recuperaciones set usado_en = now()
       where token_hash = $1 and usado_en is null and expira_en > now()
       returning usuario_id`,
      [hashToken(token)]
    );
    const fila = rows[0];
    if (!fila) {
      await cliente.query("rollback");
      return null;
    }
    const r = await cliente.query<Usuario>(
      `update usuarios
         set hash = $2, debe_cambiar = false, sesion_version = sesion_version + 1
       where id = $1 and activo
       returning ${COLUMNAS}`,
      [fila.usuario_id, hashear(clave)]
    );
    if (!r.rows[0]) {
      await cliente.query("rollback");
      return null;
    }
    await cliente.query("commit");
    return r.rows[0];
  } catch (e) {
    await cliente.query("rollback");
    throw e;
  } finally {
    cliente.release();
  }
}

// ------------------------------------------------------------- auditoría

export type EventoAcceso =
  | "login_ok" | "login_fallo" | "login_bloqueado" | "login_emergencia"
  | "recuperacion_pedida" | "recuperacion_enviada" | "recuperacion_fallo_envio"
  | "clave_restablecida" | "clave_cambiada"
  | "usuario_creado" | "invitacion_enviada" | "reset_por_admin" | "enlace_reset_enviado"
  | "rol_cambiado" | "usuario_baja" | "usuario_alta" | "usuario_borrado" | "correo_cambiado"
  | "sesion_cortada";

export interface EventoAuditoria {
  id: number;
  momento: string;
  evento: EventoAcceso;
  correo: string | null;
  usuario_id: number | null;
  ip: string | null;
  detalle: string | null;
}

/**
 * Deja constancia de quién entró, quién falló y qué tocó cada admin. Nunca
 * frena la operación que la llama: si la base no anota, se pierde el
 * renglón, no el acceso.
 */
export async function registrarEvento(
  evento: EventoAcceso,
  datos: { correo?: string | null; usuarioId?: number | null; ip?: string | null; detalle?: string | null } = {}
): Promise<void> {
  try {
    await asegurarTabla();
    await getPool().query(
      `insert into auditoria_acceso (evento, correo, usuario_id, ip, detalle)
       values ($1, $2, $3, $4, $5)`,
      [
        evento,
        datos.correo ? normalizarUsuario(datos.correo).slice(0, 160) : null,
        datos.usuarioId ?? null,
        datos.ip?.slice(0, 80) ?? null,
        datos.detalle?.slice(0, 300) ?? null,
      ]
    );
  } catch (e) {
    console.error("auditoría: no se pudo registrar", evento, (e as Error).message);
  }
}

export async function listarAuditoria(limite = 60): Promise<EventoAuditoria[]> {
  await asegurarTabla();
  const { rows } = await getPool().query<EventoAuditoria>(
    `select id, momento, evento, correo, usuario_id, ip, detalle
     from auditoria_acceso order by momento desc limit $1`,
    [limite]
  );
  return rows;
}
