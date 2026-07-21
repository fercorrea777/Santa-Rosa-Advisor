"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Bot, Loader2, Send, User } from "lucide-react";

interface Turno {
  role: "user" | "assistant";
  content: string;
}

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
        body: JSON.stringify({ mensajes: nuevos }),
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
      setError("No se pudo contactar al servidor. ¿Sigue corriendo la app?");
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex-1 overflow-y-auto rounded-lg border bg-card p-4">
        {turnos.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-4 py-10">
            <Bot className="size-8 text-muted-foreground/50" />
            <p className="max-w-md text-center text-sm text-muted-foreground">
              Preguntá lo que quieras sobre el mercado: marcas, modelos,
              segmentos, tecnologías, importadores, evolución. Respondo solo
              con los datos cargados y cito las cifras.
            </p>
            <div className="flex max-w-xl flex-wrap justify-center gap-2">
              {sugerencias.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => enviar(s)}
                  className="rounded-full border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-4">
          {turnos.map((t, i) => (
            <Mensaje key={i} turno={t} />
          ))}
          {cargando && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Consultando la base…
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

      <form
        onSubmit={(e) => {
          e.preventDefault();
          enviar(texto);
        }}
        className="flex gap-2"
      >
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Ej.: ¿cómo viene GREAT WALL en SUV contra GEELY?"
          disabled={cargando}
          className="h-10 flex-1 rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={cargando || !texto.trim()}
          className="inline-flex h-10 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          <Send className="size-4" />
          Enviar
        </button>
      </form>
    </div>
  );
}

function Mensaje({ turno }: { turno: Turno }) {
  const esUsuario = turno.role === "user";
  return (
    <div className={cn("flex gap-2.5", esUsuario && "flex-row-reverse")}>
      <div
        className={cn(
          "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full",
          esUsuario ? "bg-primary text-primary-foreground" : "border bg-muted"
        )}
      >
        {esUsuario ? <User className="size-4" /> : <Bot className="size-4" />}
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
