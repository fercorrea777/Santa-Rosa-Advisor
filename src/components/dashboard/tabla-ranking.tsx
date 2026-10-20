"use client";

import * as React from "react";
import { useFiltroUrl } from "@/lib/filtro-url";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { LogoMarca } from "@/components/dashboard/logo-marca";
import { DetalleModeloDialog } from "@/components/dashboard/detalle-modelo";
import { cn } from "@/lib/utils";
import { CambioPosicion, Variacion, ParteYPuesto } from "@/components/dashboard/celdas-ranking";
import { formatPct, formatUnidades } from "@/lib/format";
import {
  claveModelo, detalleDeFicha, type DetalleModelo, type ModeloFicha,
} from "@/lib/cadam/bandas";
import type { FilaRanking } from "@/lib/cadam/mercado";

type Campo = "posicion" | "marca" | "modelo" | "segmento" | "unidades"
  | "participacion" | "variacion" | "cambioPosicion"
  | "participacionMercado";

const TOPES = [5, 10, 20, 50, 0] as const;

/**
 * Tabla de ranking con orden por cualquier columna, busqueda, tope
 * Top N, exportacion a CSV y marcado de marcas propias (spec sec. 14).
 *
 * Las posiciones se calculan una sola vez en el servidor sobre el ranking
 * completo: reordenar aca cambia como se LISTA, no la posicion real de
 * cada marca.
 */
