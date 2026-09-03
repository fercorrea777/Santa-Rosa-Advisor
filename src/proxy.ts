import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { NOMBRE_COOKIE, tokenValido } from "@/lib/auth/sesion";

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
 * DE BASIC A SESION PROPIA (2026-09)
 * ----------------------------------
 * Arranco con HTTP Basic. Se cambio a una pantalla propia por dos razones,
 * y la segunda pesa mas que la estetica:
 *
 *  - Basic NO SE PUEDE CERRAR. El navegador reenvia las credenciales en cada
 *    request hasta que se cierra el navegador ENTERO. En una maquina
 *    compartida —o una notebook en una reunion— eso es una sesion que no
 *    tiene forma de terminar.
 *  - Su dialogo es del navegador: no se puede maquillar, ni explicar que es
 *    esto, ni decir por que hay una clave.
 *
 * Ahora: cookie firmada (ver lib/auth/sesion.ts), HttpOnly, SameSite=Lax, con
 * vencimiento adentro del token. Sigue cubriendo TODO —paginas, rutas de API
 * y los payloads RSC— porque la puerta esta en el proxy, no en cada pantalla.
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

/** A la pantalla de acceso, recordando adonde queria ir. Para las rutas de
 *  API se responde 401 en JSON: un fetch que recibe el HTML del login no
 *  tiene forma de darse cuenta de que lo que le falta es la sesion. */
function aLogin(request: NextRequest): NextResponse {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Sesión requerida." },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }
  const url = request.nextUrl.clone();
  url.pathname = "/entrar";
  url.search = "";
  const destino = request.nextUrl.pathname + request.nextUrl.search;
  if (destino !== "/") url.searchParams.set("destino", destino);
  const r = NextResponse.redirect(url);
  r.headers.set("Cache-Control", "no-store");
  return r;
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

  // La pantalla de acceso queda afuera, si no el redirect se muerde la cola.
  if (request.nextUrl.pathname === "/entrar") return NextResponse.next();

  const token = request.cookies.get(NOMBRE_COOKIE)?.value;
  return tokenValido(token, clave) ? NextResponse.next() : aLogin(request);
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
