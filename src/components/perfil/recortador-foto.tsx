"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { LADO_FOTO, MAX_BYTES_FOTO } from "@/lib/foto-perfil";
import { useI18n } from "@/lib/i18n/cliente";
import { N_ } from "@/lib/i18n/traducir";

/**
 * Recortador de la foto de perfil: se abre con el archivo elegido, se encuadra
 * arrastrando y acercando, y entrega un JPEG cuadrado de LADO_FOTO px ya
 * comprimido, listo para subir.
 *
 * TODO EN EL NAVEGADOR, y no en el servidor, por tres razones: la persona ve
 * exactamente lo que va a quedar; lo que sale pesa 30 KB y no los 5 MB de una
 * foto de celular; y al volver a dibujar la imagen en un canvas se pierden los
 * metadatos (ubicación GPS incluida), que no tienen por qué llegar a la base.
 *
 * Coordenadas del recorte en UNIDADES, no en píxeles: el cuadrado de recorte
 * mide 1 por 1, el centro es (0,5; 0,5) y `pos` es cuánto se corrió el centro
 * de la imagen. Así la vista previa (288 px) y la exportación (384 px) usan la
 * misma cuenta y no pueden diferir.
 */

const ZOOM_MIN = 1;
const ZOOM_MAX = 4;
/** Lo que se mueve la imagen con cada flecha, en unidades del recorte. */
const PASO_TECLADO = 0.03;

interface Imagen {
  fuente: CanvasImageSource;
  ancho: number;
  alto: number;
  liberar: () => void;
}

async function cargarImagen(archivo: File): Promise<Imagen> {
  try {
    // createImageBitmap respeta la orientación EXIF: una foto sacada con el
    // celular de costado entra derecha.
    const bmp = await createImageBitmap(archivo, { imageOrientation: "from-image" });
    return { fuente: bmp, ancho: bmp.width, alto: bmp.height, liberar: () => bmp.close() };
  } catch {
    const url = URL.createObjectURL(archivo);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return {
        fuente: img,
        ancho: img.naturalWidth,
        alto: img.naturalHeight,
        liberar: () => URL.revokeObjectURL(url),
      };
    } catch (e) {
      URL.revokeObjectURL(url);
      throw e;
    }
  }
}

/** Dibuja la imagen en un canvas cuadrado de lado `S`. El lado menor de la
 *  imagen cubre justo el recorte cuando el zoom es 1. */
function pintar(
  ctx: CanvasRenderingContext2D,
  im: Imagen,
  S: number,
  zoom: number,
  pos: { x: number; y: number }
) {
  const k = zoom / Math.min(im.ancho, im.alto);
  const W = im.ancho * k;
  const H = im.alto * k;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(im.fuente, (0.5 + pos.x - W / 2) * S, (0.5 + pos.y - H / 2) * S, W * S, H * S);
}

/** Que la imagen siempre cubra el recorte: sin bordes vacíos. */
function limitar(im: Imagen, zoom: number, x: number, y: number) {
  const k = zoom / Math.min(im.ancho, im.alto);
  const maxX = Math.max(0, (im.ancho * k - 1) / 2);
  const maxY = Math.max(0, (im.alto * k - 1) / 2);
  return { x: Math.min(maxX, Math.max(-maxX, x)), y: Math.min(maxY, Math.max(-maxY, y)) };
}

