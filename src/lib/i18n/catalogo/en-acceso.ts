/** Frases en inglés: acceso (entrar, olvidé, restablecer, mi clave, mi cuenta, correo, foto de perfil). Clave = el texto en castellano tal cual está en el código. */
const EN: Record<string, string> = {

  // --- entrar/ (formulario, página, acción)
  "Entrá a tu tablero": "Sign in to your dashboard",
  "Con tu correo @{dominio} y tu clave.": "With your @{dominio} email and password.",
  "Correo": "Email",
  "Clave": "Password",
  "Entrar": "Sign in",
  "Entrando…": "Signing in…",
  "Olvidé mi clave": "Forgot my password",
  "Solo entran correos @{dominio}. ¿No tenés cuenta? Pedísela a Croman.<br/>El tablero incluye precios y stock propios: no compartas tu clave.":
    "Only @{dominio} emails can sign in. Don't have an account? Ask Croman.<br/>The dashboard includes our own prices and stock: don't share your password.",
  "Con la clave general del equipo. Abre una sesión de administrador por 24 horas y queda registrado.":
    "With the team's shared password. It opens an administrator session for 24 hours and is logged.",
  "Esta entrada no es de una persona: queda como administrador por un día y deja constancia en la auditoría.":
    "This sign-in does not belong to a person: it counts as an administrator for one day and is recorded in the audit log.",
  "Clave general": "Shared password",
  "Volver a entrar con mi correo": "Back to signing in with my email",
  "Tiene que ser un correo @{dominio}": "It has to be an @{dominio} email",
  "nombre@{dominio}": "name@{dominio}",
  "Tu clave quedó guardada. Entrá con tu correo y la clave nueva.":
    "Your password has been saved. Sign in with your email and the new password.",
  "Tu sesión se cerró porque cambió tu clave, tu rol o tu acceso. Volvé a entrar.":
    "Your session ended because your password, role or access changed. Please sign in again.",
  "Tu sesión venció. Volvé a entrar.": "Your session expired. Please sign in again.",
  "El tablero no tiene clave configurada; no hace falta entrar.":
    "The dashboard has no password configured; there is no need to sign in.",
  "Demasiados intentos. Probá de nuevo en {espera} segundos.": "Too many attempts. Try again in {espera} seconds.",
  "Demasiados intentos con esa cuenta. Probá de nuevo en {minutos} minutos.":
    "Too many attempts on that account. Try again in {minutos} minutes.",
  "No se pudo verificar el usuario (la base no responde). Avisale a Croman; mientras tanto se puede entrar con la clave general.":
    "The user could not be verified (the database isn't responding). Let Croman know; in the meantime you can sign in with the shared password.",
  "Correo o clave incorrectos.": "Incorrect email or password.",

  // --- entrar/olvide/
  "Escribí tu correo de la empresa y te mandamos un enlace para poner una clave nueva.":
    "Enter your company email and we'll send you a link to set a new password.",
  "Enviarme el enlace": "Send me the link",
  "Enviando…": "Sending…",
  "Revisá tu correo": "Check your email",
  "Volver a entrar": "Back to sign in",
  "¿Te equivocaste de correo? Probá con otro": "Wrong email? Try another one",
  "Si ese correo tiene cuenta, en un minuto le llega un enlace para poner una clave nueva. Vale una hora. Revisá también el spam.":
    "If that email has an account, a link to set a new password will reach it within a minute. It is valid for one hour. Check your spam folder too.",
  "Demasiados pedidos. Probá de nuevo en {minutos} minutos.": "Too many requests. Try again in {minutos} minutes.",
  "El envío de correos no está configurado en el servidor. Pedile a un administrador que te restablezca la clave.":
    "Email sending is not configured on the server. Ask an administrator to reset your password.",

  // --- restablecer/ (poner clave nueva con el enlace)
  "Elegí tu clave": "Choose your password",
  "Hola {nombre}. Tu usuario es <b>{correo}</b>.": "Hi {nombre}. Your username is <b>{correo}</b>.",
  "Clave nueva": "New password",
  "Repetir la clave": "Repeat the password",
  "Guardar la clave": "Save password",
  "Guardando…": "Saving…",
  "al menos {minimo} caracteres": "at least {minimo} characters",
  "la misma otra vez": "the same one again",
  "Mínimo {minimo} caracteres; no puede contener tu usuario ni el nombre de la empresa.":
    "At least {minimo} characters; it can't contain your username or the company name.",
  "No se pudo verificar el enlace": "The link could not be verified",
  "La base no respondió. Probá de nuevo en un rato.": "The database did not respond. Try again in a while.",
  "Este enlace ya no sirve": "This link no longer works",
  "Venció, ya se usó o no es válido. Los enlaces valen una hora y se usan una sola vez.":
    "It expired, was already used or is not valid. Links are valid for one hour and can be used only once.",
  "Pedir un enlace nuevo": "Request a new link",
  "Las dos claves no coinciden.": "The two passwords don't match.",
  "Este enlace ya no sirve: venció, ya se usó o no es válido. Pedí uno nuevo desde «Olvidé mi clave».":
    "This link no longer works: it expired, was already used or is not valid. Request a new one from “Forgot my password”.",
  "Este enlace ya no sirve. Pedí uno nuevo desde «Olvidé mi clave».":
    "This link no longer works. Request a new one from “Forgot my password”.",

  // --- lib/auth/usuarios.ts (reglas de la clave y del correo)
  "La clave necesita al menos {n} caracteres.": "The password needs at least {n} characters.",
  "La clave no puede pasar los 200 caracteres.": "The password can't be longer than 200 characters.",
  "La clave no puede empezar ni terminar con espacios.": "The password can't start or end with spaces.",
  "Esa clave es demasiado fácil de adivinar. Elegí otra.": "That password is too easy to guess. Choose another one.",
  "La clave no puede contener el nombre de la empresa.": "The password can't contain the company name.",
  "La clave no puede contener tu usuario de correo.": "The password can't contain your email username.",
  "Falta el correo.": "The email is missing.",
  "El correo no puede pasar los 120 caracteres.": "The email can't be longer than 120 characters.",
  "El usuario tiene que ser un correo de la empresa (nombre@{dominio}).":
    "The username has to be a company email (name@{dominio}).",
  "El correo tiene caracteres que no van (solo letras, números, punto, guion y guion bajo).":
    "The email has characters that aren't allowed (only letters, numbers, dots, hyphens and underscores).",
  "Solo pueden entrar correos @{dominio}.": "Only @{dominio} emails can sign in.",

  // --- mi-clave/ (cambiar la propia clave)
  "Mi clave": "My password",
  "Estás como {quien}. Cambiá acá la clave con la que entrás.":
    "You're signed in as {quien}. Change the password you sign in with here.",
  "Entraste con la clave general del equipo, que no es de una persona en particular.":
    "You signed in with the team's shared password, which doesn't belong to any one person.",
  "Clave actual": "Current password",
  "Repetir la clave nueva": "Repeat the new password",
  "Mínimo 10 caracteres.": "At least 10 characters.",
  "Cambiar mi clave": "Change my password",
  "Cambiando…": "Changing…",
  "El tablero no tiene claves configuradas.": "The dashboard has no passwords configured.",
  "Entraste con la clave general del equipo, que no es de nadie en particular: esa se cambia en Coolify. Entrá con tu usuario para cambiar tu clave.":
    "You signed in with the team's shared password, which belongs to no one in particular: that one is changed in Coolify. Sign in with your own user to change your password.",
  "Las dos claves nuevas no coinciden.": "The two new passwords don't match.",
  "La clave nueva es igual a la actual.": "The new password is the same as the current one.",
  "Tu usuario ya no existe.": "Your user no longer exists.",
  "La clave actual no es correcta.": "The current password is incorrect.",
  "Listo, tu clave quedó cambiada. Esta sesión sigue abierta; las que tuvieras abiertas en otros dispositivos se cerraron.":
    "Done, your password was changed. This session stays open; any you had open on other devices were closed.",

  // --- mi-cuenta/ (perfil, foto, sesión)
  "Perfil": "Profile",
  "Qué podés hacer": "What you can do",
  "Ver todo y administrar usuarios, metas y marcas.": "See everything and manage users, targets and brands.",
  "Ver todo menos Configuración y Rentabilidad.": "See everything except Settings and Profitability.",
  "Último acceso": "Last sign-in",
  "Cuenta creada": "Account created",
  "Sesión": "Session",
  "Cerrala si estás en una computadora que no es tuya o si vas a dejar la reunión.":
    "Sign out if you're on a computer that isn't yours or if you're leaving the meeting.",
  "Esta sesión no es una cuenta personal.": "This session is not a personal account.",
  "No se pudieron leer tus datos (la base no responde). Probá de nuevo en un rato.":
    "Your details could not be read (the database isn't responding). Try again in a while.",
  "Entraste con la clave general del equipo (acceso de emergencia). Abre una sesión de administrador por un día y no tiene foto, correo ni clave propia. Para tener lo tuyo, entrá con tu correo.":
    "You signed in with the team's shared password (emergency access). It opens an administrator session for one day and has no photo, email or password of its own. To get your own, sign in with your email.",
  "El tablero no tiene claves configuradas: cualquiera con la URL entra, y no hay cuentas que mostrar.":
    "The dashboard has no passwords configured: anyone with the URL gets in, and there are no accounts to show.",
  "desarrollo": "development",
  "Cambiar foto": "Change photo",
  "Subir foto": "Upload photo",
  "Quitar": "Remove",
  "Quitando…": "Removing…",
  "Sí, quitar la foto": "Yes, remove the photo",
  "Cancelar": "Cancel",
  "JPG, PNG o WebP. También podés arrastrar una imagen sobre tu foto.":
    "JPG, PNG or WebP. You can also drag an image onto your photo.",
  "Este acceso no es una cuenta personal, así que no tiene foto. Entrá con tu correo para ponerte la tuya.":
    "This access is not a personal account, so it has no photo. Sign in with your email to set yours.",
  "Elegir una imagen para tu foto de perfil": "Choose an image for your profile photo",
  "Ese archivo no es una imagen. Elegí un JPG, un PNG o un WebP.":
    "That file is not an image. Choose a JPG, PNG or WebP.",
  "Esa imagen pesa más de 15 MB. Elegí una más liviana.": "That image is over 15 MB. Choose a lighter one.",
  "No se pudo guardar la foto.": "The photo could not be saved.",
  "Listo, tu foto quedó guardada.": "Done, your photo was saved.",
  "No se pudo conectar con el servidor. Revisá tu conexión y probá de nuevo.":
    "Could not connect to the server. Check your connection and try again.",
  "Quitaste tu foto. Se ven tus iniciales.": "You removed your photo. Your initials are shown.",
  "No se pudo quitar la foto. Probá de nuevo.": "The photo could not be removed. Try again.",

  // --- components/perfil/recortador-foto.tsx
  "Encuadrá tu foto": "Frame your photo",
  "Arrastrala para moverla y acercala con el control de abajo o con la rueda. Se guarda como un cuadrado y se muestra en círculo.":
    "Drag it to move it and zoom with the slider below or the mouse wheel. It is saved as a square and shown as a circle.",
  "Abriendo la imagen…": "Opening the image…",
  "No se pudo abrir esa imagen.": "That image could not be opened.",
  "Vista previa del encuadre de tu foto": "Preview of your photo framing",
  "Zoom": "Zoom",
  "Acercar la foto": "Zoom the photo",
  "Guardar foto": "Save photo",
  "Ese archivo no se pudo leer como imagen. Probá con un JPG o un PNG.":
    "That file could not be read as an image. Try a JPG or PNG.",
  "No se pudo comprimir la imagen. Probá con otra foto.": "The image could not be compressed. Try another photo.",
  "No se pudo preparar la foto. Probá de nuevo.": "The photo could not be prepared. Try again.",

  // --- api/mi-cuenta/foto + lib/foto-perfil.ts
  "Demasiados cambios de foto. Probá de nuevo en {minutos} minutos.":
    "Too many photo changes. Try again in {minutos} minutes.",
  "El acceso de emergencia no tiene foto de perfil.": "Emergency access has no profile photo.",
  "El tablero no tiene sesiones.": "The dashboard has no sessions.",
  "La foto tiene que ser un JPEG.": "The photo has to be a JPEG.",
  "Origen no permitido.": "Origin not allowed.",
  "Sesión requerida.": "Sign-in required.",
  "La imagen es demasiado pesada.": "The image file is too large.",
  "La imagen llegó vacía.": "The image arrived empty.",
  "El archivo no es una imagen JPEG válida.": "The file is not a valid JPEG image.",
  "La imagen es demasiado chica.": "The image dimensions are too small.",
  "La imagen es demasiado grande.": "The image dimensions are too large.",

  // --- components/acceso/ (marco y panel ilustrado)
  "Santa Rosa Paraguay S.A. · Inteligencia Comercial": "Santa Rosa Paraguay S.A. · Commercial Intelligence",
  "Del dato a la decisión, en un solo lugar.": "From data to decision, in one place.",
  "Importar vs. patentar": "Imports vs. registrations",
  "Matriculaciones, importaciones, precios y stock propio, con un copiloto que contesta citando de dónde sacó cada cifra.":
    "Registrations, imports, prices and our own stock, with a copilot that answers and cites where each figure came from.",
  "cita de dónde sacó cada cifra": "cites where each figure came from",
  "¿Qué marca ganó más participación este año?": "Which brand gained the most share this year?",

  // --- lib/auth/correo.ts (el correo con el enlace)
  "Restablecer tu clave del Advisor": "Reset your Advisor password",
  "Tu acceso al Advisor de Santa Rosa": "Your access to the Santa Rosa Advisor",
  "Tu clave del Advisor fue restablecida": "Your Advisor password was reset",
  "Hola {nombre},": "Hi {nombre},",
  "Alguien pidió restablecer la clave de tu cuenta del Advisor (el tablero de mercado de Santa Rosa). Si fuiste vos, entrá al enlace y elegí una clave nueva. Si no fuiste vos, ignorá este correo: tu clave sigue igual.":
    "Someone asked to reset the password of your Advisor account (the Santa Rosa market dashboard). If it was you, open the link and choose a new password. If it wasn't you, ignore this email: your password stays the same.",
  "{quien} te dio acceso al Advisor, el tablero de inteligencia comercial de Santa Rosa. Para entrar, elegí tu clave desde este enlace. Tu usuario es tu correo.":
    "{quien} gave you access to the Advisor, Santa Rosa's commercial intelligence dashboard. To sign in, choose your password from this link. Your username is your email.",
  "Te dieron acceso al Advisor, el tablero de inteligencia comercial de Santa Rosa. Para entrar, elegí tu clave desde este enlace. Tu usuario es tu correo.":
    "You have been given access to the Advisor, Santa Rosa's commercial intelligence dashboard. To sign in, choose your password from this link. Your username is your email.",
  "{quien} restableció la clave de tu cuenta del Advisor. Elegí una clave nueva desde este enlace; la anterior ya no sirve.":
    "{quien} reset the password of your Advisor account. Choose a new password from this link; the old one no longer works.",
  "Se restableció la clave de tu cuenta del Advisor. Elegí una clave nueva desde este enlace; la anterior ya no sirve.":
    "The password of your Advisor account was reset. Choose a new password from this link; the old one no longer works.",
  "El enlace vale {validez} y se puede usar una sola vez.":
    "The link is valid for {validez} and can be used only once.",
  "El Advisor incluye precios, stock e inteligencia de la competencia: no compartas tu clave ni este enlace.":
    "The Advisor includes prices, stock and competitive intelligence: don't share your password or this link.",
  "— Santa Rosa · Innovación": "— Santa Rosa · Innovation",
  "Elegir mi clave": "Choose my password",
  "Poner una clave nueva": "Set a new password",
  "Si el botón no abre, copiá este enlace en el navegador:":
    "If the button doesn't open, copy this link into your browser:",
  "{n} días": "{n} days",
  "{n} minutos": "{n} minutes",

  // --- configuracion/ (acciones de metas y competidores)
  "Sesión vencida. Volvé a entrar.": "Your session expired. Please sign in again.",
};

export default EN;
