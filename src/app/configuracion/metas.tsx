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
}: {
  anio: number;
  anios: number[];
  marcas: string[];
  metas: Record<string, (number | null)[]>;
}) {
  const [estado, enviar, pendiente] = useActionState<EstadoGuardado | null, FormData>(
    guardarMetasMensuales,
    null
  );
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
  const totalCol = (i: number) => marcas.reduce((s, m) => s + num(valores[`${m}|${i + 1}`] ?? ""), 0);
  const totalAnio = marcas.reduce((s, m) => s + totalFila(m), 0);

  return (
    <form action={enviar} className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Metas de vehículos por marca y mes</CardTitle>
          <p className="text-xs text-muted-foreground">
            Contra esto se compara lo facturado en Nuestra operación, mes a mes
            y en el año. Dejá vacío lo que no tenga meta: la app muestra
            «sin meta», nunca un cero.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
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
                </tr>
              </thead>
              <tbody>
                {marcas.map((m) => (
                  <tr key={m} className="border-t">
                    <td className="py-1 pr-2 font-medium whitespace-nowrap">{m}</td>
                    {MESES.map((_, i) => {
                      const k = `${m}|${i + 1}`;
                      return (
                        <td key={k} className="px-0.5 py-1">
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
                            aria-label={`${m} ${MESES[i]}`}
                          />
                        </td>
                      );
                    })}
                    <td className="py-1 pl-2 text-right tabular-nums font-medium">
                      {totalFila(m) ? totalFila(m).toLocaleString("es-PY") : "—"}
                    </td>
                  </tr>
                ))}
                <tr className="border-t font-medium">
                  <td className="py-1 pr-2">Total</td>
                  {MESES.map((_, i) => (
                    <td key={i} className="px-0.5 py-1 text-right tabular-nums">
                      {totalCol(i) ? totalCol(i).toLocaleString("es-PY") : "—"}
                    </td>
                  ))}
                  <td className="py-1 pl-2 text-right tabular-nums">
                    {totalAnio ? totalAnio.toLocaleString("es-PY") : "—"}
                  </td>
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