export function TablaRanking({
  filas,
  columnaClave = "Marca",
  mostrarModelo = false,
  mostrarSegmento = false,
  nombreArchivo = "ranking",
  notaVariacion,
  filtrarPor,
  etiquetaModelo = "Modelo",
  fichas,
  periodo = "",
  fuente = "matriculacion",
}: {
  filas: FilaRanking[];
  columnaClave?: string;
  mostrarModelo?: boolean;
  mostrarSegmento?: boolean;
  nombreArchivo?: string;
  notaVariacion?: string;
  /** Los modelos en plano: con esto cada fila se abre y muestra contra
   *  quién compite. La ficha se arma en el navegador al tocar (ver
   *  detalleDeFicha); sin esto, tabla normal. */
  fichas?: ModeloFicha[];
  periodo?: string;
  fuente?: "matriculacion" | "importacion";
  /**
   * Si se pasa, cada fila filtra la pagina al hacerle clic. `marca` es el
   * parametro que recibe la columna de marca; `detalle` el de la columna
   * de modelo/version (cuando se muestra).
   */
  filtrarPor?: { marca?: string; detalle?: string };
  etiquetaModelo?: string;
}) {
  const [orden, setOrden] = React.useState<{ campo: Campo; asc: boolean }>({
    campo: "posicion", asc: true,
  });
  const [abierto, setAbierto] = React.useState<DetalleModelo | null>(null);
  /** La ficha de una fila, si la hay. Las filas de MARCA no tienen: la ficha
   *  es de un modelo (su clase, sus rivales), no de una marca entera. */
  const clavesConFicha = React.useMemo(
    () => new Set((fichas ?? []).map((x) => x.clave)),
    [fichas]
  );
  const tieneFicha = (f: FilaRanking) =>
    !!f.modelo && clavesConFicha.has(claveModelo(f.marca, f.modelo));
  const abrirFicha = (f: FilaRanking) => {
    if (!fichas || !f.modelo) return;
    setAbierto(detalleDeFicha(fichas, claveModelo(f.marca, f.modelo)) ?? null);
  };
  const [busqueda, setBusqueda] = React.useState("");
  const [tope, setTope] = React.useState<number>(20);
  // Con un filtro puesto las filas traen ADEMÁS el puesto y la participación en
  // el mercado entero (ver conPuestoDeMercado): `posicion` y `participacion`
  // pasan a ser «dentro del filtro» y se agregan las del mercado.
  const conMercado = filas.some((f) => f.posicionMercado !== undefined);

  // La mecánica de "que el filtro se quede quieto" vive en el hook.
  const { leer: filtroDe, alternar: alternarFiltro, pendiente } = useFiltroUrl();

  const filtradas = React.useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const base = q
      ? filas.filter((f) =>
          f.marca.toLowerCase().includes(q) ||
          (f.modelo ?? "").toLowerCase().includes(q))
      : filas;
    const dir = orden.asc ? 1 : -1;
    const val = (f: FilaRanking) => {
      const v = f[orden.campo];
      return v === null || v === undefined ? (orden.asc ? Infinity : -Infinity) : v;
    };
    const ordenadas = [...base].sort((a, a2) => {
      const va = val(a), vb = val(a2);
      if (typeof va === "string" || typeof vb === "string") {
        return String(va).localeCompare(String(vb)) * dir;
      }
      return ((va as number) - (vb as number)) * dir;
    });
    return tope > 0 ? ordenadas.slice(0, tope) : ordenadas;
  }, [filas, busqueda, orden, tope]);

  const exportar = () => {
    const cab = ["Posicion", "Marca"];
    if (mostrarModelo) cab.push("Modelo");
    if (mostrarSegmento) cab.push("Segmento");
    cab.push("Unidades", conMercado ? "Participacion en el filtro %" : "Participacion %");
    if (conMercado) cab.push("Participacion mercado %", "Posicion mercado");
    cab.push("Variacion %", "Unidades periodo anterior", "Posicion anterior", "Cambio posicion", "Marca propia");
    const filasCsv = filtradas.map((f) => {
      const c: (string | number)[] = [f.posicion, f.marca];
      if (mostrarModelo) c.push(f.modelo ?? "");
      if (mostrarSegmento) c.push(f.segmento ?? "");
      c.push(f.unidades, (f.participacion * 100).toFixed(2));
      if (conMercado) {
        c.push(
          f.participacionMercado == null ? "" : (f.participacionMercado * 100).toFixed(2),
          f.posicionMercado ?? "",
        );
      }
      c.push(
        f.variacion === null ? "" : (f.variacion * 100).toFixed(2),
        f.unidadesAnterior,
        f.posicionAnterior ?? "",
        f.cambioPosicion ?? "",
        f.esPropia ? "si" : "no",
      );
      return c;
    });
    const csv = [cab, ...filasCsv]
      .map((r) => r.map((c) => (typeof c === "string" && /[;"\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(";"))
      .join("\n");
    // BOM para que Excel en es-PY abra los acentos bien
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${nombreArchivo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // compacta: sin el piso de 6,5 rem que TableHead le pone a una columna con
  // nota. Con las dos medidas (mercado y filtro) la tabla suma columnas, y en un
  // ranking de modelos (10) esos pisos la llevaban a 1138 px: más que el área de
  // contenido de un monitor de 1440.
  const th = (campo: Campo, label: string, alinearDerecha = false, nota?: string, compacta = false) => (
    <TableHead className={cn(alinearDerecha && "text-right", compacta && "min-w-0")} nota={nota}>
      <button
        type="button"
        onClick={() =>
          setOrden((o) => ({ campo, asc: o.campo === campo ? !o.asc : campo === "posicion" || campo === "marca" }))
        }
        className={cn(
          // La tabla es sm+ (en móvil son tarjetas), pero una tablet entra
          // acá con dedo: sin min-h el botón de ordenar mide el alto del
          // texto (~18px).
          // uppercase repetido a proposito: el th ya lo tiene, pero el
          // preflight de Tailwind resetea text-transform en <button> y el
          // heredado se pierde. Sin esto, rankings quedaba en minuscula
          // mientras el resto de las tablas va en mayuscula.
          "inline-flex items-center gap-1 uppercase tracking-wider pointer-coarse:min-h-11 hover:text-foreground",
          alinearDerecha && "flex-row-reverse",
          orden.campo === campo ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {label}
        <span aria-hidden="true" className="text-[10px] leading-none opacity-70">
          {orden.campo !== campo ? "⇅" : orden.asc ? "▲" : "▼"}
        </span>
      </button>
    </TableHead>
  );

  if (!filas.length) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No hay datos para este filtro.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar marca o modelo…"
          className="input-base w-56"
        />
        <div className="flex items-center gap-1">
          {TOPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTope(t)}
              className={cn(
                // pointer-coarse: mínimo táctil. Van pegados (gap-1), así que
                // crecen de verdad en vez de expandir área invisible: dos hit
                // areas superpuestas en un grupo se pifian entre sí.
                "h-8 rounded-md px-2.5 text-xs font-medium pointer-coarse:h-11",
                tope === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              )}
            >
              {t === 0 ? "Todos" : `Top ${t}`}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={exportar}
          className="ml-auto inline-flex h-8 items-center rounded-md border px-2.5 text-xs font-medium pointer-coarse:h-11 hover:bg-muted"
        >
          Exportar CSV
        </button>
      </div>

      {/* Mobile (< sm, ~640px): lista de tarjetas. Reusa las mismas subcomponentes
          (Filtrable, Variacion, CambioPosicion, badge "propia") que la tabla de
          abajo — no hay logica duplicada, solo una composicion distinta. Antes
          de esto, la tabla de 6-8 columnas obligaba a deslizar el dedo para ver
          "Unidades" y "Marcas propias", que es justo lo que mas importa. */}
      <div
        aria-busy={pendiente}
        className={cn("flex flex-col divide-y transition-opacity sm:hidden", pendiente && "opacity-60")}
      >
        {filtradas.map((f) => {
          const ficha = tieneFicha(f);
          return (
          <div
            key={f.clave}
            className={cn(
              "flex flex-col gap-1.5 py-3",
              f.esPropia && "-mx-3 rounded-md bg-primary/5 px-3"
            )}
            onClick={ficha ? () => abrirFicha(f) : undefined}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2">
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {f.posicion}
                </span>
                <LogoMarca marca={f.marca} />
                <span className="min-w-0 truncate font-medium">
                  <Filtrable
                    param={filtrarPor?.marca}
                    valor={f.marca}
                    activo={filtrarPor?.marca ? filtroDe(filtrarPor.marca) === f.marca : false}
                    onToggle={alternarFiltro}
                  />
                </span>
                {f.esPropia && <Badge className="h-5 shrink-0 px-1.5 text-[10px]">propia</Badge>}
              </span>
              <span className="shrink-0 text-xs">
                <CambioPosicion cambio={f.cambioPosicion} anterior={f.posicionAnterior} />
              </span>
            </div>
            {(mostrarModelo || mostrarSegmento) && (
              <div className="truncate pl-6 text-xs text-muted-foreground">
                {mostrarModelo && (
                  <Filtrable
                    param={filtrarPor?.detalle}
                    valor={f.modelo ?? ""}
                    activo={filtrarPor?.detalle ? filtroDe(filtrarPor.detalle) === f.modelo : false}
                    onToggle={alternarFiltro}
                  />
                )}
                {mostrarModelo && mostrarSegmento && " · "}
                {mostrarSegmento && f.segmento}
              </div>
            )}
            {conMercado && (
              <p className="pl-6 text-xs text-muted-foreground">
                En el mercado: <span className="font-medium text-foreground">{f.posicionMercado ? `#${f.posicionMercado}` : "—"}</span>
                {" · "}
                <span className="tabular-nums">{f.participacionMercado == null ? "—" : formatPct(f.participacionMercado)}</span>
              </p>
            )}
            <div className="flex items-baseline justify-between pl-6">
              {/* Unidades es el numero que se viene a buscar: mono, grande,
                  tal como pide DESIGN.md para cifras que se leen a distancia. */}
              <span className="font-mono text-lg font-semibold tabular-nums">
                {formatUnidades(f.unidades)}
              </span>
              <span className="flex items-center gap-3 text-xs">
                <span className="tabular-nums text-muted-foreground" title={conMercado ? "Participación dentro del filtro" : undefined}>
                  {formatPct(f.participacion)}{conMercado ? " del filtro" : ""}
                </span>
                <Variacion v={f.variacion} entrante={f.unidadesAnterior === 0} />
              </span>
            </div>
          </div>
          );
        })}
      </div>

      <div
        aria-busy={pendiente}
        className={cn("hidden overflow-x-auto transition-opacity sm:block", pendiente && "opacity-60")}
      >
        <Table>
          <TableHeader>
            <TableRow>
              {th("posicion", "#", false, conMercado ? "en el filtro" : undefined, true)}
              {th("marca", columnaClave)}
              {mostrarModelo && th("modelo", etiquetaModelo)}
              {mostrarSegmento && th("segmento", "Segmento")}
              {th("unidades", "Unidades", true, "las del período", conMercado)}
              {conMercado && th("participacionMercado", "Mercado", true, "parte y puesto, sin filtros", true)}
              {th("participacion", conMercado ? "Part. filtro" : "Part.", true, conMercado ? "sobre lo filtrado" : "su parte del mercado")}
              {th("variacion", "Var.", true, "contra el año pasado", conMercado)}
              {th("cambioPosicion", "Pos.", true, "puestos que subió o bajó", conMercado)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtradas.map((f) => {
              const ficha = tieneFicha(f);
              return (
              <TableRow
                key={f.clave}
                className={cn(
                  f.esPropia && "bg-primary/5 hover:bg-primary/10",
                  ficha && "cursor-pointer"
                )}
                onClick={ficha ? () => abrirFicha(f) : undefined}
                title={ficha ? `Ver contra quién compite ${f.modelo}` : undefined}
              >
                <TableCell className="tabular-nums text-muted-foreground">{f.posicion}</TableCell>
                <TableCell className="font-medium">
                  <span className="inline-flex items-center gap-2">
                    <LogoMarca marca={f.marca} />
                    <Filtrable
                      param={filtrarPor?.marca}
                      valor={f.marca}
                      activo={filtrarPor?.marca ? filtroDe(filtrarPor.marca) === f.marca : false}
                      onToggle={alternarFiltro}
                    />
                    {f.esPropia && <Badge className="h-5 px-1.5 text-[10px]">propia</Badge>}
                  </span>
                </TableCell>
                {mostrarModelo && (
                  <TableCell className="text-muted-foreground">
                    <Filtrable
                      param={filtrarPor?.detalle}
                      valor={f.modelo ?? ""}
                      activo={
                        filtrarPor?.detalle ? filtroDe(filtrarPor.detalle) === f.modelo : false
                      }
                      onToggle={alternarFiltro}
                    />
                  </TableCell>
                )}
                {mostrarSegmento && (
                  <TableCell className="text-muted-foreground">{f.segmento}</TableCell>
                )}
                <TableCell className="text-right tabular-nums">{formatUnidades(f.unidades)}</TableCell>
                {conMercado && (
                  <TableCell className="text-right tabular-nums">
                    <ParteYPuesto parte={f.participacionMercado} puesto={f.posicionMercado} />
                  </TableCell>
                )}
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {formatPct(f.participacion)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  <Variacion v={f.variacion} entrante={f.unidadesAnterior === 0} />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  <CambioPosicion cambio={f.cambioPosicion} anterior={f.posicionAnterior} />
                </TableCell>
              </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        Mostrando {filtradas.length} de {filas.length}.
        {conMercado
          ? " «Mercado» es la parte y el puesto sobre el mercado entero, sin filtros; «#» y «Part. filtro», sobre lo que queda con el filtro."
          : ""}
        {notaVariacion ? ` ${notaVariacion}` : ""}
        {fichas ? " Tocá una fila para ver contra quién compite ese modelo." : ""}
      </p>

      <DetalleModeloDialog
        detalle={abierto}
        periodo={periodo}
        fuente={fuente}
        onClose={() => setAbierto(null)}
      />
    </div>
  );
}

/** Celda que filtra al hacerle clic. Si no hay `param`, es texto plano:
 *  asi la misma tabla sirve en pantallas donde el filtro no aplica. */
function Filtrable({
  param, valor, activo, onToggle,
}: {
  param?: string;
  valor: string;
  activo: boolean;
  onToggle: (param: string, valor: string) => void;
}) {
  if (!param) return <>{valor}</>;
  return (
    <button
      type="button"
      onClick={() => onToggle(param, valor)}
      aria-pressed={activo}
      title={activo ? "Quitar filtro" : `Filtrar por ${valor}`}
      className={cn(
        "rounded px-1 -mx-1 text-left underline-offset-4 hover:underline",
        activo && "bg-primary/15 font-medium text-foreground underline"
      )}
    >
      {valor}
    </button>
  );
}
