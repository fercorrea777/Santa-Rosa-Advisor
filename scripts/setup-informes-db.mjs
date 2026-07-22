#!/usr/bin/env node
import { sql } from "@vercel/postgres";

async function main() {
  await sql`
    create table if not exists informes_competencia (
      id            bigserial primary key,
      semana        date not null,
      dimension     text not null,
      contenido     text not null,
      fuentes       jsonb not null,
      generado_en   timestamptz not null default now()
    );
  `;
  await sql`
    create index if not exists informes_competencia_semana_dimension_idx
      on informes_competencia (semana, dimension);
  `;
  console.log("Tabla informes_competencia lista.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
