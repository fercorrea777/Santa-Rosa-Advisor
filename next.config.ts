import type { NextConfig } from "next";

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
  // "/" redirige a "/mercado" (2026-09). Las dos eran panoramas del mismo
  // dato y "Resumen del mercado" es la más completa: trae el toggle
  // matriculación/importación, las dos evoluciones y los cortes de segmento
  // y tecnología. Al sacar "Inicio" del menú, "/" quedaba alcanzable solo
  // por el logo y sin marcar ningún ítem como activo.
  //
  // permanent: false (307) a propósito: un 308 se cachea en el navegador y
  // volver atrás obliga a limpiar caché en cada máquina. src/app/page.tsx
  // queda en el repo — de ahí salen las 4 tarjetas que todavía no están en
  // /mercado si se quieren portar.
  async redirects() {
    return [{ source: "/", destination: "/mercado", permanent: false }];
  },
};

export default nextConfig;
