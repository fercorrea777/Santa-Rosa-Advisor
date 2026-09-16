import nodemailer from "nodemailer";

/**
 * Correos del tablero: el enlace para poner clave (olvido, invitación,
 * reset por un admin). Nada más sale por acá.
 *
 * SMTP: la misma casilla de Google Workspace que ya usan Tasación Renew y
 * Bitrix (bitrix@santarosa.com.py, smtp.gmail.com:587 con clave de
 * aplicación). Las credenciales viven en el entorno del contenedor
 * (Coolify), no en el repo. Sin `SMTP_HOST` configurado, `enviar` tira un
 * error claro y quien lo llama decide qué decirle a la persona.
 *
 * Los enlaces se arman con `APP_URL` (https://advisor.santarosa.lat): el
 * host del request NO sirve, porque detrás del proxy es el interno.
 */

export interface ConfigCorreo {
  host: string;
  port: number;
  /** Sin usuario y clave no se autentica: es el caso del SMTP de prueba
   *  en local (aiosmtpd), nunca el de producción. */
  user: string | null;
  pass: string | null;
  from: string;
  appUrl: string;
}

export function configCorreo(): ConfigCorreo | null {
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  const user = process.env.SMTP_USER || null;
  return {
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    user,
    pass: process.env.SMTP_PASS || null,
    from: process.env.SMTP_FROM ?? `Santa Rosa Advisor <${user ?? "advisor@santarosa.com.py"}>`,
    appUrl: urlApp(),
  };
}

export function hayCorreo(): boolean {
  return configCorreo() !== null;
}

export function urlApp(): string {
  return (process.env.APP_URL ?? "https://advisor.santarosa.lat").replace(/\/+$/, "");
}

function escapar(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function enviar(para: string, asunto: string, texto: string, html: string): Promise<void> {
  const c = configCorreo();
  if (!c) throw new Error("SMTP sin configurar (SMTP_HOST, SMTP_USER, SMTP_PASS).");
  const transporte = nodemailer.createTransport({
    host: c.host,
    port: c.port,
    secure: c.port === 465,
    auth: c.user && c.pass ? { user: c.user, pass: c.pass } : undefined,
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  });
  await transporte.sendMail({ from: c.from, to: para, subject: asunto, text: texto, html });
}

export type TipoEnlace = "olvido" | "invitacion" | "reset_admin";

const TITULOS: Record<TipoEnlace, string> = {
  olvido: "Restablecer tu clave del Advisor",
  invitacion: "Tu acceso al Advisor de Santa Rosa",
  reset_admin: "Tu clave del Advisor fue restablecida",
};

/**
 * El correo con el enlace para poner clave. El texto cambia según el motivo
 * (la persona pidió, la invitaron, un admin le reseteó), el enlace es el
 * mismo mecanismo. Nunca lleva la clave: la elige la persona.
 */
export async function enviarEnlaceClave(datos: {
  para: string;
  nombre: string;
  token: string;
  tipo: TipoEnlace;
  minutosValido: number;
  porQuien?: string;
}): Promise<void> {
  const enlace = `${urlApp()}/restablecer?token=${encodeURIComponent(datos.token)}`;
  const validez =
    datos.minutosValido >= 60 * 24
      ? `${Math.round(datos.minutosValido / (60 * 24))} días`
      : `${datos.minutosValido} minutos`;
  const nombre = datos.nombre.trim() || datos.para;

  const intro: Record<TipoEnlace, string> = {
    olvido:
      "Alguien pidió restablecer la clave de tu cuenta del Advisor (el tablero de mercado de Santa Rosa). Si fuiste vos, entrá al enlace y elegí una clave nueva. Si no fuiste vos, ignorá este correo: tu clave sigue igual.",
    invitacion:
      `${datos.porQuien ? `${datos.porQuien} te dio` : "Te dieron"} acceso al Advisor, el tablero de inteligencia comercial de Santa Rosa. Para entrar, elegí tu clave desde este enlace. Tu usuario es tu correo.`,
    reset_admin:
      `${datos.porQuien ? `${datos.porQuien} restableció` : "Se restableció"} la clave de tu cuenta del Advisor. Elegí una clave nueva desde este enlace; la anterior ya no sirve.`,
  };

  const texto = [
    `Hola ${nombre},`,
    "",
    intro[datos.tipo],
    "",
    enlace,
    "",
    `El enlace vale ${validez} y se puede usar una sola vez.`,
    "",
    "El Advisor incluye precios, stock e inteligencia de la competencia: no compartas tu clave ni este enlace.",
    "",
    "— Santa Rosa · Innovación",
  ].join("\n");

  const html = `
<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1f2430">
  <p style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#6b7280;margin:0 0 16px">Santa Rosa · Advisor</p>
  <p style="font-size:16px;margin:0 0 12px">Hola ${escapar(nombre)},</p>
  <p style="font-size:15px;line-height:1.5;margin:0 0 20px">${escapar(intro[datos.tipo])}</p>
  <p style="margin:0 0 20px">
    <a href="${escapar(enlace)}" style="display:inline-block;background:#1b2559;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">
      ${datos.tipo === "invitacion" ? "Elegir mi clave" : "Poner una clave nueva"}
    </a>
  </p>
  <p style="font-size:13px;color:#6b7280;line-height:1.5;margin:0 0 8px">Si el botón no abre, copiá este enlace en el navegador:<br><span style="word-break:break-all">${escapar(enlace)}</span></p>
  <p style="font-size:13px;color:#6b7280;line-height:1.5;margin:0 0 8px">El enlace vale ${validez} y se puede usar una sola vez.</p>
  <p style="font-size:13px;color:#6b7280;line-height:1.5;margin:16px 0 0">El Advisor incluye precios, stock e inteligencia de la competencia: no compartas tu clave ni este enlace.</p>
</div>`;

  await enviar(datos.para, TITULOS[datos.tipo], texto, html);
}
