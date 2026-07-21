import type { PuntoMensual } from "./cadam/mercado";
import type { SerieAnio } from "@/components/charts/serie-anios-chart";

/**
 * Pasa la serie larga (anio, mes, unidades) al formato del grafico: un
 * array de 12 posiciones por anio.
 *
 * Los meses que NO vienen en los datos quedan en `null`, no en 0. Es la
 * diferencia entre "ese mes no se matriculo nada" y "ese mes no esta
 * cargado", y la spec (sec. 13) pide no confundirlos.
 */
export function serieAAnios(puntos: PuntoMensual[], anios: number[]): SerieAnio[] {
  return anios.map((anio, i) => {
    const valores: (number | null)[] = Array(12).fill(null);
    for (const p of puntos) {
      if (p.anio === anio) valores[p.mes - 1] = p.unidades;
    }
    return { anio, valores, punteada: i < anios.length - 1 };
  });
}

/** Promedio de los meses CON dato (ignora los huecos). */
export function promedioMensual(valores: (number | null)[]): number | null {
  const con = valores.filter((v): v is number => v !== null);
  if (!con.length) return null;
  return con.reduce((s, v) => s + v, 0) / con.length;
}

/** Media movil de n meses. Devuelve null donde no hay ventana completa. */
export function promedioMovil(valores: (number | null)[], n = 3): (number | null)[] {
  return valores.map((_, i) => {
    if (i < n - 1) return null;
    const ventana = valores.slice(i - n + 1, i + 1);
    if (ventana.some((v) => v === null)) return null;
    return (ventana as number[]).reduce((s, v) => s + v, 0) / n;
  });
}

/**
 * Proyeccion simple de cierre de ano: acumulado real + promedio de los
 * meses con dato aplicado a los meses que faltan.
 *
 * Es deliberadamente simple y se declara como tal en la UI: no modela
 * estacionalidad, y el mercado paraguayo la tiene (mayo 2026 = 8.219
 * matriculaciones vs junio = 3.812). No usar para comprometer objetivos.
 */
export function proyeccionCierre(valores: (number | null)[]): {
  acumulado: number;
  proyectado: number;
  mesesConDato: number;
} | null {
  const con = valores.filter((v): v is number => v !== null);
  if (con.length < 3 || con.length >= 12) return null;
  const acumulado = con.reduce((s, v) => s + v, 0);
  const promedio = acumulado / con.length;
  return {
    acumulado,
    proyectado: Math.round(acumulado + promedio * (12 - con.length)),
    mesesConDato: con.length,
  };
}
