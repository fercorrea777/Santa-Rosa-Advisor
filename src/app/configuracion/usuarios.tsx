"use client";

import * as React from "react";
import { useActionState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  accionBorrarUsuario, accionCambiarActivo, accionCambiarRol,
  accionCrearUsuario, accionResetearClave, type EstadoUsuarios,
} from "./acciones-usuarios";
import type { Usuario } from "@/lib/auth/usuarios";

/**
 * Alta y mantenimiento de usuarios.
 *
 * Cada fila tiene sus propios formularios (resetear clave, cambiar rol,
 * habilitar, borrar) y cada uno su propio estado: con un estado compartido, un
 * error al resetear la clave de una persona aparecia como si fuera de otra.
 */
export function PanelUsuarios({
  usuarios,
  error,
}: {
  usuarios: Usuario[];
  error?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Usuarios</CardTitle>
        <p className="text-xs text-muted-foreground">
          Cada persona con su clave. Los <strong>lectores</strong> ven el
          tablero; los <strong>administradores</strong> además entran acá, a
          editar metas y a manejar usuarios.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error ? (
          <p className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            {error}
          </p>
        ) : (
          <>
            <FormularioAlta />
            <div className="flex flex-col gap-2">
              {usuarios.length === 0 ? (
                <p className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
                  Todavía no hay usuarios. Mientras no haya ninguno, se entra
                  con la clave general del equipo.
                </p>
              ) : (
                usuarios.map((u) => <FilaUsuario key={u.id} usuario={u} />)
              )}
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              La <strong>clave general</strong> (<code>ADVISOR_CLAVE</code>)
              sigue funcionando con el usuario vacío, y da acceso de
              administrador. Es la llave de emergencia: sirve si la base no
              responde o si se borra al último admin. Cambiarla en Coolify
              cierra <em>todas</em> las sesiones abiertas, que es la única
              forma de cortar una sesión en el acto — dar de baja a alguien le
              corta el próximo ingreso, no el que ya tiene abierto.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Aviso({ estado }: { estado: EstadoUsuarios | null }) {
  if (!estado?.error && !estado?.ok) return null;
  return (
    <p
      role="alert"
      className={cn(
        "rounded-md border px-3 py-2 text-xs",
        estado.error
          ? "border-rose-500/30 bg-rose-500/5 text-rose-600 dark:text-rose-400"
          : "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"
      )}
    >
      {estado.error ?? estado.ok}
    </p>
  );
}

function FormularioAlta() {
  const [estado, enviar, pendiente] = useActionState<EstadoUsuarios | null, FormData>(
    accionCrearUsuario,
    null
  );
  // Al crear con éxito se limpia el formulario: sin esto queda la clave de la
  // persona anterior escrita en pantalla, a la vista de quien pase por atrás.
  const form = React.useRef<HTMLFormElement>(null);
  React.useEffect(() => {
    if (estado?.ok) form.current?.reset();
  }, [estado?.ok]);

  return (
    <form
      ref={form}
      action={enviar}
      className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3"
    >
      <p className="text-xs font-medium">Crear usuario</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-muted-foreground">Usuario (para entrar)</span>
          <input
            name="usuario"
            required
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="pablo.villalba"
            className="input-base h-9"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-muted-foreground">Nombre y apellido</span>
          <input
            name="nombre"
            required
            placeholder="Pablo Villalba"
            className="input-base h-9"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-muted-foreground">Clave inicial</span>
          <input
            name="clave"
            type="text"
            required
            minLength={10}
            placeholder="mínimo 10 caracteres"
            // type="text" a propósito: quien la crea la tiene que poder leer
            // para pasársela. Es una clave provisoria que esa persona cambia.
            className="input-base h-9 font-mono"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-muted-foreground">Rol</span>
          <select name="rol" defaultValue="lector" className="input-base h-9">
            <option value="lector">Lector — ve el tablero</option>
            <option value="admin">Administrador — además configura</option>
          </select>
        </label>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] text-muted-foreground">
          La clave no se guarda en claro: se guarda su hash y no se puede volver a ver.
        </span>
        <Button type="submit" size="sm" disabled={pendiente}>
          {pendiente ? "Creando…" : "Crear"}
        </Button>
      </div>
      <Aviso estado={estado} />
    </form>
  );
}

function FilaUsuario({ usuario }: { usuario: Usuario }) {
  const [abierto, setAbierto] = React.useState(false);

  return (
    <div className="rounded-lg border">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
        <span className="font-medium text-sm">{usuario.usuario}</span>
        <span className="text-xs text-muted-foreground">{usuario.nombre}</span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
            usuario.rol === "admin"
              ? "bg-primary/12 text-primary"
              : "bg-muted text-muted-foreground"
          )}
        >
          {usuario.rol === "admin" ? "Admin" : "Lector"}
        </span>
        {!usuario.activo && (
          <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-rose-600 dark:text-rose-400">
            De baja
          </span>
        )}
        {usuario.debe_cambiar && usuario.activo && (
          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
            clave puesta por un admin
          </span>
        )}
        <span className="ml-auto text-[11px] text-muted-foreground">
          {usuario.ultimo_acceso
            ? `entró ${new Date(usuario.ultimo_acceso).toLocaleDateString("es-PY")}`
            : "nunca entró"}
        </span>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setAbierto((v) => !v)}
        >
          {abierto ? "Cerrar" : "Administrar"}
        </Button>
      </div>

      {abierto && (
        <div className="flex flex-col gap-3 border-t bg-muted/20 px-3 py-3">
          <ResetearClave usuario={usuario} />
          <div className="flex flex-wrap gap-2">
            <CambiarRol usuario={usuario} />
            <CambiarActivo usuario={usuario} />
            <Borrar usuario={usuario} />
          </div>
        </div>
      )}
    </div>
  );
}

