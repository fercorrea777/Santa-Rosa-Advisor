import { getPool } from "./db";

/**
 * Datos de la OPERACION PROPIA de Santa Rosa, que llegan del API de Cars
 * (el DMS de la casa) empujados por Hermes.
 *
 * QUE APORTA QUE CADAM NO TENGA
 * -----------------------------
 * Todo el resto del tablero mira el MERCADO: matriculaciones e importaciones
 * de todas las marcas del pais. Nada de eso dice como vamos NOSOTROS por
 * dentro. Cars aporta tres cosas que CADAM no tiene:
 *
 *  1. FACTURACION propia por mes/marca/modelo — cuando vendimos, no cuando
 *     el comprador fue a matricular.
 *  2. STOCK propio — cuantas unidades hay, en que estado y donde.
 *  3. PRECIO DE LISTA propio en USD, por modelo.
 *
 * FACTURA NO ES MATRICULACION. Son dos eventos distintos y en distinto
 * momento: primero se factura, despues el comprador matricula (o no, si es
 * flota o si se registra en otra plaza). Ene–jul 2026 dio 2.381 facturas
 * contra 1.990 matriculaciones de marcas propias en CADAM: 20% de brecha,
 * y ninguno de los dos numeros esta mal. Nunca presentarlos como si midieran
 * lo mismo.
 *
 * SIN PLATA, A PROPOSITO
 * ----------------------
 * Cars devuelve `Monto`/`Total`/`Moneda` y NO son confiables: 2.936 facturas
 * de 2026 vienen marcadas "DOLARES" con importes de 54 millones a 4,8
 * BILLONES (o sea guaranies, y con basura adentro), y 54 marcadas
 * "GUARANIES" arrancan en 29.990. Verificado el 02/09/2026. Poner
 * facturacion en el tablero con esa base seria inventar una cifra. Se
 * guardan UNIDADES, que si cierran. El `PrecioLista` de las unidades es
 * harina de otro costal: ese si esta en USD y es creible (mediana 24.990,
 * precios terminados en 990).
 *
 * SIN DATOS PERSONALES, TAMPOCO
 * -----------------------------
 * `/sales/list` devuelve Cliente, Email, Telefono, VIN y Vendedor en cada
 * factura. Esta app NO tiene login. Nada de eso entra a estas tablas: el
 * script de Hermes agrega ANTES de mandar y los datos crudos no salen de la
 * maquina. Si algun dia se agrega login, se puede revisar — hoy no.
 */

export interface VentaPropia {
  periodo: string; // YYYY-MM
  marca: string;
  modelo: string;
  unidades: number;
}

export interface StockPropio {
  marca: string;
  modelo: string;
  estado: string;
  unidades: number;
  reservadas: number;
  /** Mediana del precio de lista del modelo, en USD. null si Cars no lo trae. */
  precio_usd: number | null;
}

export interface EstadoSync {
  actualizado_en: string;
  detalle: Record<string, unknown>;
}

export async function crearTablasPropias(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    create table if not exists venta_propia (
      periodo  text not null,
      marca    text not null,
      modelo   text not null,
      unidades integer not null,
      primary key (periodo, marca, modelo)
    );
  `);
  await pool.query(`
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
  await pool.query(`
    create table if not exists sincronizacion_propia (
      clave          text primary key,
      actualizado_en timestamptz not null default now(),
      detalle        jsonb not null default '{}'::jsonb
    );
  `);
}

/**
 * Guarda el corte completo. Las dos tablas se reemplazan enteras dentro de
 * UNA transaccion.
 *
 * Para stock es obvio (es una foto de hoy: lo que no vino, ya no esta). Para
 * ventas tambien conviene: Cars corrige facturas hacia atras — se anulan, se
 * rehacen — asi que un upsert dejaria vivas filas de meses que ya cambiaron.
 * El script manda SIEMPRE la ventana completa que declara en `desde`.
 */
export async function guardarDatosPropios(params: {
  ventas: VentaPropia[];
  stock: StockPropio[];
  detalle: Record<string, unknown>;
}): Promise<void> {
  const cliente = await getPool().connect();
  try {
    await cliente.query("begin");

    await cliente.query("delete from venta_propia");
    for (const v of params.ventas) {
      await cliente.query(
        `insert into venta_propia (periodo, marca, modelo, unidades)
         values ($1, $2, $3, $4)`,
        [v.periodo, v.marca, v.modelo, v.unidades]
      );
    }

    await cliente.query("delete from stock_propio");
    for (const s of params.stock) {
      await cliente.query(
        `insert into stock_propio (marca, modelo, estado, unidades, reservadas, precio_usd)
         values ($1, $2, $3, $4, $5, $6)`,
        [s.marca, s.modelo, s.estado, s.unidades, s.reservadas, s.precio_usd]
      );
    }

    await cliente.query(
      `insert into sincronizacion_propia (clave, actualizado_en, detalle)
       values ('cars', now(), $1::jsonb)
       on conflict (clave) do update set
         actualizado_en = now(), detalle = excluded.detalle`,
      [JSON.stringify(params.detalle)]
    );

    await cliente.query("commit");
  } catch (e) {
    await cliente.query("rollback");
    throw e;
  } finally {
    cliente.release();
  }
}

export async function getVentasPropias(): Promise<VentaPropia[]> {
  const { rows } = await getPool().query<VentaPropia>(
    `select periodo, marca, modelo, unidades from venta_propia
     order by periodo desc, unidades desc`
  );
  return rows;
}

export async function getStockPropio(): Promise<StockPropio[]> {
  const { rows } = await getPool().query<StockPropio>(
    `select marca, modelo, estado, unidades, reservadas, precio_usd
     from stock_propio order by unidades desc`
  );
  return rows;
}

export async function getEstadoSyncPropio(): Promise<EstadoSync | null> {
  const { rows } = await getPool().query<EstadoSync>(
    `select actualizado_en, detalle from sincronizacion_propia where clave = 'cars'`
  );
  return rows[0] ?? null;
}

/** true si hay algo cargado. Las tablas no existen hasta el primer push. */
export async function hayDatosPropios(): Promise<boolean> {
  try {
    const { rows } = await getPool().query<{ n: string }>(
      `select count(*) n from venta_propia`
    );
    return Number(rows[0]?.n ?? 0) > 0;
  } catch {
    return false;
  }
}
