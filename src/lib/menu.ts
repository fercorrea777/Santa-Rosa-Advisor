/**
 * Cookie donde se recuerda si el menú lateral está plegado a solo íconos.
 *
 * Es una cookie y no localStorage para que el SERVIDOR dibuje el ancho
 * correcto desde el primer byte: con localStorage el menú nacería ancho y
 * saltaría a angosto al hidratar, en cada carga. Vive en un módulo propio (y no
 * dentro de app-shell.tsx) porque el layout, que es de servidor, tiene que
 * leer el nombre, y un módulo "use client" no puede exportar valores a un
 * componente de servidor.
 */
export const COOKIE_MENU = "advisor_menu";
export const MENU_PLEGADO = "plegado";
export const MENU_DESPLEGADO = "desplegado";
