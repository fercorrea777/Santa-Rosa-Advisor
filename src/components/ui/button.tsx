import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  // Radio subido de rounded-lg (8px) a rounded-xl (~11px, --radius-xl):
  // 8px leía duro/anguloso al lado de las tiles de 22px del bento. Sombra
  // de elevación en vez del glow neón (ese era el acento del tema
  // telemetría oscuro; en el bento claro se reserva para dark mode).
  // active:scale-[0.97] — feedback táctil de press (la referencia 2026-07
  // es toda gesto de apretar); compone con el translate-y-px vía las
  // utilities `scale`/`translate` de Tailwind v4 (props separadas, no el
  // shorthand `transform`, así no se pisan). transition-[...] explícito en
  // vez de transition-all: sólo color/sombra/transform, nunca layout.
  "group/button inline-flex shrink-0 items-center justify-center rounded-xl border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-[color,background-color,box-shadow,border-color,scale,translate] duration-150 outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px active:not-aria-[haspopup]:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_1px_2px_oklch(0.2_0.03_257/8%),0_6px_14px_-8px_var(--primary)] transition-[background-color,box-shadow] hover:bg-primary/90 hover:shadow-[0_2px_4px_oklch(0.2_0.03_257/10%),0_10px_20px_-8px_var(--primary)] dark:shadow-[0_0_0_0_var(--primary)] dark:hover:shadow-[0_0_16px_-2px_var(--primary)]",
        outline:
          "border-border bg-card hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
      },
      // `pointer-coarse:` = dedo, no mouse. La escala de arriba (32-36px) es
      // la densidad que pide el tablero en escritorio, pero queda por debajo
      // del mínimo táctil (44pt Apple / 48dp Material): en celular esos
      // mismos botones se pifian. Los altos crecen SOLO cuando el dispositivo
      // apunta con dedo — el mouse ve exactamente lo de siempre.
      //
      // `xs`/`icon-xs` son la excepción deliberada: quedan en 36px porque su
      // razón de ser es la densidad extrema (chips dentro de una fila). No
      // usarlos para acciones primarias en móvil; si hace falta, agrandar el
      // área tocable con un pseudo-elemento (ver InfoTip en kpi-card.tsx) en
      // vez de estirar el botón.
      size: {
        default:
          "h-8 gap-1.5 px-2.5 pointer-coarse:h-11 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs pointer-coarse:h-9 in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] pointer-coarse:h-11 in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 pointer-coarse:h-11 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8 pointer-coarse:size-11",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] pointer-coarse:size-9 in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] pointer-coarse:size-11 in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9 pointer-coarse:size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