function ResetearClave({ usuario }: { usuario: Usuario }) {
  const [estado, enviar, pendiente] = useActionState<EstadoUsuarios | null, FormData>(
    accionResetearClave,
    null
  );
  return (
    <form action={enviar} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={usuario.id} />
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-[11px] text-muted-foreground">Clave nueva</span>
          <input
            name="clave"
            type="text"
            required
            minLength={10}
            placeholder="mínimo 10 caracteres"
            className="input-base h-9 font-mono"
          />
        </label>
        <Button type="submit" size="sm" variant="outline" disabled={pendiente}>
          {pendiente ? "Cambiando…" : "Resetear clave"}
        </Button>
      </div>
      <Aviso estado={estado} />
    </form>
  );
}

function CambiarRol({ usuario }: { usuario: Usuario }) {
  const [estado, enviar, pendiente] = useActionState<EstadoUsuarios | null, FormData>(
    accionCambiarRol,
    null
  );
  const nuevo = usuario.rol === "admin" ? "lector" : "admin";
  return (
    <form action={enviar} className="flex flex-col gap-1">
      <input type="hidden" name="id" value={usuario.id} />
      <input type="hidden" name="rol" value={nuevo} />
      <Button type="submit" size="sm" variant="outline" disabled={pendiente}>
        {nuevo === "admin" ? "Hacer administrador" : "Bajar a lector"}
      </Button>
      <Aviso estado={estado} />
    </form>
  );
}

function CambiarActivo({ usuario }: { usuario: Usuario }) {
  const [estado, enviar, pendiente] = useActionState<EstadoUsuarios | null, FormData>(
    accionCambiarActivo,
    null
  );
  return (
    <form action={enviar} className="flex flex-col gap-1">
      <input type="hidden" name="id" value={usuario.id} />
      <input type="hidden" name="activo" value={usuario.activo ? "false" : "true"} />
      <Button type="submit" size="sm" variant="outline" disabled={pendiente}>
        {usuario.activo ? "Dar de baja" : "Reactivar"}
      </Button>
      <Aviso estado={estado} />
    </form>
  );
}

function Borrar({ usuario }: { usuario: Usuario }) {
  const [estado, enviar, pendiente] = useActionState<EstadoUsuarios | null, FormData>(
    accionBorrarUsuario,
    null
  );
  return (
    <form
      action={enviar}
      className="flex flex-col gap-1"
      // Borrar es irreversible y el botón está al lado de los otros: la
      // confirmación evita el clic de más.
      onSubmit={(e) => {
        if (!confirm(`¿Borrar el usuario "${usuario.usuario}"? No se puede deshacer.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={usuario.id} />
      <Button
        type="submit"
        size="sm"
        variant="outline"
        disabled={pendiente}
        className="border-rose-500/40 text-rose-600 hover:bg-rose-500/10 dark:text-rose-400"
      >
        Borrar
      </Button>
      <Aviso estado={estado} />
    </form>
  );
}
