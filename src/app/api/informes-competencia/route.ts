import { NextResponse } from "next/server";
import { getInformesRecientes } from "@/lib/informes/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lectura de los últimos informes generados, para el panel dentro de la
 *  pantalla Copiloto. Sin autenticación, igual que el resto de la app
 *  (uso interno, sin login). Solo lectura. */
export async function GET() {
  try {
    const informes = await getInformesRecientes(12);
    return NextResponse.json({ informes });
  } catch (e) {
    // El error real (falta POSTGRES_URL, tabla sin crear, driver caído)
    // queda en los logs del servidor para quien lo tenga que debuggear —
    // nunca en la respuesta. Quien ve esta pantalla es del equipo
    // comercial, no un desarrollador: un stack de VercelPostgresError no
    // le sirve de nada y se lee como que la app está rota, cuando en
    // realidad el informe semanal simplemente no está activado todavía.
    // informes: [] (no un 500 con el error crudo) hace que el panel
    // muestre su mensaje normal de "todavía no hay informes" — el mismo
    // que ve cuando la tabla existe pero está vacía. Desde el punto de
    // vista del usuario es la misma situación real: no hay nada que leer.
    console.error("GET /api/informes-competencia:", e);
    return NextResponse.json({ informes: [] });
  }
}
