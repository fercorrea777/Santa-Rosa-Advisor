import type { Metadata } from "next";
import { FormularioLogin } from "./formulario";
import type { SearchParams } from "@/lib/periodo";

export const metadata: Metadata = {
  title: "Entrar",
  // Una pantalla de login no aporta nada a un buscador y sí revela que el
  // tablero existe. Que no la indexe.
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const d = Array.isArray(sp.destino) ? sp.destino[0] : sp.destino;
  return <FormularioLogin destino={d ?? "/mercado"} />;
}
