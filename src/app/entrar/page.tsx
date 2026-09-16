import type { Metadata } from "next";
import { FormularioLogin } from "./formulario";
import { DOMINIO_CORREO } from "@/lib/auth/usuarios";
import type { SearchParams } from "@/lib/periodo";

export const metadata: Metadata = {
  title: "Entrar",
  // Una pantalla de login no aporta nada a un buscador y sí revela que el
  // tablero existe. Que no la indexe.
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const AVISOS: Record<string, string> = {
  "clave-lista": "Tu clave quedó guardada. Entrá con tu correo y la clave nueva.",
  "sesion-cortada": "Tu sesión se cerró porque cambió tu clave, tu rol o tu acceso. Volvé a entrar.",
  vencida: "Tu sesión venció. Volvé a entrar.",
};

export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const d = uno(sp.destino);
  const aviso = AVISOS[uno(sp.aviso) ?? ""];
  return (
    <FormularioLogin
      destino={d ?? "/mercado"}
      dominio={DOMINIO_CORREO}
      emergencia={uno(sp.modo) === "emergencia"}
      aviso={aviso}
    />
  );
}
