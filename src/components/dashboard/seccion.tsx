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
  children,
}: {
  titulo: string;
  /** Las tarjetas de la sección. Van adentro para que el espaciado entre el
   *  encabezado y su contenido lo decida este componente y no cada página. */
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="seccion-hd">{titulo}</h2>
      {children}
    </section>
  );
}
