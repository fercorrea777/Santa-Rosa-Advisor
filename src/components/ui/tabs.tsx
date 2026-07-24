"use client"

import * as React from "react"
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn(
        "group/tabs flex gap-2 data-horizontal:flex-col",
        className
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  // `relative`: ancla al indicador deslizante (posición absoluta) que se
  // inyecta como hijo de la lista.
  "group/tabs-list relative inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-muted-foreground group-data-horizontal/tabs:h-8 group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        // bg-muted quedaba casi idéntico al lienzo bento (--muted y
        // --background muy cercanos en luminosidad): el "riel" del control
        // segmentado era invisible. bg-foreground/N es un gris adaptativo
        // (deriva de --foreground, funciona igual en claro y oscuro) con
        // contraste real contra el lienzo.
        default: "bg-foreground/[0.055] dark:bg-foreground/10",
        line: "gap-1 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  children,
  ...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
  const listRef = React.useRef<HTMLDivElement | null>(null)
  const [rect, setRect] = React.useState<
    { left: number; top: number; width: number; height: number } | null
  >(null)

  // Indicador deslizante propio. base-ui expone --active-tab-* pero
  // transicionar una var() sin registrar la congela (bug de CSS), y el
  // registro por @property no engancha en el dev de Turbopack. Acá se mide
  // el tab activo (offset relativo a la lista, que es `relative`) y se
  // posiciona con transform:translate + width/height en px REALES, que sí
  // interpolan siempre. Un MutationObserver sobre data-active recalcula al
  // cambiar de tab; un ResizeObserver, al reacomodarse el layout.
  React.useLayoutEffect(() => {
    const list = listRef.current
    if (!list || variant === "line") return
    const medir = () => {
      const activo = list.querySelector<HTMLElement>(
        '[data-slot="tabs-trigger"][data-active]'
      )
      if (activo) {
        setRect({
          left: activo.offsetLeft,
          top: activo.offsetTop,
          width: activo.offsetWidth,
          height: activo.offsetHeight,
        })
      }
    }
    medir()
    const mo = new MutationObserver(medir)
    mo.observe(list, {
      attributes: true,
      subtree: true,
      attributeFilter: ["data-active", "aria-selected"],
    })
    const ro = new ResizeObserver(medir)
    ro.observe(list)
    return () => {
      mo.disconnect()
      ro.disconnect()
    }
  }, [variant])

  return (
    <TabsPrimitive.List
      ref={listRef}
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    >
      {variant !== "line" && rect && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 z-0 rounded-md bg-card shadow-[0_1px_2px_oklch(0.2_0.03_257/6%),0_2px_6px_-2px_oklch(0.2_0.05_260/12%)] transition-[transform,width,height] duration-200 ease-out dark:border dark:border-input dark:bg-input/40 dark:shadow-none"
          style={{
            transform: `translate(${rect.left}px, ${rect.top}px)`,
            width: rect.width,
            height: rect.height,
          }}
        />
      )}
      {children}
    </TabsPrimitive.List>
  )
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        // z-10: el texto se apoya ARRIBA de la píldora deslizante (z-0).
        "relative z-10 inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md px-1.5 py-0.5 text-sm font-medium whitespace-nowrap text-foreground/60 transition-colors group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-active:text-foreground dark:text-muted-foreground dark:hover:text-foreground dark:data-active:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        // Variant line: subrayado animado en vez de píldora.
        "after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:bottom-[-5px] group-data-horizontal/tabs:after:h-0.5 group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-right-1 group-data-vertical/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("flex-1 text-sm outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
