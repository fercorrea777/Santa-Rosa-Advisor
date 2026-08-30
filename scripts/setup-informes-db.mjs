#!/usr/bin/env node
// Crea la tabla de informes de competencia. Se corre una vez, a mano, contra
// la base apuntada por POSTGRES_URL. Usa `pg` (no @vercel/postgres): la base
// dejo de ser Neon cuando el dashboard se mudo a un Postgres propio.
import pg from "pg";

async function main() {
  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) {
    console.error("Falta POSTGRES_URL");
    process.exit(1);
  }

  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query(`
      create table if not exists informes_competencia (
        id            bigserial primary key,
        semana        date not null,
        dimension     text not null,
        contenido     text not null,
        fuentes       jsonb not null,
        generado_en   timestamptz not null default now()
      );
    `);
    await client.query(`
      create index if not exists informes_competencia_semana_dimension_idx
        on informes_competencia (semana, dimension);
    `);
    console.log("Tabla informes_competencia lista.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
