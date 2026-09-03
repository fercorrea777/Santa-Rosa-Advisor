/**
 * Indicador de carga: cuatro anillos que se persiguen.
 *
 * Base tomada de Uiverse.io (Nawsome, CC0) y adaptada: los cuatro colores
 * originales eran rojo/naranja/azul/rosa sueltos. Acá salen de --chart-1..4,
 * la paleta categórica del tablero que ya está validada para daltonismo, así
 * que el loader pertenece al mismo sistema que los gráficos en vez de ser
 * una isla de color.
 *
 * `role="status"` + texto para lector de pantalla: una animación sin nombre
 * es invisible para quien no la ve, y "cargando" es justamente lo que hay
 * que anunciar.
 *
 * `prefers-reduced-motion` lo deja quieto (ver globals.css): son cuatro
 * animaciones simultáneas de 2 s en bucle, exactamente lo que esa
 * preferencia existe para apagar. Quieto sigue leyéndose como indicador
 * porque los anillos quedan visibles.
 */
export function Cargando({
  etiqueta = "Cargando…",
  className,
}: {
  /** Qué se está cargando. Se anuncia y no se dibuja. */
  etiqueta?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={["flex flex-col items-center justify-center gap-3", className]
        .filter(Boolean)
        .join(" ")}
    >
      <svg className="pl" viewBox="0 0 240 240" aria-hidden="true">
        {/* Los cuatro radios están calculados contra los stroke-dasharray de
            las animaciones (660/220/440/440): tocar un radio sin recalcular
            su dasharray rompe el ciclo y el anillo queda a tirones. */}
        <circle
          className="pl__ring pl__ring--a"
          cx="120" cy="120" r="105"
          fill="none" strokeWidth="20" strokeDasharray="0 660"
          strokeDashoffset="-330" strokeLinecap="round"
        />
        <circle
          className="pl__ring pl__ring--b"
          cx="120" cy="120" r="35"
          fill="none" strokeWidth="20" strokeDasharray="0 220"
          strokeDashoffset="-110" strokeLinecap="round"
        />
        <circle
          className="pl__ring pl__ring--c"
          cx="85" cy="120" r="70"
          fill="none" strokeWidth="20" strokeDasharray="0 440"
          strokeLinecap="round"
        />
        <circle
          className="pl__ring pl__ring--d"
          cx="155" cy="120" r="70"
          fill="none" strokeWidth="20" strokeDasharray="0 440"
          strokeLinecap="round"
        />
      </svg>
      <span className="text-sm text-muted-foreground">{etiqueta}</span>
    </div>
  );
}
