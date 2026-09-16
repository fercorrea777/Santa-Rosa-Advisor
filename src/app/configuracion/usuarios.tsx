"use client";

import * as React from "react";
import { useActionState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CampoClave } from "@/components/ui/campo-clave";
import { cn } from "@/lib/utils";
import { formatFecha, formatFechaHora } from "@/lib/format";
import { patronCorreo } from "@/app/entrar/formulario";
import {
  accionBorrarUsuario, accionCambiarActivo, accionCambiarCorreo, accionCambiarRol,
  accionCrearUsuario, accionEnviarEnlace, accionResetearClave, type EstadoUsuarios,
} from "./acciones-usuarios";
import type { EventoAuditoria, Usuario } from "@/lib/auth/usuarios";

/**
 * Alta y mantenimiento de usuarios.
 *
 * El usuario es el correo de la empresa. El alta normal NO lleva clave: se
 * le manda a la persona un enlace y ella elige la suya — así el admin nunca
 * conoce la clave de nadie. Poner una clave a mano sigue existiendo para
 * cuando el correo no está andando.
 *
 * Cada fila tiene sus propios formularios (enviar enlace, resetear clave,
 * cambiar correo, cambiar rol, habilitar, borrar) y cada uno su propio
 * estado: con un estado compartido, un error al resetear la clave de una
 * persona aparecia como si fuera de otra.
 */
