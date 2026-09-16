/**
 * Freno de fuerza bruta, en memoria del proceso.
 *
 * Una clave sin freno se prueba a miles por minuto: es el ataque realista
 * contra esto, no el criptoanálisis. Se cuenta por IP y también por cuenta
 * (para que quien rota de IP no pueda seguir probando la misma cuenta), y
 * el pedido de recuperación de clave tiene su propio contador para que
 * nadie inunde una casilla de correos.
 *
 * En memoria y no en base a propósito: reiniciar el contenedor limpia los
 * contadores, y eso es aceptable —un atacante no controla los deploys— a
 * cambio de no meter una tabla y una escritura por intento fallido. Si
 * alguna vez hay varias réplicas, esto hay que mover a Postgres: cada
 * réplica contaría por su lado y el freno se aflojaría por el número de
 * réplicas.
 */

interface Registro {
  fallos: number;
  hasta: number;
  primero: number;
}

const registros = new Map<string, Registro>();

/** Cada tanto se tiran los registros viejos para que el mapa no crezca con
 *  cada IP que pasó una vez. */
function podar(ahora: number): void {
  if (registros.size < 5000) return;
  for (const [k, r] of registros) {
    if (r.hasta < ahora && ahora - r.primero > 60 * 60_000) registros.delete(k);
  }
}

/** Segundos que faltan para poder intentar de nuevo; 0 si está libre. */
export function bloqueadoPor(clave: string): number {
  const r = registros.get(clave);
  if (!r) return 0;
  const ahora = Date.now();
  return r.hasta > ahora ? Math.ceil((r.hasta - ahora) / 1000) : 0;
}

/**
 * Anota un intento fallido. Al llegar a `max` fallos dentro de `ventanaMs`
 * se bloquea por `esperaMs`. Devuelve los segundos de bloqueo si lo hubo.
 */
export function anotarFallo(
  clave: string,
  opciones: { max: number; esperaMs: number; ventanaMs?: number }
): number {
  const ahora = Date.now();
  podar(ahora);
  const ventana = opciones.ventanaMs ?? 15 * 60_000;
  const previo = registros.get(clave);
  const reinicia = !previo || ahora - previo.primero > ventana;
  const fallos = reinicia ? 1 : previo.fallos + 1;
  const hasta = fallos >= opciones.max ? ahora + opciones.esperaMs : 0;
  registros.set(clave, { fallos, hasta, primero: reinicia ? ahora : previo.primero });
  return hasta ? Math.ceil(opciones.esperaMs / 1000) : 0;
}

export function limpiarFallos(clave: string): void {
  registros.delete(clave);
}

/**
 * La IP real detrás de Cloudflare y del proxy de Coolify. `x-forwarded-for`
 * puede traer una lista y la primera es el cliente.
 */
export function ipDe(h: Headers): string {
  return (
    h.get("cf-connecting-ip") ??
    h.get("x-forwarded-for")?.split(",")[0].trim() ??
    "desconocida"
  );
}

export function esHttps(h: Headers): boolean {
  return h.get("x-forwarded-proto") === "https" || h.get("origin")?.startsWith("https:") === true;
}
