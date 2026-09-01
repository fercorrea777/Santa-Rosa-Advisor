"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { IconCopiloto } from "@/components/icons";

interface Turno {
  role: "user" | "assistant";
  content: string;
}

type Motor = "claude" | "qwen";

/**
 * Claude es el default. Qwen corre en el servidor propio: no sale a
 * internet y es MUCHO mas lento (minutos, no segundos), asi que el
 * selector lo dice en el subtitulo en vez de dejar que el usuario lo
 * descubra esperando.
 */
const MOTORES: { id: Motor; nombre: string; detalle: string }[] = [
  { id: "claude", nombre: "Claude", detalle: "rápido · con web" },
  { id: "qwen", nombre: "Qwen local", detalle: "lento · sin web" },
];

/**
 * Chat del copiloto. El historial vive en el cliente (no se persiste):
 * cada pregunta manda la conversacion completa a /api/copiloto, que
 * consulta la base y devuelve la respuesta final.
 */
export function ChatCopiloto({ sugerencias }: { sugerencias: string[] }) {
  const [turnos, setTurnos] = React.useState<Turno[]>([]);
  const [texto, setTexto] = React.useState("");
  const [cargando, setCargando] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [motor, setMotor] = React.useState<Motor>("claude");
  const finRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turnos, cargando]);

  const enviar = async (pregunta: string) => {
    const limpia = pregunta.trim();
    if (!limpia || cargando) return;
    setError(null);
    setTexto("");
    const nuevos: Turno[] = [...turnos, { role: "user", content: limpia }];
    setTurnos(nuevos);
    setCargando(true);
    try {
      const res = await fetch("/api/copiloto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensajes: nuevos, motor }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `Error ${res.status}`);
        // La pregunta queda en el historial para poder reintentar.
        return;
      }
      setTurnos([...nuevos, { role: "assistant", content: data.respuesta }]);
      if (data.truncada) {
        setError("La respuesta se cortó por longitud. Pedí el detalle en partes.");
      }
    } catch {
      setError(
        motor === "qwen"
          ? "Se cortó la conexión con el modelo local. Suele ser por demora: probá de nuevo o usá Claude."
          : "No se pudo contactar al servidor. ¿Sigue corriendo la app?"
      );
    } finally {
      setCargando(false);
    }
  };

  const vacio = turnos.length === 0;

  // ESTADO VACÍO: hero centrado (referencia del usuario) — el input es el
  // protagonista en el medio, no una barra al pie. Al enviar el primer
  // mensaje pasa al layout de conversación (lista + input abajo).
  if (vacio) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 px-4 py-10">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/12 text-primary">
            <IconCopiloto size={22} />
          </span>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-balance">
            ¿En qué te ayudo <span className="text-primary">hoy</span>?
          </h2>
          <p className="max-w-md text-sm text-muted-foreground text-pretty">
            Preguntá sobre el mercado — marcas, modelos, segmentos, tecnologías,
            evolución. Respondo con los datos cargados y cito las cifras.
          </p>
        </div>

        <InputBar
          texto={texto}
          setTexto={setTexto}
          onEnviar={() => enviar(texto)}
          cargando={cargando}
          hero
        />

        <SelectorMotor motor={motor} setMotor={setMotor} cargando={cargando} />

        <div className="flex max-w-2xl flex-wrap justify-center gap-2">
          {sugerencias.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => enviar(s)}
              className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs text-muted-foreground shadow-[var(--card-shadow)] transition-[color,border-color,scale] duration-150 hover:border-primary/40 hover:text-foreground active:scale-[0.98]"
            >
              <IconCopiloto size={13} className="shrink-0 text-primary/70" />
              {s}
            </button>
          ))}
        </div>

        {error && (
          <p className="rounded-md border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-xs text-rose-600 dark:text-rose-400">
            {error}
          </p>
        )}
      </div>
    );
  }

  // ESTADO CONVERSACIÓN: lista de mensajes + input al pie.
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex-1 overflow-y-auto rounded-2xl border bg-card p-4">
        <div className="flex flex-col gap-4">
          {turnos.map((t, i) => (
            <Mensaje key={i} turno={t} />
          ))}
          {cargando && (
            <div className="flex items-center gap-2 pl-9 text-sm text-muted-foreground">
              <span className="inline-flex gap-1">
                <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.2s]" />
                <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.1s]" />
                <span className="size-1.5 animate-bounce rounded-full bg-current" />
              </span>
              {motor === "qwen"
                ? "Consultando el modelo local (puede tardar varios minutos)"
                : "Consultando"}
            </div>
          )}
          <div ref={finRef} />
        </div>
      </div>

      {error && (
        <p className="rounded-md border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-xs text-rose-600 dark:text-rose-400">
          {error}
        </p>
      )}

      <div className="flex justify-end">
        <SelectorMotor motor={motor} setMotor={setMotor} cargando={cargando} />
      </div>

      <InputBar
        texto={texto}
        setTexto={setTexto}
        onEnviar={() => enviar(texto)}
        cargando={cargando}
      />
    </div>
  );
}

