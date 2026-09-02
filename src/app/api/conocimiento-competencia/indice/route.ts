import { NextResponse } from "next/server";
import { getIndiceConocimiento } from "@/lib/informes/conocimiento";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Indice del conocimiento de competencia, para el panel del dashboard.
 *
 * SOLO METADATOS: clave, titulo, fecha y tamaño. El CONTENIDO no sale por
 * aca a proposito.
 *
 * La app no tiene login (uso interno, ver /api/informes-competencia), asi
 * que todo lo que devuelva un endpoint publico es publico de verdad. Y lo
 * que guarda esta tabla no es un informe cualquiera: es el benchmark de
 * precios de la competencia, las battle cards modelo a modelo y el playbook
 * de pauta. Segun CLAUDE.md eso es material de uso EXCLUSIVAMENTE interno.
 *
 * Decir "hay un benchmark de precios, actualizado hace 30 dias" no revela
 * ningun precio; devolver el markdown entero, si. El contenido se lee solo
 * desde el servidor: la tool del Copiloto y el GET autenticado con
 * HERMES_INGEST_SECRET.
 */
export async function GET() {
  try {
    const documentos = await getIndiceConocimiento();
    return NextResponse.json({ documentos });
  } catch (e) {
    // Mismo criterio que el panel de informes: el error crudo va al log del
    // servidor, no a la cara de alguien del equipo comercial. Un indice
    // vacio hace que el panel muestre su mensaje de "todavia no hay nada",
    // que desde el punto de vista de quien mira es la misma situacion.
    console.error("GET /api/conocimiento-competencia/indice:", e);
    return NextResponse.json({ documentos: [] });
  }
}
