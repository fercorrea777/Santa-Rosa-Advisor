import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dashboard/page-header";
import { Pagina } from "@/components/movimiento/pagina";
import { leerSesion, NOMBRE_COOKIE } from "@/lib/auth/sesion";
import { getPerfil } from "@/lib/auth/usuarios";
import { ETIQUETA_ROL, urlDeFoto } from "@/lib/auth/perfil";
import { salir } from "@/app/entrar/acciones";
import { formatFecha, formatFechaHora } from "@/lib/format";
import { IconSalir } from "@/components/icons";
import { FormularioMiClave } from "../mi-clave/formulario";
import { FotoPerfil } from "./foto-perfil";

export const metadata: Metadata = { title: "Mi cuenta" };
export const dynamic = "force-dynamic";

/**
 * «Mi cuenta»: lo de cada persona, en un solo lugar — la foto, los datos con
 * los que entra y el cambio de clave. Es el mismo apartado que tienen los otros
 * tableros de la casa (Gestión de Compras, Selección SRPY), y a él lleva la
 * tarjeta de perfil de arriba del menú.
 *
 * Reemplaza a «Mi clave», que era solo el formulario de clave colgado del pie
 * del menú; esa ruta redirige acá.
 */
export default async function MiCuentaPage() {
  const clave = process.env.ADVISOR_CLAVE;
  const sesion = clave
    ? leerSesion((await cookies()).get(NOMBRE_COOKIE)?.value, clave)
    : null;

  let persona: Awaited<ReturnType<typeof getPerfil>> = null;
  let baseCaida = false;
  if (sesion?.tipo === "usuario") {
    try {
      persona = await getPerfil(sesion.id);
    } catch {
      // Si la base no responde igual se muestra la pantalla: el error real
      // aparece al intentar guardar algo, con su motivo.
      baseCaida = true;
    }
  }
  const esCuenta = sesion?.tipo === "usuario";
  const version = process.env.SOURCE_COMMIT?.slice(0, 7);

  return (
    <Pagina>
      <PageHeader
        titulo="Mi cuenta"
        descripcion={
          esCuenta
            ? "Tu foto, tus datos y tu clave."
            : "Esta sesión no es una cuenta personal."
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-start">
        <Card>
          <CardHeader>
            <CardTitle>Perfil</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <FotoPerfil
              nombre={persona?.nombre ?? (sesion ? "Acceso de emergencia" : "Invitado")}
              fotoUrl={urlDeFoto(persona?.foto_version)}
              puedeCambiar={esCuenta && !!persona}
            />

            {persona ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-extrabold tracking-tight">{persona.nombre}</h2>
                  <Badge variant="secondary">{ETIQUETA_ROL[persona.rol] ?? persona.rol}</Badge>
                </div>
                <dl className="grid gap-x-8 gap-y-4 border-t border-border pt-5 text-sm sm:grid-cols-2">
                  <Dato etiqueta="Correo" valor={persona.usuario} corte />
                  <Dato
                    etiqueta="Qué podés hacer"
                    valor={
                      persona.rol === "admin"
                        ? "Ver todo y administrar usuarios, metas y marcas."
                        : "Ver todo menos Configuración y Rentabilidad."
                    }
                  />
                  <Dato etiqueta="Último acceso" valor={formatFechaHora(persona.ultimo_acceso)} />
                  <Dato etiqueta="Cuenta creada" valor={formatFecha(persona.creado_en)} />
                </dl>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                {baseCaida
                  ? "No se pudieron leer tus datos (la base no responde). Probá de nuevo en un rato."
                  : sesion
                    ? "Entraste con la clave general del equipo (acceso de emergencia). Abre una sesión de administrador por un día y no tiene foto, correo ni clave propia. Para tener lo tuyo, entrá con tu correo."
                    : "El tablero no tiene claves configuradas: cualquiera con la URL entra, y no hay cuentas que mostrar."}
              </p>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          {esCuenta && (
            <div id="clave" className="scroll-mt-20">
              <FormularioMiClave
                quien={persona ? `${persona.nombre} (${persona.usuario})` : null}
              />
            </div>
          )}

          {sesion && (
            <Card>
              <CardHeader>
                <CardTitle>Sesión</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center justify-between gap-3">
                <p className="max-w-xs text-xs text-muted-foreground">
                  Cerrala si estás en una computadora que no es tuya o si vas a dejar la reunión.
                </p>
                <form action={salir}>
                  <Button type="submit" variant="outline">
                    <IconSalir size={15} />
                    Cerrar sesión
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* El commit sirve para saber si un redeploy tomó cuando alguien dice que
          algo «sigue igual». translate="no": es un identificador, no texto. */}
      <p className="text-center font-mono text-[11px] tabular-nums text-muted-foreground" translate="no">
        Advisor · {version ?? "desarrollo"}
      </p>
    </Pagina>
  );
}

function Dato({ etiqueta, valor, corte = false }: { etiqueta: string; valor: string; corte?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {etiqueta}
      </dt>
      <dd className={corte ? "mt-0.5 break-all" : "mt-0.5"}>{valor}</dd>
    </div>
  );
}
