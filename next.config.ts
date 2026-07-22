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
};

export default nextConfig;
