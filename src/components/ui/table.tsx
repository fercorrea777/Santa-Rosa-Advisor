"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto"
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
        className
      )}
      {...props}
    />
  )
}

function TableHead({
  className,
  nota,
  children,
  ...props
}: React.ComponentProps<"th"> & {
  /**
   * Segundo renglon del encabezado: que significa esa columna, en criollo y
   * en minusculas. El rotulo en mayusculas nombra el dato ("CUMPLIMIENTO");
   * esto dice como leerlo ("facturado sobre plan del periodo").
   *
   * Nace de un reclamo concreto: la explicacion de la tabla entera vivia en
   * un parrafo de 8 renglones arriba, en letra chica, y para saber que era
   * una columna habia que volver a leerlo entero y adivinar cual frase le
   * tocaba. Al lado del rotulo no hay nada que adivinar.
   *
   * Va corto — cuatro o cinco palabras. Y solo donde hace falta: "MARCA" o
   * "STOCK" no necesitan traduccion y una nota ahi es ruido.
   */
  nota?: string
}) {
  return (
    <th
      data-slot="table-head"
      // Lo lee globals.css para arrancar TODOS los rotulos de la fila en la
      // misma linea: si no, los que no tienen nota flotan al medio.
      data-nota={nota ? "si" : undefined}
      // Los encabezados van chicos, en mayusculas y apagados A PROPOSITO:
      // en una tabla de datos el protagonista es el numero, no el rotulo.
      // Antes competian (mismo tamano y peso similar que las celdas) y la
      // tabla entera se leia "floja" — el reclamo fue que las letras se
      // veian poco.
      className={cn(
        "px-2 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap text-muted-foreground [&:has([role=checkbox])]:pr-0",
        // Con nota el alto fijo no alcanza. El min-w es lo que evita que la
        // nota se deshilache: en una columna numerica el ancho lo decide el
        // numero ("2.1%"), y sin piso la nota caia a una palabra por renglon.
        nota ? "h-auto min-w-[6.5rem] py-2 align-top" : "h-10 align-middle",
        className
      )}
      {...props}
    >
      {nota ? (
        <span className="block">
          <span className="block">{children}</span>
          {/* normal-case + tracking-normal: el rotulo grita en mayusculas,
              la nota habla. font-normal para que no compita con el. */}
          <span className="mt-1 block max-w-[24ch] text-[10px] leading-snug font-normal normal-case tracking-normal whitespace-normal opacity-75">
            {nota}
          </span>
        </span>
      ) : (
        children
      )}
    </th>
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      // py-2.5 (antes p-2): las filas de datos necesitan aire para que el
      // ojo separe una de otra sin zebra ni bordes fuertes.
      className={cn(
        "px-2 py-2.5 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
