import type { Metadata, Viewport } from "next";
import { Archivo, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/layout/app-shell";
import { ProveedorMovimiento } from "@/components/movimiento/proveedor";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { vigenciaDe } from "@/lib/auth/vigencia";
import { leerSesion, NOMBRE_COOKIE } from "@/lib/auth/sesion";

// Historia: Nunito Sans -> Inter (2026-07-23, "mejorar las fuentes") ->
// Archivo (2026-08-27, "que sea mas moderno").
//
// El criterio de la iteracion anterior se mantiene y es correcto: la doble
// distancia de PRODUCT.md (notebook a 1 m + proyector a 5 m) exige x-height
// alta y terminaciones rectas, que es lo que Nunito no daba a cuerpo chico.
//
// Archivo cumple lo mismo — grotesca americana de x-height alta y remates
// rectos, dibujada para rendir igual en titular y en cuerpo de tabla — pero
// tiene caracter propio. Inter es funcionalmente impecable y visualmente
// anonima: es la sans por defecto de casi toda interfaz generada, y en un
// tablero que se proyecta en una reunion eso se nota. Archivo conserva la
// precision y agrega presencia.
const sans = Archivo({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
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

export const metadata: Metadata = {
  // Dominio canónico de la app. Con esto Next resuelve las URL absolutas
  // (Open Graph, canonical) contra advisor.santarosa.lat, así el enlace
  // muestra una vista previa correcta al compartirlo (WhatsApp, etc.).
  // El .vercel.app sigue funcionando como alias del mismo deploy.
  metadataBase: new URL("https://advisor.santarosa.lat"),
  title: {
    default: "Mercado Automotor PY | Santa Rosa Comercial Advisor",
    template: "%s · Mercado Automotor PY",
  },
  description:
    "Inteligencia comercial del mercado automotor paraguayo — matriculaciones e importaciones (CADAM).",
  applicationName: "Mercado Automotor PY",
  openGraph: {
    type: "website",
    siteName: "Mercado Automotor PY",
    title: "Mercado Automotor PY | Santa Rosa Comercial Advisor",
    description:
      "Matriculaciones e importaciones del mercado automotor paraguayo (CADAM), con rankings, market share y evolución.",
    url: "/",
    locale: "es_PY",
  },
};

// `color-scheme` YA está declarado en globals.css (`:root`/`.dark`, es lo
// que en verdad tiñe scrollbars y controles nativos); este <meta> es la
// segunda mitad de la guía modern-web-guidance "dark-mode" — evita el
// flash de fondo blanco/negro en el primer paint, ANTES de que llegue el
// CSS. No decide el tema (eso lo sigue haciendo next-themes vía la clase
// en <html>): solo le avisa al navegador que la página soporta los dos.
export const viewport: Viewport = {
  colorScheme: "light dark",
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
  const sesion = clave
    ? leerSesion((await cookies()).get(NOMBRE_COOKIE)?.value, clave)
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

  return (
    <html
      lang="es"
      data-scroll-behavior="smooth"
      className={`${sans.variable} ${mono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        {/* defaultTheme="light" sin enableSystem: el claro es el tema
            principal del producto — abre en blanco para todos, y el oscuro
            queda como elección explícita del toggle. */}
        <ThemeProvider attribute="class" defaultTheme="light">
          <TooltipProvider>
            <ProveedorMovimiento>
              {/* `sinClave` se lee ACA, en el layout, que es Server Component:
                  AppShell es "use client" y ahi process.env no existe. Ver
                  src/proxy.ts para por que la puerta falla abierta. */}
              <AppShell sinClave={!clave} esAdmin={esAdmin}>
                {children}
              </AppShell>
            </ProveedorMovimiento>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
