/**
 * Encabezado de sección: agrupa varias tarjetas bajo un tema.
 *
 * Es la pieza que le faltaba a la app y que el tablero de referencia usa en
 * todas sus pantallas ("SEGMENTOS", "POSICIONAMIENTO POR VERSIÓN"). Sin
 * esto, doce tarjetas seguidas se leen como una lista plana: cada una dice
 * de qué habla, pero ninguna dice dónde empieza un tema y dónde termina.
 *
 * El filete que sigue al texto no es adorno — es lo que convierte la
 * etiqueta en una división de la página. Se dibuja con `::after` en
 * globals.css (`.seccion-hd`) para que no haya un `<div>` vacío por cada
 * encabezado en el árbol de accesibilidad.
 *
 * `<h2>` y no un `<div>` con estilo: es un nivel real de encabezado y
 * quien navegue con lector de pantalla puede saltar entre secciones.
 */
export function Seccion({
  titulo,
  id,
  children,
}: {
  titulo: string;
  /** Ancla para enlazar desde otra pantalla (las tarjetas de acción de la
   *  home apuntan a "/operacion#pedido"). `scroll-mt-20` deja el encabezado
   *  debajo del header fijo al aterrizar. */
  id?: string;
  /** Las tarjetas de la sección. Van adentro para que el espaciado entre el
   *  encabezado y su contenido lo decida este componente y no cada página. */
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="flex flex-col gap-4 scroll-mt-20">
      <h2 className="seccion-hd">{titulo}</h2>
      {children}
    </section>
  );
}
