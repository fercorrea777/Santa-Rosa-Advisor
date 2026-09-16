import type { Metadata } from "next";
import { FormularioOlvide } from "./formulario";
import { DOMINIO_CORREO } from "@/lib/auth/usuarios";

export const metadata: Metadata = {
  title: "Olvidé mi clave",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function OlvidePage() {
  return <FormularioOlvide dominio={DOMINIO_CORREO} />;
}
