import type { Metadata } from "next";
import Link from "next/link";
import { FormularioRestablecer } from "./formulario";
import { MarcoAcceso } from "@/components/acceso/marco-acceso";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LARGO_MINIMO_CLAVE, usuarioDeRecuperacion } from "@/lib/auth/usuarios";
import type { SearchParams } from "@/lib/periodo";
import { getI18n } from "@/lib/i18n/servidor";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
    title: t("Elegí tu clave"),
    robots: { index: false, follow: false },
  };
}

export const dynamic = "force-dynamic";

/**
 * Destino del enlace del correo (/restablecer?token=…). Si el token no vale
 * se dice acá, antes de pedir nada; si vale, se muestra a quién pertenece
 * y se pide la clave nueva.
 */
export default async function RestablecerPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { t } = await getI18n();
  const sp = await searchParams;
  const token = (Array.isArray(sp.token) ? sp.token[0] : sp.token) ?? "";
  let persona = null;
  let errorBase: string | null = null;
  try {
    persona = token ? await usuarioDeRecuperacion(token) : null;
  } catch (e) {
    errorBase = (e as Error).message;
  }

  if (!persona) {
    return (
      <MarcoAcceso
        estado="error"
        titulo={errorBase ? t("No se pudo verificar el enlace") : t("Este enlace ya no sirve")}
        subtitulo={
          errorBase
            ? t("La base no respondió. Probá de nuevo en un rato.")
            : t("Venció, ya se usó o no es válido. Los enlaces valen una hora y se usan una sola vez.")
        }
      >
        <div className="flex flex-col gap-3">
          <Link
            href="/entrar/olvide"
            className={cn(buttonVariants(), "h-11 w-full rounded-xl text-[0.95rem]")}
          >
            {t("Pedir un enlace nuevo")}
          </Link>
          <Link
            href="/entrar"
            className={cn(buttonVariants({ variant: "outline" }), "h-11 w-full rounded-xl text-[0.95rem]")}
          >
            {t("Volver a entrar")}
          </Link>
        </div>
      </MarcoAcceso>
    );
  }

  return (
    <FormularioRestablecer
      token={token}
      correo={persona.usuario}
      nombre={persona.nombre}
      minimo={LARGO_MINIMO_CLAVE}
    />
  );
}
