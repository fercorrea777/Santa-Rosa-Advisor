import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";

/**
 * Puerta de entrada del tablero.
 *
 * POR QUE EXISTE
 * --------------
 * La app no tenia ningun control de acceso: cualquiera con la URL veia el CRM
 * entero. Mientras solo mostraba matriculaciones de CADAM —que son publicas—
 * eso era discutible pero tolerable. Dejo de serlo en septiembre de 2026,
 * cuando entraron el benchmark de PRECIOS de la competencia, las battle
 * cards, nuestro stock por modelo, nuestros precios de lista y nuestro ritmo
 * de venta. El CLAUDE.md del proyecto dice que la inteligencia competitiva es
 * de uso EXCLUSIVAMENTE interno; publicada en una URL abierta no lo era.
 *
 * ES `proxy.ts`, NO `middleware.ts`. En Next 16 el archivo `middleware` esta
 * deprecado y se renombro a `proxy`, y la funcion exportada tambien
 * (ver node_modules/next/dist/docs/.../upgrading/version-16.md). Escribirlo
 * con el nombre viejo no falla al compilar: simplemente NO CORRE, que en un
 * control de acceso es la peor forma de equivocarse.
 *
 * POR QUE BASIC Y NO UNA PANTALLA DE LOGIN
 * ----------------------------------------
 * Basic no necesita sesion, ni base de usuarios, ni cookie, ni pantalla: son
 * treinta lineas y protege TODO —paginas, rutas de API y los payloads RSC—
 * sin que quede ningun borde sin cubrir. Para un tablero interno de un equipo
 * chico eso alcanza. Una pantalla de login propia seria mas linda y bastante
 * mas superficie donde equivocarse.
 */

/**
 * Rutas que NO pasan por esta puerta porque tienen la suya.
 *
 * Son los endpoints que empuja Hermes desde afuera con
 * `Authorization: Bearer <HERMES_INGEST_SECRET>`. Si Basic los interceptara,
 * ese header no seria "Basic ..." y los tres cron jobs empezarian a fallar
 * con 401 todos los dias — y como el script los reintenta y despues se
 * rinde en silencio, nadie se enteraria hasta que el Copiloto empezara a
 * citar datos de hace semanas.
 *
 * Coinciden EXACTAS, no por prefijo: `/api/conocimiento-competencia/indice`
 * alimenta al panel del navegador y tiene que quedar protegida como el resto.
 */
const SIN_PUERTA = new Set([
  "/api/conocimiento-competencia",
  "/api/datos-propios",
  "/api/informes-competencia/hermes",
]);

/** Compara sin filtrar el largo por el tiempo de respuesta. Es barato y
 *  evita el unico ataque realista contra una clave compartida. */
function igual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

function pedirClave(): NextResponse {
  return new NextResponse("Se necesita autorización.", {
    status: 401,
    headers: {
      // El `realm` es lo que el navegador muestra en su cuadro de dialogo.
      "WWW-Authenticate": 'Basic realm="Santa Rosa · Advisor", charset="UTF-8"',
      // Que ningun intermediario guarde la respuesta del rechazo.
      "Cache-Control": "no-store",
    },
  });
}

export function proxy(request: NextRequest) {
  const clave = process.env.ADVISOR_CLAVE;

  // SIN CLAVE CONFIGURADA, LA PUERTA QUEDA ABIERTA. Es deliberado y no me
  // gusta: lo correcto en seguridad es fallar cerrado. Pero la variable se
  // carga desde Coolify, no desde el repo, asi que un fallo cerrado dejaria
  // al equipo afuera de su propio tablero en el mismo momento del deploy,
  // sin nadie adentro que pueda arreglarlo. El riesgo se hace VISIBLE en vez
  // de silencioso: mientras falte, cada pantalla muestra una franja roja
  // diciendo que el tablero es publico (ver AppShell).
  if (!clave) return NextResponse.next();

  if (SIN_PUERTA.has(request.nextUrl.pathname)) return NextResponse.next();

  const auth = request.headers.get("authorization") ?? "";
  if (!auth.startsWith("Basic ")) return pedirClave();

  let credenciales: string;
  try {
    credenciales = Buffer.from(auth.slice(6), "base64").toString("utf8");
  } catch {
    return pedirClave();
  }

  // "usuario:clave". El usuario se ignora a proposito — es una clave
  // compartida de equipo, no una cuenta por persona, y obligar a recordar
  // tambien un nombre de usuario solo agrega una forma de no poder entrar.
  const i = credenciales.indexOf(":");
  const enviada = i === -1 ? "" : credenciales.slice(i + 1);

  return igual(enviada, clave) ? NextResponse.next() : pedirClave();
}

export const config = {
  /**
   * Todo menos los archivos que el navegador pide solo.
   *
   * Sin esta exclusion el 401 tambien cae sobre `_next/static`, y el
   * resultado es una pagina sin CSS ni JS detras del cuadro de dialogo: el
   * navegador pide la clave una vez por CADA archivo. Los estaticos no
   * exponen ningun dato — el dato vive en las paginas y en las rutas de API,
   * que si estan cubiertas.
   */
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.png$).*)"],
};
