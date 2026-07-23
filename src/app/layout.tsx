import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/layout/app-shell";

// Inter reemplaza a Nunito Sans (pedido del usuario 2026-07-23: "mejorar
// las fuentes", con una referencia de grotesca nítida). Nunito es redonda y
// amable pero a cuerpo chico pierde filo; Inter mantiene la x-height alta
// que exige la doble distancia (PRODUCT.md) con terminaciones rectas que
// leen más precisas en labels y tablas.
const sans = Inter({
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
  title: "Mercado Automotor PY | Santa Rosa Comercial Advisor",
  description:
    "Inteligencia comercial del mercado automotor paraguayo — matriculaciones e importaciones (CADAM).",
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
            <AppShell>{children}</AppShell>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
