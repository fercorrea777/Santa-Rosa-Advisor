import { cookies } from "next/headers";
import { leerSesion, NOMBRE_COOKIE, type Sesion } from "@/lib/auth/sesion";
import { vigenciaDe } from "@/lib/auth/vigencia";
import { borrarFoto, getFoto, getVersionFoto, guardarFoto } from "@/lib/auth/usuarios";
import { olvidarPerfil, urlDeFoto } from "@/lib/auth/perfil";
import { anotarFallo, bloqueadoPor } from "@/lib/auth/freno";
import { MAX_BYTES_FOTO, TIPO_FOTO, validarFoto } from "@/lib/foto-perfil";

/**
 * La foto de perfil de quien está mirando.
 *
 *   GET     devuelve la foto propia (404 si no puso ninguna).
 *   PUT     reemplaza la foto: el cuerpo es el JPEG ya recortado por el navegador.
 *   DELETE  la quita.
 *
 * Solo trabaja sobre la propia cuenta: el id sale de la sesión firmada, nunca
 * de la URL ni del cuerpo, así que no hay forma de tocar la foto de otra
 * persona. La puerta (src/proxy.ts) ya pide sesión para todo /api; acá se
 * repite a propósito y además se comprueba que la cuenta siga viva.
 *
 * Quien entró con la clave general (emergencia) no es una cuenta y no tiene
 * foto: 403.
 */

const sinCache = { "Cache-Control": "no-store" };

function json(cuerpo: unknown, status = 200): Response {
  return Response.json(cuerpo, { status, headers: sinCache });
}

type SesionDeUsuario = Extract<Sesion, { tipo: "usuario" }>;

/** La sesión de una persona con cuenta, o la respuesta de error lista para
 *  devolver (quien llama distingue con `instanceof Response`). */
async function sesionDeUsuario(): Promise<SesionDeUsuario | Response> {
  const clave = process.env.ADVISOR_CLAVE;
  if (!clave) return json({ error: "El tablero no tiene sesiones." }, 403);
  const sesion = leerSesion((await cookies()).get(NOMBRE_COOKIE)?.value, clave);
  if (!sesion) return json({ error: "Sesión requerida." }, 401);
  if (sesion.tipo !== "usuario") {
    return json({ error: "El acceso de emergencia no tiene foto de perfil." }, 403);
  }
  if ((await vigenciaDe(sesion)) === "cortada") return json({ error: "Sesión requerida." }, 401);
  return sesion;
}

/** Un POST/PUT/DELETE que viene de otro sitio no es nuestro. La cookie ya es
 *  SameSite=Lax (no viaja en peticiones cruzadas), esto es el segundo cerrojo. */
function esDelMismoOrigen(request: Request): boolean {
  const sitio = request.headers.get("sec-fetch-site");
  if (sitio && sitio !== "same-origin" && sitio !== "none") return false;
  const origen = request.headers.get("origin");
  if (!origen) return true;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origen).host === host;
  } catch {
    return false;
  }
}

/** Lee el cuerpo cortando apenas pasa del tope, sin cargar a memoria un
 *  archivo enorme. null = se pasó. */
async function leerCuerpo(request: Request, max: number): Promise<Uint8Array | null> {
  const declarado = Number(request.headers.get("content-length"));
  if (Number.isFinite(declarado) && declarado > max) return null;
  const lector = request.body?.getReader();
  if (!lector) return new Uint8Array(0);
  const trozos: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await lector.cancel();
      return null;
    }
    trozos.push(value);
  }
  const todo = new Uint8Array(total);
  let desde = 0;
  for (const t of trozos) {
    todo.set(t, desde);
    desde += t.byteLength;
  }
  return todo;
}

/** Veinte cambios cada diez minutos por persona: de sobra para equivocarse y
 *  reintentar, y corta a quien quiera usar esto para llenar la base. */
const FRENO_SUBIDAS = { max: 20, esperaMs: 10 * 60_000, ventanaMs: 10 * 60_000 };

export async function GET(request: Request) {
  const sesion = await sesionDeUsuario();
  if (sesion instanceof Response) return sesion;

  // La URL que arma el menú lleva `?v=<versión>`: con esa versión la imagen no
  // cambia nunca, así que el navegador la guarda un año. Sin ella (o con una
  // vieja) se revalida con el ETag.
  const pedida = new URL(request.url).searchParams.get("v");
  const cabeceras = (version: string) => ({
    ETag: `"${version}"`,
    "Cache-Control": pedida === version ? "private, max-age=31536000, immutable" : "private, no-cache",
  });

  // Primero solo la versión: si el navegador ya la tiene (el caso de siempre) se
  // contesta 304 sin leer los bytes. Pedir la imagen entera para compararla y
  // tirarla era hasta 200 KB por visita, y el pool de conexiones es chico y lo
  // comparte el login.
  const version = await getVersionFoto(sesion.id);
  if (!version) return new Response(null, { status: 404, headers: { "Cache-Control": "private, no-cache" } });
  if (request.headers.get("if-none-match") === `"${version}"`) {
    return new Response(null, { status: 304, headers: cabeceras(version) });
  }

  const foto = await getFoto(sesion.id);
  // Se pudo haber quitado entre las dos consultas.
  if (!foto) return new Response(null, { status: 404, headers: { "Cache-Control": "private, no-cache" } });
  return new Response(new Uint8Array(foto.datos), {
    headers: {
      "Content-Type": foto.tipo,
      "Content-Length": String(foto.datos.length),
      "Content-Disposition": "inline",
      ...cabeceras(foto.version),
    },
  });
}

export async function PUT(request: Request) {
  if (!esDelMismoOrigen(request)) return json({ error: "Origen no permitido." }, 403);
  const sesion = await sesionDeUsuario();
  if (sesion instanceof Response) return sesion;

  const clave = `foto:${sesion.id}`;
  const espera = bloqueadoPor(clave);
  if (espera) {
    return json({ error: `Demasiados cambios de foto. Probá de nuevo en ${Math.ceil(espera / 60)} minutos.` }, 429);
  }
  anotarFallo(clave, FRENO_SUBIDAS);

  const tipo = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (tipo !== TIPO_FOTO) return json({ error: "La foto tiene que ser un JPEG." }, 415);

  const cuerpo = await leerCuerpo(request, MAX_BYTES_FOTO);
  if (!cuerpo) return json({ error: "La imagen es demasiado pesada." }, 413);
  const veredicto = validarFoto(cuerpo);
  if (!veredicto.ok) return json({ error: veredicto.motivo }, 422);

  const version = await guardarFoto(sesion.id, TIPO_FOTO, Buffer.from(cuerpo));
  olvidarPerfil(sesion.id);
  return json({ ok: true, url: urlDeFoto(version) });
}

export async function DELETE(request: Request) {
  if (!esDelMismoOrigen(request)) return json({ error: "Origen no permitido." }, 403);
  const sesion = await sesionDeUsuario();
  if (sesion instanceof Response) return sesion;
  await borrarFoto(sesion.id);
  olvidarPerfil(sesion.id);
  return json({ ok: true });
}
