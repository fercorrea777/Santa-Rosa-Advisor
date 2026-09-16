import type { Metadata } from "next";
import Link from "next/link";
import { FormularioRestablecer } from "./formulario";
import { LARGO_MINIMO_CLAVE, usuarioDeRecuperacion } from "@/lib/auth/usuarios";
import type { SearchParams } from "@/lib/periodo";

export const metadata: Metadata = {
  title: "Elegí tu clave",
  robots: { index: false, follow: false },
};

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
      <div
        className="flex min-h-screen items-center justify-center p-6"
        style={{ backgroundColor: "var(--barra)" }}
      >
        <div className="flex w-full max-w-sm flex-col gap-4 text-center">
          <h1 className="text-lg font-bold tracking-tight text-white">
            {errorBase ? "No se pudo verificar el enlace" : "Este enlace ya no sirve"}
          </h1>
          <p className="text-sm text-white/60">
            {errorBase
              ? "La base no respondió. Probá de nuevo en un rato."
              : "Venció, ya se usó o no es válido. Los enlaces valen una hora y se usan una sola vez."}
          </p>
          <p className="text-sm">
            <Link href="/entrar/olvide" className="text-white underline underline-offset-2">
              Pedir un enlace nuevo
            </Link>
            <span className="text-white/40"> · </span>
            <Link href="/entrar" className="text-white/70 underline underline-offset-2 hover:text-white">
              Volver a entrar
            </Link>
          </p>
        </div>
      </div>
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
