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
import { getI18n } from "@/lib/i18n/servidor";
import { N_ } from "@/lib/i18n/traducir";
import { IconSalir } from "@/components/icons";
import { FormularioMiClave } from "../mi-clave/formulario";
import { FotoPerfil } from "./foto-perfil";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Mi cuenta") };
}
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
  const { t, fmt } = await getI18n();
  const { formatFecha, formatFechaHora } = fmt;
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
  const rol = persona ? (ETIQUETA_ROL[persona.rol] ?? persona.rol) : null;

  return (
    <Pagina>
      <PageHeader
        titulo={t("Mi cuenta")}
        descripcion={
          esCuenta
            ? t("Tu foto, tus datos y tu clave.")
            : t("Esta sesión no es una cuenta personal.")
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-start">
        <Card>
          <CardHeader>
            <CardTitle>{t("Perfil")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <FotoPerfil
              // El avatar usa el nombre solo para las iniciales y el color: se le pasa el de origen
              // (castellano) para que sea el mismo en los dos idiomas y que el del menú.
              nombre={persona?.nombre ?? (sesion ? N_("Acceso de emergencia") : "Invitado" /* i18n-ignore */)}
              fotoUrl={urlDeFoto(persona?.foto_version)}
              puedeCambiar={esCuenta && !!persona}
            />

            {persona ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-bold tracking-tight">{persona.nombre}</h2>
                  <Badge variant="secondary">{rol && t(rol)}</Badge>
                </div>
                <dl className="grid gap-x-8 gap-y-4 border-t border-border pt-5 text-sm sm:grid-cols-2">
                  <Dato etiqueta={t("Correo")} valor={persona.usuario} corte />
                  <Dato
                    etiqueta={t("Qué podés hacer")}
                    valor={
                      persona.rol === "admin"
                        ? t("Ver todo y administrar usuarios, metas y marcas.")
                        : t("Ver todo menos Configuración y Rentabilidad.")
                    }
                  />
                  <Dato etiqueta={t("Último acceso")} valor={formatFechaHora(persona.ultimo_acceso)} />
                  <Dato etiqueta={t("Cuenta creada")} valor={formatFecha(persona.creado_en)} />
                </dl>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                {baseCaida
                  ? t("No se pudieron leer tus datos (la base no responde). Probá de nuevo en un rato.")
                  : sesion
                    ? t("Entraste con la clave general del equipo (acceso de emergencia). Abre una sesión de administrador por un día y no tiene foto, correo ni clave propia. Para tener lo tuyo, entrá con tu correo.")
                    : t("El tablero no tiene claves configuradas: cualquiera con la URL entra, y no hay cuentas que mostrar.")}
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
                <CardTitle>{t("Sesión")}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center justify-between gap-3">
                <p className="max-w-xs text-xs text-muted-foreground">
                  {t("Cerrala si estás en una computadora que no es tuya o si vas a dejar la reunión.")}
                </p>
                <form action={salir}>
                  <Button type="submit" variant="outline">
                    <IconSalir size={15} />
                    {t("Cerrar sesión")}
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
        {/* i18n-ignore (nombre del producto + versión) */}
        Advisor · {version ?? t("desarrollo")}
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
