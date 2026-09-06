"use server";

import { revalidatePath } from "next/cache";
import { getMarcasPropiasSet, getParametros, guardarParametros } from "@/lib/cadam/config";
import { exigirAdminSiHayClave, type EstadoGuardado } from "./acciones";

/**
 * Metas de vehículos por marca y mes. Se guardan en parametros.json
 * (metas_mensuales) — el mismo archivo de las otras metas, un solo lugar.
 *
 * El formulario manda un campo por casillero: `m_<MARCA>_<mes 1..12>`.
 * Vacío = sin meta ese mes (null), que la app muestra como "—" y nunca como
 * un cero que parecería "la meta es no vender".
 */
export async function guardarMetasMensuales(
  _prev: EstadoGuardado | null,
  form: FormData
): Promise<EstadoGuardado> {
  const sinPermiso = await exigirAdminSiHayClave();
  if (sinPermiso) return { ok: false, mensaje: sinPermiso };

  const anio = Number(form.get("anio"));
  if (!Number.isInteger(anio) || anio < 2020 || anio > 2100) {
    return { ok: false, mensaje: "Año inválido." };
  }
  const propias = getMarcasPropiasSet();
  const metasAnio: Record<string, (number | null)[]> = {};
  let cargadas = 0;
  for (const marca of propias) {
    const meses: (number | null)[] = [];
    for (let mes = 1; mes <= 12; mes++) {
      const crudo = String(form.get(`m_${marca}_${mes}`) ?? "").trim().replace(/\./g, "");
      if (crudo === "") {
        meses.push(null);
        continue;
      }
      const n = Number(crudo);
      if (!Number.isInteger(n) || n < 0 || n > 100_000) {
        return {
          ok: false,
          mensaje: `${marca}, mes ${mes}: "${crudo}" no es una cantidad válida de vehículos.`,
        };
      }
      meses.push(n);
      cargadas++;
    }
    if (meses.some((m) => m !== null)) metasAnio[marca] = meses;
  }

  try {
    const actual = getParametros().metas_mensuales ?? {};
    guardarParametros({ metas_mensuales: { ...actual, [String(anio)]: metasAnio } });
  } catch (e) {
    console.error("guardarMetasMensuales:", e);
    return {
      ok: false,
      mensaje:
        "No se pudo escribir parametros.json en el servidor. Si pasa siempre, es un tema de permisos del volumen /datos.",
    };
  }
  revalidatePath("/", "layout");
  const total = Object.values(metasAnio).flat().reduce((s: number, v) => s + (v ?? 0), 0);
  return {
    ok: true,
    mensaje: `Guardado ${anio}: ${cargadas} casilleros con meta, ${total.toLocaleString("es-PY")} vehículos en el año.`,
  };
}
