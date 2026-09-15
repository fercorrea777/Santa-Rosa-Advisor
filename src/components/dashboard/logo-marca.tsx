import { LOGOS_MARCA } from "@/lib/marcas-logo";
import { cn } from "@/lib/utils";

/**
 * El logo de una marca, en un chip blanco.
 *
 * Lo pidió Croman con una captura del informe que reciben de CADAM: una
 * tabla de ranking donde cada fila lleva el emblema y se reconoce de un
 * vistazo. Nuestras tablas eran texto en mayúsculas, "muy cargado". El ojo
 * lee un emblema mucho antes que una palabra en versalitas, y en una tabla
 * de veinte marcas eso es la diferencia entre escanear y leer.
 *
 * CHIP BLANCO SIEMPRE, también en modo oscuro. Los logos vienen con fondo
 * transparente y muchos son negros (Jetour, Lynk&Co, Zeekr): sobre el panel
 * oscuro desaparecerían. El chip es el mismo recurso que usa el informe de
 * referencia y da un lienzo constante, así todos se ven igual de bien.
 *
 * SIN LOGO -> MONOGRAMA. Hay ~40 marcas chicas (JIM, GOTEGO, LMT…) que no
 * están en ningún dataset. Se dibuja un chip con las dos primeras letras en
 * vez de dejar el hueco, así la columna mantiene el ritmo visual y la fila
 * no parece rota.
 */

const TAMANOS = {
  /** En tablas densas y listas: 28 px de alto. Se probó a 24 y los
   *  wordmarks (CHEVROLET, HYUNDAI) quedaban ilegibles: un emblema aguanta
   *  chico, una palabra no. */
  sm: { chip: "h-7 w-11", img: "max-h-5 max-w-9", texto: "text-[10px]" },
  /** Fichas, encabezados de tarjeta, tarjetas móviles: 32 px. */
  md: { chip: "h-8 w-12", img: "max-h-6 max-w-10", texto: "text-[11px]" },
  /** Destacados: la ficha de un modelo, el título de una batalla. */
  lg: { chip: "h-10 w-16", img: "max-h-7 max-w-14", texto: "text-xs" },
} as const;

export type TamanoLogo = keyof typeof TAMANOS;

/** Archivo del logo para una marca, o null si no hay. Normaliza el nombre
 *  como lo escriben CADAM y Cars (mayúsculas, espacios simples). */
export function archivoLogo(marca: string | null | undefined): string | null {
  if (!marca) return null;
  const clave = marca.trim().toUpperCase().replace(/\s+/g, " ");
  const slug = LOGOS_MARCA[clave];
  return slug ? `/marcas/${slug}.png` : null;
}

function monograma(marca: string): string {
  const partes = marca.trim().split(/[\s/&-]+/).filter(Boolean);
  if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase();
  return marca.trim().slice(0, 2).toUpperCase();
}

export function LogoMarca({
  marca,
  tamano = "sm",
  className,
}: {
  marca: string;
  tamano?: TamanoLogo;
  className?: string;
}) {
  const t = TAMANOS[tamano];
  const src = archivoLogo(marca);
  return (
    <span
      // shrink-0: en una celda con nombre largo el chip no se aplasta.
      // bg-white fijo a propósito (ver arriba): no es un token del tema.
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md border border-black/[0.08] bg-white",
        t.chip,
        className
      )}
      // El nombre va al lado en texto; el chip es decorativo para el lector
      // de pantalla, si no leería la marca dos veces.
      aria-hidden="true"
    >
      {src ? (
        // <img> y no next/image: son 105 PNG chicos ya optimizados y se
        // renderizan decenas por tabla. El loader de next/image agregaría una
        // request de transformación por logo y un layout shift hasta que
        // llegue; acá el alto está fijado por el chip.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          className={cn("object-contain", t.img)}
        />
      ) : (
        <span className={cn("font-semibold tracking-wide text-neutral-500", t.texto)}>
          {monograma(marca)}
        </span>
      )}
    </span>
  );
}

/**
 * Logo + nombre, que es como va en casi todos lados. El nombre se queda
 * porque el logo solo no alcanza: se busca por texto, se ordena por texto, y
 * hay 40 marcas que solo tienen monograma.
 */
export function Marca({
  marca,
  tamano = "sm",
  className,
  claseNombre,
  children,
}: {
  marca: string;
  tamano?: TamanoLogo;
  className?: string;
  claseNombre?: string;
  /** Lo que va después del nombre (un badge "propia", por ejemplo). */
  children?: React.ReactNode;
}) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      <LogoMarca marca={marca} tamano={tamano} />
      <span className={cn("truncate", claseNombre)}>{marca}</span>
      {children}
    </span>
  );
}
