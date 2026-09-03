import { Cargando } from "@/components/ui/cargando";

/**
 * Pantalla de carga de TODA la app.
 *
 * En el App Router un `loading.tsx` en la raíz envuelve cada ruta en un
 * Suspense: se ve en cada navegación mientras el Server Component junta sus
 * datos. Con esto alcanza para "todas las recargas" — no hace falta uno por
 * pantalla.
 *
 * Importa que exista: varias pantallas consultan SQLite y Postgres antes de
 * poder dibujar, y sin este archivo Next se queda en la pantalla anterior
 * sin señal de que algo está pasando. Con tres fuentes de datos y un
 * servidor propio, ese silencio se lee como que la app se colgó.
 *
 * `min-h` y no `h-screen`: el rail y la barra de marca siguen visibles
 * arriba y al costado; esto sólo ocupa el área de contenido.
 */
export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Cargando />
    </div>
  );
}
