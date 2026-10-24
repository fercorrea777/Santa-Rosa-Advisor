"use client";

import { AnimatePresence, motion } from "motion/react";
import { useFiltroUrl } from "@/lib/filtro-url";
import { useI18n } from "@/lib/i18n/cliente";
import { DURACION, SUAVE_BEZIER } from "@/lib/movimiento";

/**
 * Vuelve la pantalla a su estado sin filtros.
 *
 * Todos los filtros viven en la URL, asi que "desfiltrar todo" es
 * simplemente navegar a la ruta pelada: no hay estado escondido en
 * ningun lado que pueda quedar desincronizado.
 *
 * Solo aparece cuando hay algo que quitar, y dice CUANTOS filtros va a
 * sacar para que el usuario sepa que esta por perder antes de tocarlo.
 */
export function QuitarFiltros({ className }: { className?: string }) {
  const { t } = useI18n();
  const { puestos, limpiar } = useFiltroUrl();

  // `puestos` cuenta los filtros contando el clic que todavía viaja: sin eso,
  // el botón tardaba media consulta en aparecer o en desaparecer.
  const n = puestos.length;

  // AnimatePresence queda montado siempre (no `if (n === 0) return null`
  // arriba): es lo que permite animar la SALIDA cuando el último filtro se
  // va. Sin hijos no dibuja nada.
  return (
    <AnimatePresence initial={false}>
      {n > 0 && (
        <motion.button
          key="quitar"
          type="button"
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.85 }}
          transition={{ duration: DURACION.corta * 0.7, ease: SUAVE_BEZIER }}
          onClick={limpiar}
          title={t("Volver a mostrar todos los datos, sin ningún filtro")}
          className={
            "inline-flex h-8 items-center gap-1.5 rounded-md border border-destructive/40 " +
            "bg-destructive/10 px-2.5 text-xs font-medium text-foreground " +
            "hover:bg-destructive/20 " +
            (className ?? "")
          }
        >
          {n === 1 ? t("Quitar el filtro") : t("Quitar los {n} filtros", { n })}
        </motion.button>
      )}
    </AnimatePresence>
  );
}