export function PanelUsuarios({
  usuarios,
  error,
  dominio,
  hayCorreo,
  auditoria,
}: {
  usuarios: Usuario[];
  error?: string;
  dominio: string;
  /** Si el servidor tiene SMTP: sin eso, los enlaces se muestran en
   *  pantalla para pasarlos a mano. */
  hayCorreo: boolean;
  auditoria: EventoAuditoria[];
}) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Usuarios</CardTitle>
          <p className="text-xs text-muted-foreground">
            Cada persona entra con su correo @{dominio} y su clave. Los{" "}
            <strong>lectores</strong> ven el tablero; los{" "}
            <strong>administradores</strong> además entran acá, editan metas,
            manejan usuarios y ven costos y márgenes en Acciones comerciales.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error ? (
            <p className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
              {error}
            </p>
          ) : (
            <>
              {!hayCorreo && (
                <p className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                  El servidor no tiene SMTP configurado (SMTP_HOST, SMTP_USER,
                  SMTP_PASS): las invitaciones y los enlaces de clave se muestran
                  acá en vez de mandarse por correo, y «Olvidé mi clave» no
                  funciona hasta configurarlo.
                </p>
              )}
              <FormularioAlta dominio={dominio} hayCorreo={hayCorreo} />
              <div className="flex flex-col gap-2">
                {usuarios.length === 0 ? (
                  <p className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
                    Todavía no hay usuarios. Mientras no haya ninguno, se entra
                    con la clave general del equipo.
                  </p>
                ) : (
                  usuarios.map((u) => <FilaUsuario key={u.id} usuario={u} dominio={dominio} hayCorreo={hayCorreo} />)
                )}
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                La <strong>clave general</strong> (<code>ADVISOR_CLAVE</code>) es la
                llave de emergencia: sirve si la base no responde o si se borra al
                último admin. No está en la pantalla de entrada; se usa desde{" "}
                <code>/entrar?modo=emergencia</code>, abre una sesión de un día y
                queda registrada. Cambiarla en Coolify cierra <em>todas</em> las
                sesiones abiertas. Dar de baja a alguien, cambiarle la clave o el
                rol le cierra la sesión en menos de un minuto.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Registro de accesos</CardTitle>
          <p className="text-xs text-muted-foreground">
            Quién entró, quién falló y qué tocó cada administrador. Los últimos{" "}
            {auditoria.length} movimientos.
          </p>
        </CardHeader>
        <CardContent>
          {auditoria.length === 0 ? (
            <p className="text-xs text-muted-foreground">Todavía no hay movimientos registrados.</p>
          ) : (
            <ul className="flex flex-col divide-y text-xs">
              {auditoria.map((e) => (
                <li key={e.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-1.5">
                  <span className="w-[8.5rem] shrink-0 tabular-nums text-muted-foreground">{formatFechaHora(e.momento)}</span>
                  <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide", TONO[e.evento] ?? "bg-muted text-muted-foreground")}>
                    {ROTULO[e.evento] ?? e.evento}
                  </span>
                  <span className="font-medium">{e.correo ?? "—"}</span>
                  {e.detalle && <span className="text-muted-foreground">{e.detalle}</span>}
                  {e.ip && <span className="ml-auto text-[11px] text-muted-foreground/70">{e.ip}</span>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}

const ROTULO: Record<string, string> = {
  login_ok: "entró", login_fallo: "falló", login_bloqueado: "bloqueado", login_emergencia: "clave general",
  recuperacion_pedida: "pidió enlace", recuperacion_enviada: "enlace enviado", recuperacion_fallo_envio: "correo falló",
  clave_restablecida: "clave nueva", clave_cambiada: "cambió su clave",
  usuario_creado: "alta", invitacion_enviada: "invitación", reset_por_admin: "reset por admin", enlace_reset_enviado: "enlace de reset",
  rol_cambiado: "rol", usuario_baja: "baja", usuario_alta: "reactivado", usuario_borrado: "borrado", correo_cambiado: "correo",
  sesion_cortada: "sesión cortada",
};
const TONO: Record<string, string> = {
  login_ok: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400",
  login_fallo: "bg-amber-500/12 text-amber-700 dark:text-amber-400",
  login_bloqueado: "bg-rose-500/12 text-rose-700 dark:text-rose-400",
  login_emergencia: "bg-rose-500/12 text-rose-700 dark:text-rose-400",
  recuperacion_fallo_envio: "bg-rose-500/12 text-rose-700 dark:text-rose-400",
  usuario_borrado: "bg-rose-500/12 text-rose-700 dark:text-rose-400",
  usuario_baja: "bg-rose-500/12 text-rose-700 dark:text-rose-400",
};

function Aviso({ estado }: { estado: EstadoUsuarios | null }) {
  if (!estado?.error && !estado?.ok) return null;
  return (
    <p
      role="alert"
      className={cn(
        "rounded-md border px-3 py-2 text-xs break-words",
        estado.error
          ? "border-rose-500/30 bg-rose-500/5 text-rose-600 dark:text-rose-400"
          : "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"
      )}
    >
      {estado.error ?? estado.ok}
    </p>
  );
}

function FormularioAlta({ dominio, hayCorreo }: { dominio: string; hayCorreo: boolean }) {
  const [estado, enviar, pendiente] = useActionState<EstadoUsuarios | null, FormData>(
    accionCrearUsuario,
    null
  );
  const [conClave, setConClave] = React.useState(!hayCorreo);
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
          <span className="text-[11px] text-muted-foreground">Correo (para entrar)</span>
          <input
            name="usuario"
            type="email"
            required
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            pattern={patronCorreo(dominio)}
            title={`Tiene que ser un correo @${dominio}`}
            placeholder={`nombre@${dominio}`}
            className="input-base h-9"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-muted-foreground">Nombre y apellido</span>
          <input
            name="nombre"
            required
            maxLength={80}
            placeholder="Pablo Villalba"
            className="input-base h-9"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-muted-foreground">Rol</span>
          <select name="rol" defaultValue="lector" className="input-base h-9">
            <option value="lector">Lector — ve el tablero</option>
            <option value="admin">Administrador — además configura</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-muted-foreground">Cómo recibe la clave</span>
          <select
            value={conClave ? "clave" : "correo"}
            onChange={(e) => setConClave(e.target.value === "clave")}
            className="input-base h-9"
          >
            <option value="correo">Le llega un enlace por correo y elige la suya</option>
            <option value="clave">Le pongo una clave inicial a mano</option>
          </select>
        </label>
        {conClave && (
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-[11px] text-muted-foreground">Clave inicial</span>
            <CampoClave
              name="clave"
              required
              minLength={10}
              autoComplete="new-password"
              placeholder="mínimo 10 caracteres"
              // Arranca VISIBLE: quien la crea la tiene que poder leer para
              // pasársela. Es provisoria, esa persona después la cambia. Con el
              // ojito se tapa en un clic si hay alguien atrás.
              visiblePorDefecto
              className="input-base h-9"
            />
          </label>
        )}
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] text-muted-foreground">
          {conClave
            ? "La clave no se guarda en claro: se guarda su hash y no se puede volver a ver."
            : "El enlace vale 3 días y se usa una sola vez; nadie más que esa persona conoce su clave."}
        </span>
        <Button type="submit" size="sm" disabled={pendiente}>
          {pendiente ? "Creando…" : conClave ? "Crear" : "Crear e invitar"}
        </Button>
      </div>
      <Aviso estado={estado} />
    </form>
  );
}

function FilaUsuario({ usuario, dominio, hayCorreo }: { usuario: Usuario; dominio: string; hayCorreo: boolean }) {
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
            {usuario.ultimo_acceso ? "clave puesta por un admin" : "todavía no eligió su clave"}
          </span>
        )}
        <span className="ml-auto text-[11px] text-muted-foreground">
          {usuario.ultimo_acceso
            ? `entró ${formatFecha(usuario.ultimo_acceso)}`
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
          <EnviarEnlace usuario={usuario} hayCorreo={hayCorreo} />
          <ResetearClave usuario={usuario} />
          <CambiarCorreo usuario={usuario} dominio={dominio} />
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

function EnviarEnlace({ usuario, hayCorreo }: { usuario: Usuario; hayCorreo: boolean }) {
  const [estado, enviar, pendiente] = useActionState<EstadoUsuarios | null, FormData>(
    accionEnviarEnlace,
    null
  );
  return (
    <form action={enviar} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={usuario.id} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground">
          {hayCorreo
            ? "Le manda un enlace para que ponga una clave nueva; vos no la ves."
            : "Genera un enlace para que ponga una clave nueva (sin SMTP se muestra acá)."}
        </span>
        <Button type="submit" size="sm" disabled={pendiente || !usuario.activo}>
          {pendiente ? "Enviando…" : usuario.ultimo_acceso ? "Enviar enlace para restablecer" : "Reenviar invitación"}
        </Button>
      </div>
      <Aviso estado={estado} />
    </form>
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
          <span className="text-[11px] text-muted-foreground">O ponerle una clave a mano</span>
          <CampoClave
            name="clave"
            required
            minLength={10}
            autoComplete="new-password"
            placeholder="mínimo 10 caracteres"
            // Misma razón que en el alta: el admin se la tiene que dictar.
            visiblePorDefecto
            className="input-base h-9"
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

function CambiarCorreo({ usuario, dominio }: { usuario: Usuario; dominio: string }) {
  const [estado, enviar, pendiente] = useActionState<EstadoUsuarios | null, FormData>(
    accionCambiarCorreo,
    null
  );
  return (
    <form action={enviar} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={usuario.id} />
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-[11px] text-muted-foreground">Correo</span>
          <input
            name="correo"
            type="email"
            required
            defaultValue={usuario.usuario}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            pattern={patronCorreo(dominio)}
            title={`Tiene que ser un correo @${dominio}`}
            placeholder={`nombre@${dominio}`}
            className="input-base h-9"
          />
        </label>
        <Button type="submit" size="sm" variant="outline" disabled={pendiente}>
          {pendiente ? "Guardando…" : "Cambiar correo"}
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
