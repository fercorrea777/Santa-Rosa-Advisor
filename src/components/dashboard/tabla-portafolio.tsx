"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { DetalleModeloDialog } from "@/components/dashboard/detalle-modelo";
import { cn } from "@/lib/utils";
import { formatPct, formatUnidades } from "@/lib/format";
import { claveModelo, detalleDeFicha, type DetalleModelo, type ModeloFicha } from "@/lib/cadam/bandas";

export interface FilaPortafolio {
  modelo: string;
  clase: string;
  claseInferida: boolean;
  tecnologia?: string;
  /** Matriculadas en el período, y su parte dentro de la marca. */
  unidades: number;
  participacion: number;
  variacion: number | null;
  /** Importadas en el período (cruzadas por nombre; null = sin equivalente
   *  en la base de importación). */
  importadas: number | null;
  /** Versiones distintas que la DNRA registró para el modelo. */
  versionesDnra: number;
  precioDesde: number | null;
  precioHasta: number | null;
  versionesConPrecio: number;
  fuentePrecio: string | null;
  banda: string;
}

const usd = (n: number | null) => (n === null ? "—" : `US$ ${formatUnidades(Math.round(n))}`);

/**
 * La gama de una marca en una tabla: cada modelo con su clase, cuánto
 * vende, cuánto entró al país y a qué precio de lista. Tocar una fila abre
 * la ficha del modelo (sus rivales de clase y el precio de cada uno), la
 * misma de Rankings y Gama propia.
 */
export function TablaPortafolio({
  marca,
  filas,
  fichas,
  periodo,
}: {
  marca: string;
  filas: FilaPortafolio[];
  fichas: ModeloFicha[];
  periodo: string;
}) {
  const [abierto, setAbierto] = React.useState<DetalleModelo | null>(null);
  const [orden, setOrden] = React.useState<{ campo: keyof FilaPortafolio; asc: boolean }>({
    campo: "unidades", asc: false,
  });

  const clavesConFicha = React.useMemo(() => new Set(fichas.map((f) => f.clave)), [fichas]);
  const abrir = (f: FilaPortafolio) => {
    const clave = claveModelo(marca, f.modelo);
    if (!clavesConFicha.has(clave)) return;
    setAbierto(detalleDeFicha(fichas, clave) ?? null);
  };

  const ordenadas = React.useMemo(() => {
    const dir = orden.asc ? 1 : -1;
    const val = (f: FilaPortafolio) => {
      const v = f[orden.campo];
      return v === null || v === undefined ? (orden.asc ? Infinity : -Infinity) : v;
    };
    return [...filas].sort((a, b) => {
      const va = val(a), vb = val(b);
      if (typeof va === "string" || typeof vb === "string") {
        return String(va).localeCompare(String(vb)) * dir;
      }
      return (Number(va) - Number(vb)) * dir;
    });
  }, [filas, orden]);

  const ordenarPor = (campo: keyof FilaPortafolio) =>
    setOrden((o) => ({ campo, asc: o.campo === campo ? !o.asc : campo === "modelo" || campo === "clase" }));
  const cab = (campo: keyof FilaPortafolio, texto: string, nota?: string, className?: string) => (
    <Cabecera campo={campo} texto={texto} nota={nota} className={className} orden={orden} onClick={ordenarPor} />
  );

  return (
    <div className="flex flex-col gap-3">
      <Table>
        <TableHeader>
          <TableRow>
            {cab("modelo", "Modelo")}
            {cab("clase", "Clase", "contra quién compite")}
            <TableHead nota="según la DNRA">Tecnología</TableHead>
            {cab("unidades", "Unidades", "matriculadas en el período", "text-right")}
            {cab("participacion", "Peso", "su parte dentro de la marca", "text-right")}
            {cab("variacion", "Var.", "contra el año pasado", "text-right")}
            {cab("importadas", "Import.", "entraron al país en el período", "text-right")}
            {cab("precioDesde", "Desde", "lista, versión más barata", "text-right")}
            {cab("precioHasta", "Hasta", "lista, versión más cara", "text-right")}
            <TableHead className="text-right" nota="con precio / según DNRA">Versiones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ordenadas.map((f) => {
            const conFicha = clavesConFicha.has(claveModelo(marca, f.modelo));
            return (
              <TableRow
                key={f.modelo}
                onClick={conFicha ? () => abrir(f) : undefined}
                className={cn(conFicha && "cursor-pointer")}
                title={conFicha ? "Ver contra quién compite" : undefined}
              >
                <TableCell className="font-medium">{f.modelo}</TableCell>
                <TableCell className="text-muted-foreground">
                  {f.clase}
                  {f.claseInferida && (
                    <span title="Clase inferida por precio o segmento, no del catálogo" className="ml-1 opacity-60">~</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">{f.tecnologia ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{formatUnidades(f.unidades)}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">{formatPct(f.participacion)}</TableCell>
                <TableCell
                  className={cn(
                    "text-right tabular-nums",
                    f.variacion !== null && (f.variacion > 0 ? "text-emerald-600 dark:text-emerald-500" : f.variacion < 0 ? "text-rose-600 dark:text-rose-500" : "")
                  )}
                >
                  {f.variacion === null ? "Nuevo" : formatPct(f.variacion, { signed: true })}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {f.importadas === null ? "—" : formatUnidades(f.importadas)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {usd(f.precioDesde)}
                  {f.fuentePrecio && (
                    <Badge variant="outline" className="ml-1.5 px-1 text-[9px] font-normal uppercase">
                      {f.fuentePrecio}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {f.precioHasta !== null && f.precioDesde !== null && f.precioHasta > f.precioDesde ? usd(f.precioHasta) : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {f.versionesConPrecio} / {f.versionesDnra}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <p className="text-xs text-muted-foreground">
        {filas.length} modelos. Tocá una fila para ver contra quién compite ese modelo y a qué precio.
        «~» junto a la clase: inferida por precio o segmento, no del catálogo.
      </p>
      <DetalleModeloDialog detalle={abierto} periodo={periodo} onClose={() => setAbierto(null)} />
    </div>
  );
}

/** Encabezado que ordena. Fuera del componente de la tabla: un componente
 *  creado adentro del render se remonta en cada pasada. */
function Cabecera({
  campo, texto, nota, className, orden, onClick,
}: {
  campo: keyof FilaPortafolio;
  texto: string;
  nota?: string;
  className?: string;
  orden: { campo: keyof FilaPortafolio; asc: boolean };
  onClick: (campo: keyof FilaPortafolio) => void;
}) {
  const activo = orden.campo === campo;
  return (
    <TableHead className={className} nota={nota}>
      <button
        type="button"
        onClick={() => onClick(campo)}
        className={cn("inline-flex items-center gap-1 uppercase", activo && "text-foreground")}
      >
        {texto}
        <span aria-hidden="true" className="text-[9px] opacity-70">
          {activo ? (orden.asc ? "▲" : "▼") : "⇅"}
        </span>
      </button>
    </TableHead>
  );
}
