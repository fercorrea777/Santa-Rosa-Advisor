import type { Metadata } from "next";
import { Nunito_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/layout/app-shell";

// Nunito Sans: geometrica de terminaciones redondeadas y x-height alta, la
// referencia que pidio el usuario. Se carga en el rango de pesos que usa la
// app (400 texto, 600 etiquetas, 700/800 titulos y cifras).
const sans = Nunito_Sans({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
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
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <TooltipProvider>
            <AppShell>{children}</AppShell>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
