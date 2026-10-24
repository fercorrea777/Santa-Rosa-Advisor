"use client";

import * as React from "react";
import { crearI18n, I18N_ES, type I18n } from "./crear";
import type { Idioma } from "./idioma";
import type { Catalogo } from "./traducir";

/**
 * El idioma para los componentes de cliente.
 *
 * El layout (servidor) lee la cookie y monta este proveedor con el idioma y,
 * solo en inglés, las frases que usan los componentes de cliente. Dentro,
 * `useI18n()` da lo mismo que `getI18n()` en el servidor: `t`, `tr`, `fmt`.
 * El mismo `idioma` y las mismas frases viajan en el render del servidor (SSR)
 * y en el del navegador, así que no hay diferencia de hidratación.
 *
 * Sin proveedor (un test, una vista aislada) el contexto vale castellano.
 */
const Contexto = React.createContext<I18n>(I18N_ES);

export function ProveedorI18n({
  idioma,
  mensajes,
  children,
}: {
  idioma: Idioma;
  mensajes: Catalogo | null;
  children: React.ReactNode;
}) {
  const valor = React.useMemo(() => crearI18n(idioma, mensajes), [idioma, mensajes]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useI18n(): I18n {
  return React.useContext(Contexto);
}