export function RecortadorFoto({
  archivo,
  onCancelar,
  onGuardar,
}: {
  /** El archivo elegido; null = cerrado. */
  archivo: File | null;
  onCancelar: () => void;
  /** Sube el JPEG. Devuelve el mensaje de error, o null si salió bien (el
   *  padre cierra el recortador). */
  onGuardar: (jpeg: Blob) => Promise<string | null>;
}) {
  const { t } = useI18n();
  const dialogo = React.useRef<HTMLDialogElement>(null);
  const lienzo = React.useRef<HTMLCanvasElement>(null);
  const imagen = React.useRef<Imagen | null>(null);
  const arrastre = React.useRef<{ id: number; x: number; y: number } | null>(null);
  const [carga, setCarga] = React.useState<"cargando" | "lista" | "error">("cargando");
  const [zoom, setZoom] = React.useState(ZOOM_MIN);
  const [pos, setPos] = React.useState({ x: 0, y: 0 });
  const [guardando, setGuardando] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const idAyuda = React.useId();
  // La rueda se registra una sola vez y necesita el zoom de ahora, no el del
  // render en que se enganchó.
  const zoomActual = React.useRef(ZOOM_MIN);
  React.useEffect(() => {
    zoomActual.current = zoom;
  }, [zoom]);

  // Abrir con un archivo nuevo: decodificarlo y mostrar el diálogo. El padre
  // monta un recortador NUEVO por archivo (`key`), así que el estado arranca
  // limpio sin tener que resetearlo acá.
  React.useEffect(() => {
    const d = dialogo.current;
    if (!d) return;
    if (!archivo) {
      if (d.open) d.close();
      imagen.current?.liberar();
      imagen.current = null;
      return;
    }
    let vigente = true;
    if (!d.open) d.showModal();
    cargarImagen(archivo).then(
      (im) => {
        if (!vigente) return im.liberar();
        imagen.current?.liberar();
        imagen.current = im;
        setCarga("lista");
      },
      () => {
        if (!vigente) return;
        setCarga("error");
        // N_: el mensaje se traduce al dibujarlo (abajo), así el efecto no depende del idioma.
        setError(N_("Ese archivo no se pudo leer como imagen. Probá con un JPG o un PNG."));
      }
    );
    return () => {
      vigente = false;
    };
  }, [archivo]);

  React.useEffect(
    () => () => {
      imagen.current?.liberar();
    },
    []
  );

  // Redibujar cuando cambia el zoom o la posición.
  React.useEffect(() => {
    const c = lienzo.current;
    const im = imagen.current;
    if (!c || !im || carga !== "lista") return;
    const S = Math.round((c.clientWidth || 288) * Math.min(window.devicePixelRatio || 1, 2));
    if (c.width !== S) {
      c.width = S;
      c.height = S;
    }
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, S, S);
    pintar(ctx, im, S, zoom, pos);
    // Velo afuera del círculo y aro: así se ve qué queda dentro del avatar.
    ctx.save();
    ctx.fillStyle = "rgba(14, 16, 48, 0.58)";
    ctx.beginPath();
    ctx.rect(0, 0, S, S);
    ctx.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2, true);
    ctx.fill("evenodd");
    ctx.strokeStyle = "rgba(255, 255, 255, 0.92)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }, [zoom, pos, carga]);

  const cambiarZoom = React.useCallback((nuevo: number) => {
    const im = imagen.current;
    const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, nuevo));
    setZoom(z);
    if (im) setPos((p) => limitar(im, z, p.x, p.y));
  }, []);

  // La rueda tiene que poder frenar el scroll de la página: React la registra
  // como pasiva, así que se engancha a mano.
  React.useEffect(() => {
    const c = lienzo.current;
    if (!c) return;
    const alRodar = (e: WheelEvent) => {
      e.preventDefault();
      cambiarZoom(zoomActual.current * Math.exp(-e.deltaY * 0.0015));
    };
    c.addEventListener("wheel", alRodar, { passive: false });
    return () => c.removeEventListener("wheel", alRodar);
  }, [carga, cambiarZoom]);

  const alApretar = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    arrastre.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
  };
  const alMover = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const a = arrastre.current;
    const im = imagen.current;
    if (!a || a.id !== e.pointerId || !im) return;
    const ancho = e.currentTarget.clientWidth || 288;
    const dx = (e.clientX - a.x) / ancho;
    const dy = (e.clientY - a.y) / ancho;
    arrastre.current = { id: a.id, x: e.clientX, y: e.clientY };
    setPos((p) => limitar(im, zoom, p.x + dx, p.y + dy));
  };
  const alSoltar = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (arrastre.current?.id === e.pointerId) arrastre.current = null;
  };
  const alTeclear = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    const im = imagen.current;
    if (!im) return;
    const mover = (dx: number, dy: number) => {
      e.preventDefault();
      setPos((p) => limitar(im, zoom, p.x + dx, p.y + dy));
    };
    if (e.key === "ArrowLeft") mover(PASO_TECLADO, 0);
    else if (e.key === "ArrowRight") mover(-PASO_TECLADO, 0);
    else if (e.key === "ArrowUp") mover(0, PASO_TECLADO);
    else if (e.key === "ArrowDown") mover(0, -PASO_TECLADO);
    else if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      cambiarZoom(zoom * 1.12);
    } else if (e.key === "-" || e.key === "_") {
      e.preventDefault();
      cambiarZoom(zoom / 1.12);
    }
  };

  async function guardar() {
    const im = imagen.current;
    if (!im || guardando) return;
    setGuardando(true);
    setError(null);
    try {
      const salida = document.createElement("canvas");
      salida.width = LADO_FOTO;
      salida.height = LADO_FOTO;
      const ctx = salida.getContext("2d");
      if (!ctx) throw new Error("sin canvas");
      // JPEG no tiene transparencia: un PNG con fondo transparente saldría
      // negro. Se rellena de blanco antes.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, LADO_FOTO, LADO_FOTO);
      pintar(ctx, im, LADO_FOTO, zoom, pos);
      const aBlob = (calidad: number) =>
        new Promise<Blob | null>((ok) => salida.toBlob(ok, "image/jpeg", calidad));
      let blob = await aBlob(0.86);
      if (blob && blob.size > MAX_BYTES_FOTO) blob = await aBlob(0.7);
      if (!blob || blob.size > MAX_BYTES_FOTO) {
        setError(N_("No se pudo comprimir la imagen. Probá con otra foto."));
        return;
      }
      const falla = await onGuardar(blob);
      // `falla` ya viene traducida por quien sube la foto; `t()` la deja igual si no es una frase del catálogo.
      if (falla) setError(falla);
    } catch {
      setError(N_("No se pudo preparar la foto. Probá de nuevo."));
    } finally {
      setGuardando(false);
    }
  }

  const cerrar = () => {
    if (!guardando) onCancelar();
  };

  return (
    <dialog
      ref={dialogo}
      aria-labelledby={`${idAyuda}-titulo`}
      // Escape no cierra mientras se sube: si fallara, el error no se vería.
      onCancel={(e) => {
        if (guardando) e.preventDefault();
      }}
      onClose={cerrar}
      onClick={(e) => {
        if (e.target === e.currentTarget) cerrar();
      }}
      className="fixed inset-0 m-auto w-[min(26rem,92vw)] max-w-none rounded-2xl border border-border bg-popover p-0 text-popover-foreground shadow-[0_30px_80px_-20px_oklch(0.15_0.06_277/0.7)] backdrop:bg-[oklch(0.2_0.07_277/0.55)]"
    >
      <div className="flex flex-col gap-4 p-5">
        <div>
          <h2 id={`${idAyuda}-titulo`} className="text-base font-bold tracking-tight">
            {t("Encuadrá tu foto")}
          </h2>
          <p id={`${idAyuda}-ayuda`} className="mt-1 text-xs text-muted-foreground">
            {t("Arrastrala para moverla y acercala con el control de abajo o con la rueda. Se guarda como un cuadrado y se muestra en círculo.")}
          </p>
        </div>

        <div className="mx-auto w-full max-w-72">
          {carga === "cargando" && (
            <div className="grid aspect-square place-items-center rounded-xl bg-muted text-sm text-muted-foreground" role="status">
              {t("Abriendo la imagen…")}
            </div>
          )}
          {carga === "error" && (
            <div className="grid aspect-square place-items-center rounded-xl bg-muted p-6 text-center text-sm text-muted-foreground">
              {t("No se pudo abrir esa imagen.")}
            </div>
          )}
          {carga === "lista" && (
            <canvas
              ref={lienzo}
              tabIndex={0}
              role="img"
              aria-label={t("Vista previa del encuadre de tu foto")}
              aria-describedby={`${idAyuda}-ayuda`}
              aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown + -"
              onPointerDown={alApretar}
              onPointerMove={alMover}
              onPointerUp={alSoltar}
              onPointerCancel={alSoltar}
              onKeyDown={alTeclear}
              className="block aspect-square w-full cursor-grab touch-none rounded-xl bg-[#0e1030] outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing"
            />
          )}
        </div>

        {carga === "lista" && (
          <label className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="w-10 shrink-0">{t("Zoom")}</span>
            <input
              type="range"
              min={ZOOM_MIN}
              max={ZOOM_MAX}
              step={0.01}
              value={zoom}
              onChange={(e) => cambiarZoom(Number(e.target.value))}
              aria-label={t("Acercar la foto")}
              className="h-1.5 flex-1 cursor-pointer accent-primary"
            />
          </label>
        )}

        {error && (
          <p role="alert" className="rounded-md border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-xs text-rose-700 dark:text-rose-400">
            {t(error)}
          </p>
        )}

        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" onClick={cerrar} disabled={guardando}>
            {t("Cancelar")}
          </Button>
          <Button type="button" onClick={guardar} disabled={carga !== "lista" || guardando}>
            {guardando ? t("Guardando…") : t("Guardar foto")}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
