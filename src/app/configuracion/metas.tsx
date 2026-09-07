"use client";

import * as React from "react";
import { useActionState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { guardarMetasMensuales } from "./acciones-metas";
import type { EstadoGuardado } from "./acciones";

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

/**
 * Grilla de metas: una fila por marca, doce casilleros. Se completa lo que
 * hay; lo vacío queda sin meta. Los totales por fila y por columna se
 * calculan mientras se tipea, para que la suma del año se vea antes de
 * guardar.
 */
export function EditorMetasMensuales({
  anio,
  anios,
  marcas,
  metas,
  presupuesto = null,
  grupos = [],
  facturado = null,
}: {
  anio: number;
  anios: number[];
  marcas: string[];
  metas: Record<string, (number | null)[]>;
  /** Marcas que comparten UNA meta (GREAT WALL + HAVAL, LEAPMOTOR + JMEV):
   *  así las presupuesta Finanzas. La fila es el grupo y la meta se guarda
   *  bajo la primera marca, que es lo que /operacion compara. */
  grupos?: string[][];
  /** Lo facturado en Cars por marca y mes del año, para verlo debajo de
   *  cada meta. null = Cars no respondió. Contra esto se compara la meta:
   *  ventas propias, no matriculaciones del mercado. */
  facturado?: Record<string, number[]> | null;
  /** De dónde salió lo cargado, cuando vino del Excel de Finanzas por
   *  Hermes: versión, archivo, fechas y el presupuesto anual por marca
   *  (bajo la primera marca de cada grupo). null = grilla a mano. */
  presupuesto?: {
    version: string;
    archivo: string;
    modificado: string;
    cargado_en: string;
    anual: Record<string, number | null>;
  } | null;
}) {
  const [estado, enviar, pendiente] = useActionState<EstadoGuardado | null, FormData>(
    guardarMetasMensuales,
    null
  );
  // Una fila por grupo presupuestado; el resto, una fila por marca. La
  // meta de un grupo vive bajo su primera marca (la que guarda el form).
  const filas: { clave: string; etiqueta: string; marca: string; marcas: string[]; conjunta: boolean }[] = [];
  const enGrupo = new Set<string>();
  for (const g of grupos) {
    if (!g.length || !marcas.includes(g[0])) continue;
    filas.push({ clave: g.join("+"), etiqueta: g.join(" + "), marca: g[0], marcas: g, conjunta: g.length > 1 });
    for (const m of g) enGrupo.add(m);
  }
  for (const m of marcas) {
    if (!enGrupo.has(m)) filas.push({ clave: m, etiqueta: m, marca: m, marcas: [m], conjunta: false });
  }
  const vendido = (fila: { marcas: string[] }, i: number) =>
    facturado ? fila.marcas.reduce((s, m) => s + (facturado[m]?.[i] ?? 0), 0) : null;
  const vendidoAnio = (fila: { marcas: string[] }) =>
    facturado ? MESES.reduce((s, _, i) => s + (vendido(fila, i) ?? 0), 0) : null;
  const [valores, setValores] = React.useState<Record<string, string>>(() => {
    const v: Record<string, string> = {};
    for (const m of marcas) {
      for (let i = 0; i < 12; i++) v[`${m}|${i + 1}`] = metas[m]?.[i] != null ? String(metas[m][i]) : "";
    }
    return v;
  });
  const num = (s: string) => {
    const n = Number(s.replace(/\./g, ""));
    return Number.isFinite(n) ? n : 0;
  };
  const totalFila = (m: string) => MESES.reduce((s, _, i) => s + num(valores[`${m}|${i + 1}`] ?? ""), 0);
  const totalCol = (i: number) => filas.reduce((s, f) => s + num(valores[`${f.marca}|${i + 1}`] ?? ""), 0);
  const totalAnio = filas.reduce((s, f) => s + totalFila(f.marca), 0);
  const vendidoCol = (i: number) => (facturado ? filas.reduce((s, f) => s + (vendido(f, i) ?? 0), 0) : null);

  return (
    <form action={enviar} className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Metas de vehículos por marca y mes</CardTitle>
          <p className="text-xs text-muted-foreground">
            Contra esto se compara lo facturado en Cars (Nuestra operación), mes
            a mes y en el año: ventas propias, no matriculaciones del mercado.
            {facturado ? " Debajo de cada meta, en gris, lo facturado ese mes." : ""} Dejá
            vacío lo que no tenga meta: la app muestra «sin meta», nunca un cero.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {presupuesto && (
            <p className="rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200">
              Cargado desde <em>{presupuesto.archivo}</em> (archivo del{" "}
              {presupuesto.modificado.slice(0, 10)}, cargado el{" "}
              {presupuesto.cargado_en.slice(0, 16).replace("T", " ")} UTC, versión{" "}
              {presupuesto.version}). Lo que edites acá lo pisa la próxima carga del
              Excel. El presupuesto anual es la cifra original del año y no se edita.
            </p>
          )}
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Año</span>
            <select name="anio" defaultValue={anio} className="input-base rounded-md border bg-background px-2 py-1">
              {anios.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
            <span className="text-xs text-muted-foreground">
              (para cargar otro año, elegilo, completá y guardá)
            </span>
          </label>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="py-1 pr-2 text-left font-medium">Marca</th>
                  {MESES.map((m) => (
                    <th key={m} className="px-0.5 py-1 text-right font-medium">{m}</th>
                  ))}
                  <th className="py-1 pl-2 text-right font-medium">Año</th>
                  {presupuesto && (
                    <th className="py-1 pl-2 text-right font-medium whitespace-nowrap">Ppto. anual</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => {
                  const m = f.marca;
                  return (
                  <tr key={f.clave} className="border-t">
                    <td className="py-1 pr-2 font-medium whitespace-nowrap">
                      {f.etiqueta}
                      {f.conjunta && (
                        <span className="block text-[10px] font-normal text-muted-foreground">meta conjunta</span>
                      )}
                    </td>
                    {MESES.map((_, i) => {
                      const k = `${m}|${i + 1}`;
                      return (
                        <td key={k} className="px-0.5 py-1 align-top">
                          <input
                            name={`m_${m}_${i + 1}`}
                            type="text"
                            inputMode="numeric"
                            value={valores[k] ?? ""}
                            onChange={(e) => setValores((v) => ({ ...v, [k]: e.target.value }))}
                            // w-11: doce casilleros más el total tienen que entrar en
                            // el ancho de la tarjeta sin scroll, si no la columna
                            // "Año" queda cortada en el borde.
                            className="input-base w-11 rounded-md border bg-background px-1 py-1 text-right tabular-nums"
                            aria-label={`${f.etiqueta} ${MESES[i]}`}
                          />
                          {facturado && (
                            <span
                              className="block pr-1 text-right text-[10px] tabular-nums text-muted-foreground"
                              title={`Facturado en Cars, ${MESES[i]} ${anio}`}
                            >
                              {vendido(f, i) || "·"}
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td className="py-1 pl-2 text-right tabular-nums font-medium align-top">
                      {totalFila(m) ? totalFila(m).toLocaleString("es-PY") : "—"}
                      {facturado && (
                        <span className="block text-[10px] font-normal text-muted-foreground">
                          {(vendidoAnio(f) ?? 0).toLocaleString("es-PY")} fact.
                        </span>
                      )}
                    </td>
                    {presupuesto && (
                      <td className="py-1 pl-2 text-right tabular-nums text-muted-foreground align-top">
                        {presupuesto.anual[m] ? presupuesto.anual[m]?.toLocaleString("es-PY") : "—"}
                      </td>
                    )}
                  </tr>
                  );
                })}
                <tr className="border-t font-medium">
                  <td className="py-1 pr-2">Total</td>
                  {MESES.map((_, i) => (
                    <td key={i} className="px-0.5 py-1 text-right tabular-nums align-top">
                      {totalCol(i) ? totalCol(i).toLocaleString("es-PY") : "—"}
                      {facturado && (
                        <span className="block text-[10px] font-normal text-muted-foreground">
                          {vendidoCol(i) || "·"}
                        </span>
                      )}
                    </td>
                  ))}
                  <td className="py-1 pl-2 text-right tabular-nums">
                    {totalAnio ? totalAnio.toLocaleString("es-PY") : "—"}
                  </td>
                  {presupuesto && (
                    <td className="py-1 pl-2 text-right tabular-nums">
                      {Object.values(presupuesto.anual).reduce((s: number, v) => s + (v ?? 0), 0).toLocaleString("es-PY")}
                    </td>
                  )}
                </tr>
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={pendiente}>
              {pendiente ? "Guardando…" : "Guardar metas"}
            </Button>
            {estado && (
              <p className={estado.ok ? "text-sm text-emerald-600 dark:text-emerald-500" : "text-sm text-rose-600 dark:text-rose-500"}>
                {estado.mensaje}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
