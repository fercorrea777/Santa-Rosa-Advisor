import type { NextConfig } from "next";

/**
 * Cabeceras de seguridad (Croman, 16/09/2026: "mejorar toda la seguridad
 * de la página ya que manejamos datos sensibles").
 *
 * - CSP: la página solo carga scripts, estilos, imágenes y fuentes propios.
 *   No hay ningún recurso externo (las fuentes las sirve next/font desde el
 *   propio dominio, los logos están en /public, ECharts va en el bundle).
 *   `unsafe-inline` en scripts es lo que Next necesita para hidratar sin
 *   nonces; `unsafe-eval` solo en desarrollo (HMR). `frame-ancestors` es lo
 *   que impide que otro sitio meta el tablero en un iframe: solo se permite
 *   a sí mismo y a presentacion.santarosa.lat (Croman, 17/09/2026: el
 *   tablero de Performance 0km muestra el Bubble chart como una sección
 *   propia, embebido; ver AppShell, que en ese caso va sin menú ni barra).
 *   Por eso no va X-Frame-Options: DENY —bloquearía también a ese origen— y
 *   SAMEORIGIN tampoco sirve; los navegadores actuales respetan
 *   frame-ancestors, que es más preciso.
 * - HSTS: un año; el dominio siempre va por https detrás de Cloudflare.
 * - nosniff, Referrer-Policy y Permissions-Policy: lo estándar. La URL de
 *   una pantalla filtrada (marca, modelo) no tiene por qué viajar a otro
 *   sitio en el Referer.
 * - X-Robots-Tag: nada de acá se indexa; el robots del login ya lo decía,
 *   esto lo dice para todo.
 */
const desarrollo = process.env.NODE_ENV !== "production";
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${desarrollo ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'self' https://presentacion.santarosa.lat",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  // En desarrollo se entra por http://localhost: pedir que todo suba a
  // https rompería las imágenes y el HMR.
  ...(desarrollo ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const CABECERAS = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
];

const nextConfig: NextConfig = {
  // better-sqlite3 es un modulo nativo: no se puede empaquetar con el
  // bundler, se carga en runtime desde node_modules.
  serverExternalPackages: ["better-sqlite3"],
  // En Vercel cada funcion serverless empaqueta solo los archivos que
  // detecta como usados. La base SQLite y parametros.json se leen por
  // ruta dinamica, asi que hay que incluirlos explicitamente.
  outputFileTracingIncludes: {
    "/**/*": ["./data/**"],
  },
  // No decir con qué está hecho: una cabecera menos para quien busca
  // versiones vulnerables.
  poweredByHeader: false,
  // Sin optimizador de imágenes (13/11/2026). `/_next/image` es la ruta de
  // Next que tuvo las fallas más graves de 2026 (ejecución remota de código
  // sin login con AVIF y SVG, SSRF, DoS) y el proxy la deja pasar sin sesión
  // (ver el matcher de src/proxy.ts). Acá no hace falta: el único <Image> es
  // el logo de /public (27 KB, se sirve tal cual); los logos de marca y la
  // foto de perfil ya van con <img>. Con esto la ruta responde 404 sin leer
  // nada. Si algún día hace falta optimizar fotos grandes, sacarlo a
  // conciencia y no dejar la ruta abierta a cualquiera.
  images: { unoptimized: true },
  async headers() {
    return [{ source: "/(.*)", headers: CABECERAS }];
  },
  // "/" redirige a "/mercado" (2026-09): desde el 13/11/2026 lo hace
  // src/proxy.ts, DESPUÉS de pasar http a https. Las `redirects()` de acá
  // corren antes que el proxy, y con http "/" contestaba 307 a http://… sin
  // subir a https (aviso W01 de la revisión de seguridad).
};

export default nextConfig;
