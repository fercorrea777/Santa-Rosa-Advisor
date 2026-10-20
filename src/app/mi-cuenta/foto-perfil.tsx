"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/perfil/avatar";
import { RecortadorFoto } from "@/components/perfil/recortador-foto";
import { IconCamara, IconCheck, IconSubir } from "@/components/icons";
import { TIPO_FOTO, URL_FOTO } from "@/lib/foto-perfil";
import { cn } from "@/lib/utils";

/** Una foto de celular puede pesar 10 MB; más que esto casi seguro no es una
 *  foto de perfil y decodificarla en el navegador costaría memoria de balde. */
const MAX_ARCHIVO = 15 * 1024 * 1024;

type Aviso = { tipo: "ok" | "error"; texto: string };

/**
 * La foto de perfil en «Mi cuenta»: se ve grande, se cambia con un clic o
 * arrastrando una imagen encima, se encuadra en un recortador y se quita con
 * una confirmación.
 *
 * La foto nueva se muestra al instante con la URL que devuelve el servidor y
 * en paralelo se le pide a Next que vuelva a armar la página (`refresh`), para
 * que el menú de al lado también la tome.
 */
export function FotoPerfil({
  nombre,
  fotoUrl,
  puedeCambiar,
}: {
  nombre: string;
  fotoUrl: string | null;
  /** false para el acceso de emergencia y el tablero abierto: no hay cuenta
   *  a la que colgarle una foto. */
  puedeCambiar: boolean;
}) {
  const router = useRouter();
  const selector = React.useRef<HTMLInputElement>(null);
  const [archivo, setArchivo] = React.useState<File | null>(null);
  // Un recortador nuevo por cada archivo elegido: arranca con el zoom y el
  // encuadre en cero sin resetear nada a mano.
  const [generacion, setGeneracion] = React.useState(0);
  // `undefined` = seguir lo que manda el servidor; un valor = lo que acaba de
  // pasar acá (foto nueva, o `null` si se quitó) y todavía no volvió en props.
  const [local, setLocal] = React.useState<string | null | undefined>(undefined);
  const [aviso, setAviso] = React.useState<Aviso | null>(null);
  const [confirmando, setConfirmando] = React.useState(false);
  const [quitando, setQuitando] = React.useState(false);
  const [arrastrando, setArrastrando] = React.useState(false);
  const mostrada = local !== undefined ? local : fotoUrl;

  const elegir = (f: File | undefined) => {
    if (!f) return;
    setAviso(null);
    if (!f.type.startsWith("image/")) {
      setAviso({ tipo: "error", texto: "Ese archivo no es una imagen. Elegí un JPG, un PNG o un WebP." });
      return;
    }
    if (f.size > MAX_ARCHIVO) {
      setAviso({ tipo: "error", texto: "Esa imagen pesa más de 15 MB. Elegí una más liviana." });
      return;
    }
    setGeneracion((g) => g + 1);
    setArchivo(f);
  };

  async function guardar(jpeg: Blob): Promise<string | null> {
    try {
      const r = await fetch(URL_FOTO, {
        method: "PUT",
        headers: { "Content-Type": TIPO_FOTO },
        body: jpeg,
        credentials: "same-origin",
      });
      const datos = (await r.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!r.ok) return datos.error ?? "No se pudo guardar la foto.";
      setLocal(datos.url ?? null);
      setArchivo(null);
      setAviso({ tipo: "ok", texto: "Listo, tu foto quedó guardada." });
      router.refresh();
      return null;
    } catch {
      return "No se pudo conectar con el servidor. Revisá tu conexión y probá de nuevo.";
    }
  }

  async function quitar() {
    setQuitando(true);
    setAviso(null);
    try {
      const r = await fetch(URL_FOTO, { method: "DELETE", credentials: "same-origin" });
      if (!r.ok) throw new Error();
      setLocal(null);
      setConfirmando(false);
      setAviso({ tipo: "ok", texto: "Quitaste tu foto. Se ven tus iniciales." });
      router.refresh();
    } catch {
      setAviso({ tipo: "error", texto: "No se pudo quitar la foto. Probá de nuevo." });
    } finally {
      setQuitando(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <div
        className={cn(
          "relative rounded-full transition-shadow",
          arrastrando && "ring-4 ring-primary/40"
        )}
        onDragOver={(e) => {
          if (!puedeCambiar) return;
          e.preventDefault();
          setArrastrando(true);
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={(e) => {
          if (!puedeCambiar) return;
          e.preventDefault();
          setArrastrando(false);
          elegir(e.dataTransfer.files[0]);
        }}
      >
        <Avatar nombre={nombre} fotoUrl={mostrada} tamano="xl" />
        {puedeCambiar && (
          // Atajo para el mouse: el botón con texto de al lado es el accesible.
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            onClick={() => selector.current?.click()}
            className="absolute -bottom-0.5 -right-0.5 grid size-9 place-items-center rounded-full bg-primary text-primary-foreground shadow-md ring-[3px] ring-card transition-transform hover:scale-105 active:scale-95"
          >
            <IconCamara size={16} />
          </button>
        )}
      </div>

      <div className="flex min-w-0 flex-col items-center gap-2.5 text-center sm:items-start sm:text-left">
        {puedeCambiar ? (
          <>
            <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
              <Button type="button" onClick={() => selector.current?.click()}>
                <IconSubir size={15} />
                {mostrada ? "Cambiar foto" : "Subir foto"}
              </Button>
              {mostrada && !confirmando && (
                <Button type="button" variant="ghost" onClick={() => setConfirmando(true)}>
                  Quitar
                </Button>
              )}
              {confirmando && (
                <>
                  <Button type="button" variant="destructive" onClick={quitar} disabled={quitando}>
                    {quitando ? "Quitando…" : "Sí, quitar la foto"}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setConfirmando(false)} disabled={quitando}>
                    Cancelar
                  </Button>
                </>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              JPG, PNG o WebP. También podés arrastrar una imagen sobre tu foto.
            </p>
          </>
        ) : (
          <p className="max-w-xs text-sm text-muted-foreground">
            Este acceso no es una cuenta personal, así que no tiene foto. Entrá con tu correo para
            ponerte la tuya.
          </p>
        )}
        {aviso && (
          <p
            role={aviso.tipo === "error" ? "alert" : "status"}
            className={cn(
              "inline-flex items-center gap-1.5 text-xs",
              aviso.tipo === "error" ? "text-destructive" : "text-emerald-700 dark:text-emerald-400"
            )}
          >
            {aviso.tipo === "ok" && <IconCheck size={14} />}
            {aviso.texto}
          </p>
        )}
      </div>

      {puedeCambiar && (
        <>
          <input
            ref={selector}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            tabIndex={-1}
            aria-label="Elegir una imagen para tu foto de perfil"
            onChange={(e) => {
              elegir(e.target.files?.[0]);
              // Para poder elegir el mismo archivo dos veces seguidas.
              e.target.value = "";
            }}
          />
          <RecortadorFoto
            key={generacion}
            archivo={archivo}
            onCancelar={() => setArchivo(null)}
            onGuardar={guardar}
          />
        </>
      )}
    </div>
  );
}
