import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * «Mi clave» era una pantalla suelta, colgada del pie del menú. Pasó a ser una
 * sección de «Mi cuenta», junto con la foto y los datos. Esta ruta queda viva
 * para los enlaces que ya existan (favoritos, correos) y lleva directo al
 * formulario de clave.
 */
export default function MiClavePage() {
  redirect("/mi-cuenta#clave");
}