/** Barra de entrada compartida por el hero (empty-state) y el pie de la
 *  conversación. Misma lógica de envío, dos tamaños. */
function InputBar({
  texto,
  setTexto,
  onEnviar,
  cargando,
  hero = false,
}: {
  texto: string;
  setTexto: (v: string) => void;
  onEnviar: () => void;
  cargando: boolean;
  hero?: boolean;
}) {
  const enviable = !cargando && texto.trim().length > 0;

  if (hero) {
    return (
      <form
        onSubmit={(e) => { e.preventDefault(); onEnviar(); }}
        className="w-full max-w-2xl"
      >
        <div className="relative rounded-2xl border bg-card shadow-[var(--card-shadow)] transition-shadow focus-within:border-ring/50 focus-within:ring-3 focus-within:ring-ring/25">
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Preguntá al copiloto…"
            disabled={cargando}
            autoFocus
            // pointer-coarse:text-base — Safari iOS hace zoom al enfocar un
            // campo de menos de 16px y deja la página ampliada. Este input no
            // usa .input-base (fondo transparente, alto propio), así que la
            // regla global de globals.css no lo alcanza.
            className="w-full bg-transparent px-4 pt-4 pb-14 text-sm outline-none pointer-coarse:text-base placeholder:text-muted-foreground disabled:opacity-50"
          />
          <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">
              Enter para enviar
            </span>
            <Button type="submit" size="sm" disabled={!enviable} className="pointer-events-auto">
              Enviar
            </Button>
          </div>
        </div>
      </form>
    );
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onEnviar(); }}
      className="flex gap-2"
    >
      <input
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Ej.: ¿cómo viene GREAT WALL en SUV contra GEELY?"
        disabled={cargando}
        // El h-10 (utilities) le gana al height de .input-base (components),
        // incluida su regla táctil: hay que repetir el mínimo acá.
        className="input-base h-10 flex-1 pointer-coarse:h-11"
      />
      <Button type="submit" size="lg" disabled={!enviable}>
        Enviar
      </Button>
    </form>
  );
}

