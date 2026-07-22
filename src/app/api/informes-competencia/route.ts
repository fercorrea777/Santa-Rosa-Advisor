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
    return NextResponse.json(
      { error: `No se pudieron leer los informes: ${(e as Error).message}` },
      { status: 500 }
    );
  }
}
