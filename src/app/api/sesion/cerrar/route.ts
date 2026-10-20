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
  const params = new URLSearchParams();
  if (motivo === "sesion-cortada" || motivo === "vencida") params.set("aviso", motivo);
  // Location RELATIVO. `request.nextUrl` trae el host INTERNO del contenedor
  // (localhost:3000) detrás del proxy de Coolify: con `NextResponse.redirect`
  // sobre una copia de esa URL, quien tenía la sesión cortada aterrizaba en una
  // dirección muerta. El navegador resuelve el relativo contra el host público.
  const r = new NextResponse(null, {
    status: 307,
    headers: {
      Location: params.size ? `/entrar?${params}` : "/entrar",
      "Cache-Control": "no-store",
    },
  });
  r.cookies.delete(NOMBRE_COOKIE);
  return r;
}
