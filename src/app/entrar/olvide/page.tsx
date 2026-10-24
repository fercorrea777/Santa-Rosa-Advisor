import type { Metadata } from "next";
import { FormularioOlvide } from "./formulario";
import { DOMINIO_CORREO } from "@/lib/auth/usuarios";
import { getI18n } from "@/lib/i18n/servidor";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
    title: t("Olvidé mi clave"),
    robots: { index: false, follow: false },
  };
}

export const dynamic = "force-dynamic";

export default function OlvidePage() {
  return <FormularioOlvide dominio={DOMINIO_CORREO} />;
}
