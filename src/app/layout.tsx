import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/layout/app-shell";
import { ProveedorMovimiento } from "@/components/movimiento/proveedor";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { vigenciaDe } from "@/lib/auth/vigencia";
import { perfilDe } from "@/lib/auth/perfil";
import { leerSesion, NOMBRE_COOKIE } from "@/lib/auth/sesion";
import { COOKIE_MENU, MENU_PLEGADO } from "@/lib/menu";
import { getI18n, getMensajesCliente } from "@/lib/i18n/servidor";
import { ProveedorI18n } from "@/lib/i18n/cliente";

// Historia: Nunito Sans -> Inter (2026-07-23, "mejorar las fuentes") ->
// Archivo (2026-08-27, "que sea mas moderno") -> Inter (2026-10-24, Croman:
// "mejorar la fuente, usar la familia de Inter").
//
// El criterio se mantiene: la doble distancia de PRODUCT.md (notebook a 1 m +
// proyector a 5 m) exige x-height alta y terminaciones rectas.
//
// Inter es la variable completa (todos los pesos) con el eje de tamano optico
// (`opsz`, 14-32): el navegador lo aplica solo (`font-optical-sizing: auto`), asi
// el cuerpo de tabla usa el corte de texto (aberturas amplias, espaciado
// holgado) y los titulos y las cifras grandes el corte "Display" (trazo fino,
// espaciado cerrado), sin cargar una segunda familia.
const sans = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  axes: ["opsz"],
  display: "swap",
});

// JetBrains Mono para las cifras: el par sans + mono es un contraste real
// (geometrica vs. monoespaciada), no dos sans parecidas. Ademas sus digitos
// son inconfundibles entre si a distancia, que es lo que se necesita en la
// pantalla de la reunion.
const mono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const { t, idioma } = await getI18n();
  const titulo = t("Mercado Automotor PY | Santa Rosa Comercial Advisor");
  return {
    // Dominio canónico de la app. Con esto Next resuelve las URL absolutas
    // (Open Graph, canonical) contra advisor.santarosa.lat, así el enlace
    // muestra una vista previa correcta al compartirlo (WhatsApp, etc.).
    // El .vercel.app sigue funcionando como alias del mismo deploy.
    metadataBase: new URL("https://advisor.santarosa.lat"),
    title: {
      default: titulo,
      template: t("%s · Mercado Automotor PY"),
    },
    description: t(
      "Inteligencia comercial del mercado automotor paraguayo — matriculaciones e importaciones (CADAM)."
    ),
    applicationName: t("Mercado Automotor PY"),
    openGraph: {
      type: "website",
      siteName: t("Mercado Automotor PY"),
      title: titulo,
      description: t(
        "Matriculaciones e importaciones del mercado automotor paraguayo (CADAM), con rankings, market share y evolución."
      ),
      url: "/",
      locale: idioma === "en" ? "en_US" : "es_PY",
    },
  };
}

// `color-scheme` YA está declarado en globals.css (`:root`/`.dark`, es lo
// que en verdad tiñe scrollbars y controles nativos); este <meta> es la
// segunda mitad de la guía modern-web-guidance "dark-mode" — evita el
// flash de fondo blanco/negro en el primer paint, ANTES de que llegue el
// CSS. No decide el tema (eso lo sigue haciendo next-themes vía la clase
// en <html>): solo le avisa al navegador que la página soporta los dos.
export const viewport: Viewport = {
  colorScheme: "light dark",
  // El navy de la barra de marca (--barra en claro): en el celular tiñe la
  // barra del navegador del mismo color que la nuestra, así la cabecera se lee
  // como una sola pieza. Es el color de una barra que existe en los dos
  // temas; el oscuro la baja un punto, una diferencia que no se nota.
  themeColor: "#1b1c4e",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // El rol se resuelve ACA porque es el unico lugar con acceso a la cookie
  // que envuelve a todas las pantallas. Sale del token FIRMADO, no de una
  // consulta: la puerta ya lo valido y repetir el trabajo en cada render no
  // agrega seguridad, solo latencia. Sin clave configurada no hay sesiones y
  // todo el mundo ve todo, que es lo mismo que ya pasaba.
  const clave = process.env.ADVISOR_CLAVE;
  const almacen = await cookies();
  const sesion = clave
    ? leerSesion(almacen.get(NOMBRE_COOKIE)?.value, clave)
    : null;
  // La firma cerró, pero ¿la cuenta sigue viva y con la misma versión de
  // sesión? (baja, cambio de clave o de rol). La puerta no puede mirar la
  // base en cada request; acá sí, con caché de un minuto (vigencia.ts). Si
  // no, a la salida: la ruta borra la cookie y manda a entrar. Las
  // pantallas públicas (/entrar, /restablecer) no pasan por acá con sesión.
  if (sesion && (await vigenciaDe(sesion)) === "cortada") {
    redirect("/api/sesion/cerrar?motivo=sesion-cortada");
  }
  const esAdmin = !clave || sesion?.rol === "admin";
  // Quién está mirando, para la tarjeta de perfil del menú (nombre, rol, foto).
  // Con la misma caché de un minuto que la vigencia, y si la base no responde
  // el menú se arma igual, sin foto.
  const perfil = sesion ? await perfilDe(sesion) : null;
  // El menú plegado se recuerda en una cookie para que el servidor dibuje el
  // ancho correcto desde el primer byte (ver lib/menu.ts).
  const menuPlegadoInicial = almacen.get(COOKIE_MENU)?.value === MENU_PLEGADO;
  // `?embed=1` (el iframe de presentacion.santarosa.lat): el layout no ve la
  // query, así que la puerta la deja en una cabecera. Ver src/proxy.ts.
  const embebidoPorUrl = (await headers()).get("x-advisor-embed") === "1";
  // El idioma sale de la cookie `advisor_idioma` (castellano si no hay). Los
  // componentes de cliente reciben, en inglés, solo las frases que usan.
  const { idioma } = await getI18n();
  const mensajes = await getMensajesCliente(idioma);

  return (
    <html
      lang={idioma}
      data-scroll-behavior="smooth"
      className={`${sans.variable} ${mono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        {/* defaultTheme="light" sin enableSystem: el claro es el tema
            principal del producto — abre en blanco para todos, y el oscuro
            queda como elección explícita del toggle. */}
        <ProveedorI18n idioma={idioma} mensajes={mensajes}>
        <ThemeProvider attribute="class" defaultTheme="light">
          <TooltipProvider>
            <ProveedorMovimiento>
              {/* `sinClave` se lee ACA, en el layout, que es Server Component:
                  AppShell es "use client" y ahi process.env no existe. Ver
                  src/proxy.ts para por que la puerta falla abierta. */}
              <AppShell
                sinClave={!clave}
                esAdmin={esAdmin}
                embebidoPorUrl={embebidoPorUrl}
                perfil={perfil}
                menuPlegadoInicial={menuPlegadoInicial}
              >
                {children}
              </AppShell>
            </ProveedorMovimiento>
          </TooltipProvider>
        </ThemeProvider>
        </ProveedorI18n>
      </body>
    </html>
  );
}
