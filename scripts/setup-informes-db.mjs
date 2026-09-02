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

    // Base de conocimiento que empuja Hermes. Tabla aparte y no otra
    // dimension de informes_competencia: aquello es una serie semanal, esto
    // es estado actual que se pisa (ver src/lib/informes/conocimiento.ts).
    await client.query(`
      create table if not exists conocimiento_competencia (
        clave          text primary key,
        titulo         text not null,
        contenido      text not null,
        origen         text not null,
        fechado_en     date,
        actualizado_en timestamptz not null default now()
      );
    `);
    console.log("Tabla conocimiento_competencia lista.");

    // Operacion propia (API de Cars, empujada por Hermes). Ver
    // src/lib/informes/propios.ts: sin importes y sin datos de clientes, a
    // proposito — la app no tiene login.
    await client.query(`
      create table if not exists venta_propia (
        periodo  text not null,
        marca    text not null,
        modelo   text not null,
        unidades integer not null,
        primary key (periodo, marca, modelo)
      );
    `);
    await client.query(`
      create table if not exists stock_propio (
        marca      text not null,
        modelo     text not null,
        estado     text not null,
        unidades   integer not null,
        reservadas integer not null,
        precio_usd integer,
        primary key (marca, modelo, estado)
      );
    `);
    await client.query(`
      create table if not exists sincronizacion_propia (
        clave          text primary key,
        actualizado_en timestamptz not null default now(),
        detalle        jsonb not null default '{}'::jsonb
      );
    `);
    console.log("Tablas de operacion propia listas.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
