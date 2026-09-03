import { cookies } from "next/headers";
import { PageHeader } from "@/components/dashboard/page-header";
import { leerSesion, NOMBRE_COOKIE } from "@/lib/auth/sesion";
import { getUsuario } from "@/lib/auth/usuarios";
import { FormularioMiClave } from "./formulario";

export const dynamic = "force-dynamic";

/**
 * Cambiar la propia clave. No esta en el menu lateral —no es una pantalla de
 * analisis— sino colgada del pie del rail, al lado de "Cerrar sesion", que es
 * donde uno va a buscar las cosas de su propia cuenta.
 */
export default async function MiClavePage() {
  const clave = process.env.ADVISOR_CLAVE;
  const sesion = clave
    ? leerSesion((await cookies()).get(NOMBRE_COOKIE)?.value, clave)
    : null;

  let quien: string | null = null;
  if (sesion?.tipo === "usuario") {
    try {
      const persona = await getUsuario(sesion.id);
      quien = persona ? `${persona.nombre} (${persona.usuario})` : null;
    } catch {
      // Si la base no responde igual se muestra el formulario: el error real
      // aparece al intentar guardar, con el motivo.
      quien = null;
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        titulo="Mi clave"
        descripcion="Cambiá la clave con la que entrás al tablero."
      />
      <div className="mx-auto w-full max-w-md">
        <FormularioMiClave quien={quien} />
      </div>
    </div>
  );
}