/** Selector de motor: dos pastillas, sin dropdown (son solo dos). */
function SelectorMotor({
  motor,
  setMotor,
  cargando,
}: {
  motor: Motor;
  setMotor: (m: Motor) => void;
  cargando: boolean;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full border bg-card p-1 shadow-[var(--card-shadow)]">
      {MOTORES.map((m) => {
        const activo = m.id === motor;
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => setMotor(m.id)}
            disabled={cargando}
            aria-pressed={activo}
            title={`${m.nombre} — ${m.detalle}`}
            // pointer-coarse:min-h-11 — mismo minimo tactil de 44px que el
            // resto de la app (ver la regla de .input-base en globals.css).
            // Estas pastillas son chicas a proposito en desktop, pero con el
            // dedo quedan por debajo del minimo si no se las sube.
            className={cn(
              "rounded-full px-3 py-1 text-xs transition-colors disabled:opacity-50",
              "pointer-coarse:min-h-11 pointer-coarse:px-4 pointer-coarse:text-sm",
              activo
                ? "bg-primary/12 font-semibold text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {m.nombre}
            <span className="ml-1.5 hidden font-normal opacity-60 sm:inline">
              {m.detalle}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function Mensaje({ turno }: { turno: Turno }) {
  const esUsuario = turno.role === "user";
  return (
    <div className={cn("flex gap-2.5", esUsuario && "flex-row-reverse")}>
      <div
        className={cn(
          "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold uppercase tracking-wide",
          esUsuario ? "bg-primary text-primary-foreground" : "border bg-muted text-muted-foreground"
        )}
      >
        {esUsuario ? "Vos" : "IA"}
      </div>
      <div
        className={cn(
          "max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed",
          esUsuario ? "bg-primary/10" : "bg-muted/50"
        )}
      >
        <Contenido texto={turno.content} />
      </div>
    </div>
  );
}

/** Render minimo de markdown: tablas, negrita y saltos de linea. Sin
 *  dependencias nuevas; suficiente para respuestas con cifras. */
function Contenido({ texto }: { texto: string }) {
  const bloques = partirEnBloques(texto);
  return (
    <div className="flex flex-col gap-2">
      {bloques.map((b, i) =>
        b.tipo === "titulo" ? (
          <p key={i} className="pt-1 font-semibold">
            <Inline texto={b.texto} />
          </p>
        ) : b.tipo === "tabla" ? (
          <div key={i} className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  {b.cabecera.map((c, j) => (
                    <th key={j} className="border-b px-2 py-1 text-left font-medium">
                      <Inline texto={c} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {b.filas.map((f, j) => (
                  <tr key={j}>
                    {f.map((c, k) => (
                      <td key={k} className="border-b border-border/50 px-2 py-1 tabular-nums">
                        <Inline texto={c} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p key={i} className="whitespace-pre-wrap">
            <Inline texto={b.texto} />
          </p>
        )
      )}
    </div>
  );
}

function Inline({ texto }: { texto: string }) {
  // Solo **negrita**; el resto tal cual.
  const partes = texto.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {partes.map((p, i) =>
        p.startsWith("**") && p.endsWith("**") ? (
          <strong key={i}>{p.slice(2, -2)}</strong>
        ) : (
          <React.Fragment key={i}>{p}</React.Fragment>
        )
      )}
    </>
  );
}

type Bloque =
  | { tipo: "texto"; texto: string }
  | { tipo: "titulo"; texto: string }
  | { tipo: "tabla"; cabecera: string[]; filas: string[][] };

function partirEnBloques(texto: string): Bloque[] {
  const lineas = texto.split("\n");
  const bloques: Bloque[] = [];
  let buffer: string[] = [];
  let i = 0;

  const cerrarTexto = () => {
    const t = buffer.join("\n").trim();
    if (t) bloques.push({ tipo: "texto", texto: t });
    buffer = [];
  };

  const esFilaTabla = (l: string) => /^\s*\|.*\|\s*$/.test(l);
  const esSeparador = (l: string) => /^\s*\|[\s\-:|]+\|\s*$/.test(l);
  const partirFila = (l: string) =>
    l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());

  while (i < lineas.length) {
    const titulo = lineas[i].match(/^\s*#{1,4}\s+(.*)$/);
    if (titulo) {
      cerrarTexto();
      bloques.push({ tipo: "titulo", texto: titulo[1] });
      i++;
      continue;
    }
    if (esFilaTabla(lineas[i]) && i + 1 < lineas.length && esSeparador(lineas[i + 1])) {
      cerrarTexto();
      const cabecera = partirFila(lineas[i]);
      i += 2;
      const filas: string[][] = [];
      while (i < lineas.length && esFilaTabla(lineas[i])) {
        filas.push(partirFila(lineas[i]));
        i++;
      }
      bloques.push({ tipo: "tabla", cabecera, filas });
    } else {
      buffer.push(lineas[i]);
      i++;
    }
  }
  cerrarTexto();
  return bloques;
}
