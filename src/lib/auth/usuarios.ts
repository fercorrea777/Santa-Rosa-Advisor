import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { getPool } from "@/lib/informes/db";

/**
 * Usuarios del tablero, con clave propia por persona.
 *
 * POR QUE, SI YA HABIA UNA CLAVE. `ADVISOR_CLAVE` es UNA sola clave para todo
 * el equipo: no se sabe quien entro, no se le puede sacar el acceso a una
 * persona sin cambiarsela a todas, y cuando alguien se va hay que rotarla y
 * volver a repartirla. Con usuarios eso se resuelve de a uno.
 *
 * LA CLAVE COMPARTIDA NO SE ELIMINA, Y ES A PROPOSITO. Es la llave de
 * emergencia:
 *   - si Postgres esta caido, esta tabla no se puede leer y NADIE podria
 *     entrar; con la compartida el tablero sigue accesible.
 *   - si se borra por error al ultimo admin, hay como volver a entrar.
 * Vive en el entorno del contenedor, no en la base, justamente para que un
 * problema de base no la arrastre. Quien entra con ella queda como admin.
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
  usuario: string;
  nombre: string;
  rol: RolUsuario;
  activo: boolean;
  /** true mientras la clave la haya puesto un admin y la persona todavia no
   *  la haya cambiado. Se le avisa al entrar. */
  debe_cambiar: boolean;
  creado_en: string;
  ultimo_acceso: string | null;
}

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

export function problemaConLaClave(clave: string): string | null {
  if (clave.length < LARGO_MINIMO_CLAVE) {
    return `La clave necesita al menos ${LARGO_MINIMO_CLAVE} caracteres.`;
  }
  if (/^\s|\s$/.test(clave)) {
    // Un espacio al principio o al final casi siempre es un pegado
    // accidental, y despues nadie entiende por que "la clave correcta" falla.
    return "La clave no puede empezar ni terminar con espacios.";
  }
  return null;
}

/** El nombre con el que se entra. Se guarda en minusculas para que
 *  "Pablo" y "pablo" no sean dos cuentas distintas. */
export function normalizarUsuario(v: string): string {
  return v.trim().toLowerCase();
}

export function problemaConElUsuario(usuario: string): string | null {
  if (usuario.length < 3) return "El usuario necesita al menos 3 caracteres.";
  if (usuario.length > 60) return "El usuario no puede pasar los 60 caracteres.";
  if (!/^[a-z0-9._@-]+$/.test(usuario)) {
    return "El usuario admite letras, números y . _ - @ (sin espacios ni acentos).";
  }
  return null;
}

export async function crearTablaUsuarios(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    create table if not exists usuarios (
      id            bigserial primary key,
      usuario       text not null unique,
      nombre        text not null,
      rol           text not null default 'lector',
      hash          text not null,
      activo        boolean not null default true,
      debe_cambiar  boolean not null default true,
      creado_en     timestamptz not null default now(),
      ultimo_acceso timestamptz
    );
  `);
}

const COLUMNAS = `id, usuario, nombre, rol, activo, debe_cambiar,
                  creado_en, ultimo_acceso`;

/**
 * Toda lectura crea la tabla si falta. Es un `create table if not exists`
 * (barato, idempotente) y evita el arranque en dos tiempos: sin esto, la
 * primera visita a Configuracion en una base nueva explota con "relation
 * usuarios does not exist" y hay que acordarse de correr un script a mano.
 */
async function asegurarTabla(): Promise<void> {
  await crearTablaUsuarios();
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

/** @param porElMismo true cuando la persona cambia SU clave: ahi deja de
 *  estar pendiente. Si la resetea un admin, sigue pendiente hasta que la
 *  cambie quien la usa. */
export async function cambiarClave(
  id: number,
  clave: string,
  porElMismo = false
): Promise<void> {
  await asegurarTabla();
  await getPool().query(
    `update usuarios set hash = $2, debe_cambiar = $3 where id = $1`,
    [id, hashear(clave), !porElMismo]
  );
}

export async function cambiarRol(id: number, rol: RolUsuario): Promise<void> {
  await asegurarTabla();
  await getPool().query(`update usuarios set rol = $2 where id = $1`, [id, rol]);
}

export async function cambiarActivo(id: number, activo: boolean): Promise<void> {
  await asegurarTabla();
  await getPool().query(`update usuarios set activo = $2 where id = $1`, [id, activo]);
}

export async function borrarUsuario(id: number): Promise<void> {
  await asegurarTabla();
  await getPool().query(`delete from usuarios where id = $1`, [id]);
}

/**
 * Verifica usuario + clave.
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
