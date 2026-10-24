import type { Metadata } from "next";
import { FormularioLogin } from "./formulario";
import { DOMINIO_CORREO } from "@/lib/auth/usuarios";
import type { SearchParams } from "@/lib/periodo";
import { getI18n } from "@/lib/i18n/servidor";
import { N_ } from "@/lib/i18n/traducir";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
    title: t("Entrar"),
    // Una pantalla de login no aporta nada a un buscador y sí revela que el
    // tablero existe. Que no la indexe.
    robots: { index: false, follow: false },
  };
}

export const dynamic = "force-dynamic";

// N_: el aviso se traduce abajo, en el idioma del pedido.
const AVISOS: Record<string, string> = {
  "clave-lista": N_("Tu clave quedó guardada. Entrá con tu correo y la clave nueva."),
  "sesion-cortada": N_("Tu sesión se cerró porque cambió tu clave, tu rol o tu acceso. Volvé a entrar."),
  vencida: N_("Tu sesión venció. Volvé a entrar."),
};

export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { t } = await getI18n();
  const sp = await searchParams;
  const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const d = uno(sp.destino);
  const avisoBase = AVISOS[uno(sp.aviso) ?? ""];
  const aviso = avisoBase ? t(avisoBase) : undefined;
  return (
    <FormularioLogin
      destino={d ?? "/mercado"}
      dominio={DOMINIO_CORREO}
      emergencia={uno(sp.modo) === "emergencia"}
      aviso={aviso}
    />
  );
}
