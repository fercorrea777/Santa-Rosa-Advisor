"use server";

import { revalidatePath } from "next/cache";
import { getParametros, guardarParametros } from "@/lib/cadam/config";

/**
 * Server Action de la pantalla de Configuración.
 *
 * Action y no una ruta de API: corre en el servidor, viaja por el POST que
 * Next arma solo, y queda detrás de la puerta Basic del proxy sin registrar
 * ninguna ruta nueva que haya que acordarse de proteger.
 *
 * `revalidatePath("/", "layout")` al final: las metas no son decorado de la
 * pantalla de Configuración — el Centro de Inteligencia las compara contra
 * el share real. Sin revalidar todo, esa pantalla seguiría mostrando la
 * lectura calculada con la meta vieja.
 */

export interface EstadoGuardado {
  ok: boolean;
  mensaje: string;
}

function numeroONull(v: FormDataEntryValue | null): number | null | "error" {
  const t = String(v ?? "").trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : "error";
}

export async function guardarConfiguracion(
  _prev: EstadoGuardado | null,
  form: FormData
): Promise<EstadoGuardado> {
  const participacion = numeroONull(form.get("participacion"));
  const ranking = numeroONull(form.get("ranking"));
  const unidades = numeroONull(form.get("unidades"));

  if (participacion === "error" || ranking === "error" || unidades === "error") {
    return { ok: false, mensaje: "Hay un valor que no es un número. Revisá y volvé a guardar." };
  }
  if (participacion !== null && (participacion <= 0 || participacion > 100)) {
    return { ok: false, mensaje: "La participación va en porcentaje: entre 0 y 100." };
  }
  if (ranking !== null && (!Number.isInteger(ranking) || ranking < 1 || ranking > 60)) {
    return { ok: false, mensaje: "El ranking objetivo es una posición entera (1 a 60)." };
  }
  if (unidades !== null && (!Number.isInteger(unidades) || unidades < 1 || unidades > 100_000)) {
    return { ok: false, mensaje: "Las unidades mensuales van como entero positivo." };
  }

  // Competidores: llegan como un textarea de nombres separados por coma o
  // salto de línea. Se normalizan a MAYÚSCULAS (como escribe CADAM), se
  // deduplican y se acotan — es una watchlist, no un censo del mercado.
  const crudo = String(form.get("competidores") ?? "");
  const competidores = [
    ...new Set(
      crudo
        .split(/[\n,]+/)
        .map((c) => c.trim().toUpperCase())
        .filter(Boolean)
    ),
  ];
  if (competidores.some((c) => c.length > 30 || !/^[A-ZÁÉÍÓÚÑ0-9 .&-]+$/.test(c))) {
    return { ok: false, mensaje: "Hay un nombre de competidor con caracteres raros o demasiado largo." };
  }
  if (competidores.length > 20) {
    return { ok: false, mensaje: "Máximo 20 competidores: es una watchlist, no el mercado entero." };
  }

  try {
    guardarParametros({
      metas: {
        participacion_mercado_2026_pct: participacion,
        ranking_objetivo_2026: ranking,
        unidades_objetivo_mensual: unidades,
      },
      competidores_clave: competidores,
    });
  } catch (e) {
    console.error("guardarConfiguracion:", e);
    return {
      ok: false,
      mensaje:
        "No se pudo escribir parametros.json en el servidor. Si pasa siempre, es un tema de permisos del volumen /datos.",
    };
  }

  revalidatePath("/", "layout");
  const resumen = [
    participacion !== null ? `participación ${participacion}%` : null,
    ranking !== null ? `ranking #${ranking}` : null,
    unidades !== null ? `${unidades} u./mes` : null,
  ].filter(Boolean);
  return {
    ok: true,
    mensaje: resumen.length
      ? `Guardado: ${resumen.join(" · ")} · ${competidores.length} competidores.`
      : `Guardado sin metas definidas · ${competidores.length} competidores.`,
  };
}

/** La lectura para precargar el formulario, expuesta como action para no
 *  importar `fs` desde un Client Component. */
export async function leerConfiguracion() {
  const p = getParametros();
  return { metas: p.metas, competidores: p.competidores_clave };
}
