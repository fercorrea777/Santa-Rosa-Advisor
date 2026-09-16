"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { DURACION, gsap, menosMovimiento, SUAVE } from "@/lib/movimiento"

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div
      data-slot="table-container"
      className="tabla-scroll relative w-full overflow-x-auto"
    >
      {/* Fundido en el borde derecho mientras haya más columnas para ver
          (ver .tabla-pista en globals.css). */}
      <span aria-hidden="true" className="tabla-pista" />
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

/** Cuántas filas entran en cascada. Las que siguen aparecen de una: en una
 *  tabla de cien filas nadie mira la fila cuarenta entrar, y escalonar
 *  cien es un segundo y medio de espera. */
const FILAS_EN_CASCADA = 24

function TableBody({ className, children, ...props }: React.ComponentProps<"tbody">) {
  const ref = React.useRef<HTMLTableSectionElement>(null)

  // Firma de la lista: las keys de las filas, en orden. El efecto corre
  // cuando cambia ESO —otra lista, otro orden— y no en cada re-render del
  // padre (un hover, una pestaña), que con `children` como dependencia
  // haría parpadear la tabla sin que nada haya cambiado.
  const firma = React.Children.toArray(children)
    .map((c) => (React.isValidElement(c) ? String(c.key) : "?"))
    .join("|")

  // Las filas entran en cascada, con GSAP sobre el DOM que ya está: un
  // <tr> del servidor no necesita volverse componente para animarse.
  // useLayoutEffect y no useEffect: el `from` deja las filas en opacidad 0
  // ANTES del primer frame; con useEffect se verían enteras un instante y
  // después entrarían.
  React.useLayoutEffect(() => {
    const cuerpo = ref.current
    if (!cuerpo || menosMovimiento()) return
    const filas = Array.from(cuerpo.children).slice(0, FILAS_EN_CASCADA)
    if (filas.length < 2) return
    const tween = gsap.from(filas, {
      autoAlpha: 0,
      y: 6,
      duration: DURACION.corta + 0.1,
      ease: SUAVE,
      stagger: 0.025,
      clearProps: "opacity,visibility,transform",
    })
    // Pestaña de fondo: rAF no corre, el timer sí. Ver movimiento/cifra.tsx.
    const respaldo = window.setTimeout(() => tween.progress(1), 1500)
    return () => {
      // Si la lista cambia a mitad de la cascada, lo que quedó a medias
      // se ve entero al toque: una fila a medio aparecer no es un estado.
      window.clearTimeout(respaldo)
      tween.kill()
      gsap.set(filas, { clearProps: "opacity,visibility,transform" })
    }
  }, [firma])

  return (
    <tbody
      ref={ref}
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    >
      {children}
    </tbody>
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
