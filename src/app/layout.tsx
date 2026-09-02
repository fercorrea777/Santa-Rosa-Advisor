import type { Metadata } from "next";
import { Archivo, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/layout/app-shell";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
            {/* `sinClave` se lee ACA, en el layout, que es Server Component:
                AppShell es "use client" y ahi process.env no existe. Ver
                src/proxy.ts para por que la puerta falla abierta. */}
            <AppShell sinClave={!process.env.ADVISOR_CLAVE}>{children}</AppShell>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
