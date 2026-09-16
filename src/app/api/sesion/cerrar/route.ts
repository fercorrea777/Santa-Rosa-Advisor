import { NextResponse, type NextRequest } from "next/server";
import { NOMBRE_COOKIE } from "@/lib/auth/sesion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Borra la cookie de sesión y manda a entrar. Existe porque un Server
 * Component (el layout, que es quien detecta que una sesión quedó cortada)
 * no puede escribir cookies: solo una ruta o una Server Action pueden.
 *
 * Sin efectos más allá de la cookie de quien la llama, así que un GET
 * alcanza y un enlace desde otro sitio no puede hacer más que desloguear a
 * quien lo abra.
 */
export function GET(request: NextRequest) {
  const motivo = request.nextUrl.searchParams.get("motivo");
  const url = request.nextUrl.clone();
  url.pathname = "/entrar";
  url.search = "";
  if (motivo === "sesion-cortada" || motivo === "vencida") url.searchParams.set("aviso", motivo);
  const r = NextResponse.redirect(url);
  r.cookies.delete(NOMBRE_COOKIE);
  r.headers.set("Cache-Control", "no-store");
  return r;
}
