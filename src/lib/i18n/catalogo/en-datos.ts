/** Frases en inglés: datos (estado de los datos, calidad de datos, configuración, tipos de archivo). Clave = el texto en castellano tal cual está en el código. */
const EN: Record<string, string> = {

  // --- configuracion/ (acciones de metas y competidores)
  "Necesitás rol de administrador.": "You need the administrator role.",
  "Hay un valor que no es un número. Revisá y volvé a guardar.": "One value is not a number. Check it and save again.",
  "La participación va en porcentaje: entre 0 y 100.": "Share is a percentage: between 0 and 100.",
  "El ranking objetivo es una posición entera (1 a 60).": "The target rank is a whole position (1 to 60).",
  "Las unidades mensuales van como entero positivo.": "Monthly units must be a positive whole number.",
  "Hay un nombre de competidor con caracteres raros o demasiado largo.":
    "A competitor name has unusual characters or is too long.",
  "Máximo 20 competidores: es una watchlist, no el mercado entero.":
    "Maximum 20 competitors: it's a watchlist, not the whole market.",
  "No se pudo escribir parametros.json en el servidor. Si pasa siempre, es un tema de permisos del volumen /datos.":
    "Could not write parametros.json on the server. If it always happens, it's a permissions issue on the /datos volume.",
  "participación {p}%": "share {p}%",
  "ranking #{r}": "rank #{r}",
  "{u} u./mes": "{u} units/month",
  "1 competidores": "1 competitor",
  "{n} competidores": "{n} competitors",
  "Guardado: {resumen} · {cuantos}.": "Saved: {resumen} · {cuantos}.",
  "Guardado sin metas definidas · {cuantos}.": "Saved with no targets defined · {cuantos}.",
  "Año inválido.": "Invalid year.",
  "{marca}, mes {mes}: \"{crudo}\" no es una cantidad válida de vehículos.":
    "{marca}, month {mes}: \"{crudo}\" is not a valid number of vehicles.",
  "Guardado {anio}: {cargadas} casilleros con meta, {total} vehículos en el año.":
    "Saved {anio}: {cargadas} cells with a target, {total} vehicles for the year.",

  // --- configuracion/editor.tsx y metas.tsx (metas)
  "Metas {anio} y competidores clave": "{anio} targets and key competitors",
  "Contra las metas se compara el share real en el Centro de Inteligencia; los competidores son la watchlist que resaltan los rankings. Dejá vacío lo que todavía no esté definido: la app muestra «sin definir», nunca un cero inventado.":
    "Actual share in the Intelligence center is compared against the targets; competitors are the watchlist the rankings highlight. Leave blank anything not yet defined: the app shows “not set”, never an invented zero.",
  "Ranking objetivo": "Target rank",
  "posición del grupo": "group position",
  "Unidades objetivo": "Target units",
  "por mes, todo el grupo": "per month, whole group",
  "ej. 8,5": "e.g. 8.5",
  "ej. 3": "e.g. 3",
  "ej. 400": "e.g. 400",
  "Competidores clave": "Key competitors",
  "Un nombre por línea (o separados por coma), tal como los escribe CADAM.":
    "One name per line (or comma-separated), exactly as CADAM writes them.",
  "Guardar metas y competidores": "Save targets and competitors",
  "Metas de vehículos por marca y mes": "Vehicle targets by brand and month",
  "Contra esto se compara lo facturado en Cars (Nuestra operación), mes a mes y en el año: ventas propias, no matriculaciones del mercado.":
    "What is invoiced in Cars (Our operation) is compared against this, month by month and for the year: our own sales, not market registrations.",
  "Debajo de cada meta, en gris, lo facturado ese mes.": "Below each target, in gray, what was invoiced that month.",
  "Dejá vacío lo que no tenga meta: la app muestra «sin meta», nunca un cero.":
    "Leave blank anything without a target: the app shows “no target”, never a zero.",
  "Cargado desde <i>{archivo}</i> (archivo del {modificado}, cargado el {cargado} UTC, versión {version}). Lo que edites acá lo pisa la próxima carga del Excel. El presupuesto anual es la cifra original del año y no se edita.":
    "Loaded from <i>{archivo}</i> (file dated {modificado}, loaded on {cargado} UTC, version {version}). Anything you edit here is overwritten by the next Excel load. The annual budget is the original figure for the year and cannot be edited.",
  "Para cargar otro año: elegilo, completá la grilla y guardá.":
    "To load another year: select it, fill in the grid and save.",
  "Ppto. anual": "Annual budget",
  "meta conjunta": "combined target",
  "Facturado en Cars, {mes} {anio}": "Invoiced in Cars, {mes} {anio}",
  "{n} fact.": "{n} invoiced",
  "Guardar metas por mes": "Save monthly targets",

  // --- configuracion/usuarios.tsx (alta y mantenimiento de usuarios)
  "Usuarios": "Users",
  "Cada persona entra con su correo @{dominio} y su clave. Los <b>lectores</b> ven el tablero; los <b>administradores</b> además entran acá, editan metas, manejan usuarios y ven costos y márgenes en Acciones comerciales.":
    "Each person signs in with their @{dominio} email and password. <b>Viewers</b> see the dashboard; <b>administrators</b> also come in here, edit targets, manage users and see costs and margins in Commercial actions.",
  "El servidor no tiene SMTP configurado (SMTP_HOST, SMTP_USER, SMTP_PASS): las invitaciones y los enlaces de clave se muestran acá en vez de mandarse por correo, y «Olvidé mi clave» no funciona hasta configurarlo.":
    "The server has no SMTP configured (SMTP_HOST, SMTP_USER, SMTP_PASS): invitations and password links are shown here instead of being emailed, and “Forgot my password” won't work until it is configured.",
  "Todavía no hay usuarios. Mientras no haya ninguno, se entra con la clave general del equipo.":
    "There are no users yet. Until there is one, people sign in with the team's shared password.",
  "La <b>clave general</b> (<code>ADVISOR_CLAVE</code>) es la llave de emergencia: sirve si la base no responde o si se borra al último admin. No está en la pantalla de entrada; se usa desde <code>/entrar?modo=emergencia</code>, abre una sesión de un día y queda registrada. Cambiarla en Coolify cierra <i>todas</i> las sesiones abiertas. Dar de baja a alguien, cambiarle la clave o el rol le cierra la sesión en menos de un minuto.":
    "The <b>shared password</b> (<code>ADVISOR_CLAVE</code>) is the emergency key: it works if the database is down or if the last admin is deleted. It isn't on the sign-in screen; it is used from <code>/entrar?modo=emergencia</code>, opens a one-day session and is logged. Changing it in Coolify closes <i>all</i> open sessions. Deactivating someone, or changing their password or role, closes their session within a minute.",
  "Registro de accesos": "Access log",
  "Quién entró, quién falló y qué tocó cada administrador. Los últimos {n} movimientos.":
    "Who signed in, who failed and what each administrator changed. The last {n} events.",
  "Todavía no hay movimientos registrados.": "No events recorded yet.",
  "Crear usuario": "Create user",
  "Correo (para entrar)": "Email (to sign in)",
  "Nombre y apellido": "First and last name",
  "Rol": "Role",
  "Lector — ve el tablero": "Viewer — sees the dashboard",
  "Administrador — además configura": "Administrator — also manages settings",
  "Cómo recibe la clave": "How they get the password",
  "Le llega un enlace por correo y elige la suya": "They get a link by email and choose their own",
  "Le pongo una clave inicial a mano": "I set an initial password by hand",
  "Clave inicial": "Initial password",
  "mínimo 10 caracteres": "at least 10 characters",
  "La clave no se guarda en claro: se guarda su hash y no se puede volver a ver.":
    "The password isn't stored in plain text: only its hash is, and it can't be viewed again.",
  "El enlace vale 3 días y se usa una sola vez; nadie más que esa persona conoce su clave.":
    "The link is valid for 3 days and can be used only once; no one but that person knows their password.",
  "Creando…": "Creating…",
  "Crear": "Create",
  "Crear e invitar": "Create and invite",
  "Admin": "Admin",
  "De baja": "Deactivated",
  "clave puesta por un admin": "password set by an admin",
  "todavía no eligió su clave": "hasn't chosen a password yet",
  "entró {fecha}": "signed in {fecha}",
  "nunca entró": "never signed in",
  "Administrar": "Manage",
  "Le manda un enlace para que ponga una clave nueva; vos no la ves.":
    "Sends them a link to set a new password; you never see it.",
  "Genera un enlace para que ponga una clave nueva (sin SMTP se muestra acá).":
    "Generates a link for them to set a new password (without SMTP it is shown here).",
  "Enviar enlace para restablecer": "Send reset link",
  "Reenviar invitación": "Resend invitation",
  "O ponerle una clave a mano": "Or set a password by hand",
  "Resetear clave": "Reset password",
  "Cambiar correo": "Change email",
  "Hacer administrador": "Make administrator",
  "Bajar a lector": "Downgrade to viewer",
  "Dar de baja": "Deactivate",
  "Reactivar": "Reactivate",
  "Borrar": "Delete",
  "Borrar usuario": "Delete user",
  "¿Borrar a <b>{correo}</b>? No se puede deshacer.": "Delete <b>{correo}</b>? This can't be undone.",
  "Sí, borrar": "Yes, delete",
  "Borrando…": "Deleting…",

  // --- configuracion/usuarios.tsx: rótulos y detalles del registro de accesos
  "entró": "signed in",
  "falló": "failed",
  "bloqueado": "blocked",
  "clave general": "shared password",
  "pidió enlace": "requested link",
  "enlace enviado": "link sent",
  "correo falló": "email failed",
  "clave nueva": "new password",
  "cambió su clave": "changed password",
  "invitación": "invitation",
  "reset por admin": "admin reset",
  "enlace de reset": "reset link",
  "rol": "role",
  "reactivado": "reactivated",
  "borrado": "deleted",
  "correo": "email",
  "sesión cortada": "session ended",
  "admin": "admin",
  "lector": "viewer",
  "por IP, {s}s": "by IP, {s}s",
  "por cuenta, {s}s": "by account, {s}s",
  "frenado por casilla": "throttled per mailbox",
  "sin SMTP, enlace mostrado a {quien}": "no SMTP, link shown to {quien}",
  "{rol}, por {quien}, con invitación por correo": "{rol}, by {quien}, with an email invitation",
  "{rol}, por {quien}, con clave inicial": "{rol}, by {quien}, with an initial password",
  "clave puesta a mano por {quien}": "password set by hand by {quien}",
  "antes {correo}, por {quien}": "was {correo}, by {quien}",
  "{antes} → {despues}, por {quien}": "{antes} → {despues}, by {quien}",
  "por {quien}": "by {quien}",

  // --- configuracion/acciones-usuarios.ts (lo que contestan las acciones)
  "El tablero todavía no tiene clave general (ADVISOR_CLAVE). Ponela primero: sin eso no hay sesiones y los usuarios no protegen nada.":
    "The dashboard doesn't have a shared password yet (ADVISOR_CLAVE). Set it first: without it there are no sessions and user accounts protect nothing.",
  "Tu usuario ya no está activo.": "Your user is no longer active.",
  "El envío de correo no está configurado en el servidor. Pasale este enlace a {nombre} por un canal privado (vale {horas} h, un solo uso): {enlace}":
    "Email sending is not configured on the server. Pass this link to {nombre} through a private channel (valid for {horas} h, single use): {enlace}",
  "No se pudo enviar el correo a {correo}: {motivo}": "Could not send the email to {correo}: {motivo}",
  "Le mandamos a {correo} un enlace para elegir su clave (vale {validez}, un solo uso).":
    "We sent {correo} a link to choose their password (valid for {validez}, single use).",
  "Le mandamos a {correo} un enlace para poner una clave nueva (vale {validez}, un solo uso).":
    "We sent {correo} a link to set a new password (valid for {validez}, single use).",
  "Falta el nombre de la persona (hasta 80 caracteres).": "The person's name is missing (up to 80 characters).",
  "Rol inválido.": "Invalid role.",
  "Ya existe un usuario con el correo {correo}.": "A user with the email {correo} already exists.",
  "No se pudo crear: {motivo}": "Could not create it: {motivo}",
  "Usuario {usuario} creado, pero {error} Podés reenviarle el enlace desde su fila.":
    "User {usuario} was created. {error} — you can resend the link from their row.",
  "Usuario {usuario} creado. {detalle}": "User {usuario} created. {detalle}",
  "Usuario {usuario} creado. Pasale la clave por un canal privado — no queda guardada en ningún lado y no se puede volver a ver.":
    "User {usuario} created. Pass the password along through a private channel — it is not stored anywhere and cannot be viewed again.",
  "Usuario inválido.": "Invalid user.",
  "Ese usuario ya no existe.": "That user no longer exists.",
  "Clave de {correo} cambiada; sus sesiones abiertas se cerraron. Le va a figurar como pendiente de cambiar hasta que la cambie esa persona.":
    "{correo}'s password was changed; their open sessions were closed. It will show as pending change until that person changes it.",
  "Está dado de baja: habilitalo antes de mandarle el enlace.":
    "This user is deactivated: reactivate them before sending the link.",
  "Es el mismo correo que ya tenía.": "That is the same email it already had.",
  "No se pudo cambiar: {motivo}": "Could not change it: {motivo}",
  "{nombre} ahora entra como {correo}. Sus sesiones abiertas se cerraron.":
    "{nombre} now signs in as {correo}. Their open sessions were closed.",
  "Es el único administrador activo. Nombrá otro antes de bajarlo a lector.":
    "This is the only active administrator. Appoint another one before downgrading them to viewer.",
  "{correo} ahora es admin. Le aplica en menos de un minuto.":
    "{correo} is now an administrator. It applies within a minute.",
  "{correo} ahora es lector. Le aplica en menos de un minuto.":
    "{correo} is now a viewer. It applies within a minute.",
  "Es el único administrador activo. Nombrá otro antes de darlo de baja.":
    "This is the only active administrator. Appoint another one before deactivating them.",
  "No podés darte de baja a vos mismo.": "You can't deactivate yourself.",
  "{correo} queda habilitado.": "{correo} is now reactivated.",
  "{correo} queda deshabilitado; si tiene una sesión abierta se le cierra en menos de un minuto.":
    "{correo} is now deactivated; if they have a session open, it will be closed within a minute.",
  "No podés borrarte a vos mismo.": "You can't delete yourself.",
  "Es el único administrador activo. Nombrá otro antes de borrarlo.":
    "This is the only active administrator. Appoint another one before deleting them.",
  "Usuario {correo} borrado.": "User {correo} deleted.",

  // --- configuracion/page.tsx y transmision.tsx
  "Quién entra, qué metas se persiguen y qué catálogo usa el tablero. Metas y competidores se guardan en parametros.json, el mismo archivo que la app ya leía.":
    "Who gets in, which targets are pursued and which catalog the dashboard uses. Targets and competitors are saved in parametros.json, the same file the app already read.",
  "Último informe CADAM: {periodo} · {anio} (ene–mes {mes}) vs. {anterior}.":
    "Latest CADAM report: {periodo} · {anio} (Jan–month {mes}) vs. {anterior}.",
  "Sin informes ingestados.": "No reports ingested.",
  "Acceso": "Access",
  "Cada persona entra con su correo de la empresa. Los administradores manejan usuarios y ven costos y márgenes; los lectores ven el tablero.":
    "Each person signs in with their company email. Administrators manage users and see costs and margins; viewers see the dashboard.",
  "No se pudo leer la lista de usuarios: {motivo}. Mientras tanto se entra con la clave general.":
    "Could not read the user list: {motivo}. In the meantime, sign in with the shared password.",
  "Metas": "Targets",
  "Contra esto se mide el tablero: el share y el ranking objetivo en el Centro de Inteligencia, y las unidades por marca y mes en Nuestra operación.":
    "The dashboard is measured against this: the target share and rank in the Intelligence center, and units by brand and month in Our operation.",
  "Catálogo": "Catalog",
  "Lo que el tablero da por sabido: qué marcas son nuestras y qué caja lleva cada familia.":
    "What the dashboard takes as given: which brands are ours and which transmission each family has.",
  "Las marcas que la casa distribuye y con qué grupo las presupuesta Finanzas. De esta lista sale qué filas van resaltadas en todo el tablero y qué se cuenta como «nuestro».":
    "The brands the company distributes and which group Finance budgets them under. This list decides which rows are highlighted across the dashboard and what counts as “ours”.",
  "Las <b>marcas propias no se editan desde acá</b>, a propósito: son el numerador del share en todo el tablero y el vínculo con los nombres exactos de CADAM. Un cambio distraído acá serían cifras mal calculadas en doce pantallas — se tocan en el archivo, a conciencia.":
    "<b>Own brands are not edited from here</b>, on purpose: they are the numerator of share across the whole dashboard and the link to CADAM's exact names. A careless change here would mean wrongly calculated figures on twelve screens — they are changed in the file, deliberately.",
  "Transmisión por familia (para revisar)": "Transmission by family (to review)",
  "Las fichas comparan mecánico con mecánico y automático con automático. Cars no trae la caja como dato: se lee del nombre de la versión (MT, AT, CVT, DCT…) y, cuando el nombre no lo dice, de esta lista. Si algo está mal, se corrige en <code>src/lib/informes/transmision.ts</code>. Las marcas solo eléctricas ({marcas}) cuentan como automáticas enteras.":
    "The spec sheets compare manual with manual and automatic with automatic. Cars does not provide the transmission as a field: it is read from the version name (MT, AT, CVT, DCT…) and, when the name doesn't say, from this list. If something is wrong, fix it in <code>src/lib/informes/transmision.ts</code>. All-electric brands ({marcas}) count as automatic across the board.",
  "Versiones vendidas en {anio} que siguen sin caja conocida":
    "Versions sold in {anio} that still have no known transmission",
  "({a} de {b} unidades)": "({a} of {b} units)",
  "Cars no respondió: {error}": "Cars did not respond: {error}",
  "Ninguna: todas las versiones tienen caja conocida.": "None: every version has a known transmission.",
  "Versión (como la escribe Cars)": "Version (as Cars writes it)",
  "el nombre no dice la caja": "the name doesn't say the transmission",
  "facturadas sin caja conocida": "invoiced with no known transmission",
  "Estas tienen las dos cajas según la versión (Poer diesel, JAC T8) o son chasis: el nombre no lo dice y no se adivina. Se resuelven nombrando la versión con la caja en Cars («… AT», «… MT») o agregando la familia arriba si toda la familia viene igual.":
    "These come with both transmissions depending on the version (Poer diesel, JAC T8) or are chassis: the name doesn't say and it isn't guessed. They are resolved by naming the version with its transmission in Cars (“… AT”, “… MT”) or by adding the family above if the whole family is the same.",

  // --- cargas/page.tsx (estado de los datos)
  "Qué tan fresco está cada dato del tablero y qué lo mantiene al día.":
    "How fresh each piece of dashboard data is and what keeps it up to date.",
  "Datos hasta {corte} · cargados el {fecha}.": "Data through {corte} · loaded on {fecha}.",
  "Sin cargas registradas.": "No loads recorded.",
  "Hay al menos una fuente <b>más atrasada de lo esperado</b>. Si es CADAM, puede ser que el mes todavía no se publicó o que la ingesta no corrió. Si es Cars o la inteligencia de competencia, el cron de Hermes que la alimenta dejó de correr — se revisa en la máquina donde vive Hermes, no acá.":
    "At least one source is <b>more out of date than expected</b>. If it is CADAM, the month may not have been published yet or the ingestion may not have run. If it is Cars or competitive intelligence, the Hermes cron that feeds it has stopped running — check it on the machine where Hermes lives, not here.",
  "Frescura por fuente": "Freshness by source",
  "Hasta qué mes llega cada fuente. Si una quedó vieja, todo lo que se lea de ella está incompleto.":
    "The month each source runs through. If one is stale, anything read from it is incomplete.",
  "Cómo llega el dato": "How the data arrives",
  "Quién trae cada dato, cada cuánto y por dónde entra. Sirve para saber a qué trabajo mirar cuando algo no aparece.":
    "Who brings in each piece of data, how often and through where. Useful to know which job to check when something doesn't show up.",
  "Todas las fuentes se actualizan solas desde los trabajos programados de Hermes —el robot que corre las cargas—, que corren en la máquina de Croman —no en este servidor— porque es donde están las credenciales de CADAM, Cars, Bitrix y Meta. El tablero es el consumidor: nunca sale a buscar nada por su cuenta.":
    "All sources update on their own from Hermes's scheduled jobs —the robot that runs the loads—, which run on Croman's machine —not on this server— because that is where the CADAM, Cars, Bitrix and Meta credentials live. The dashboard is the consumer: it never goes out to fetch anything on its own.",
  "<b>CADAM.</b> El cron sincroniza la carpeta de OneDrive, corre la ingesta y, si el período cambió, sube la base a producción. Silencioso si CADAM no publicó nada nuevo.":
    "<b>CADAM.</b> The cron syncs the OneDrive folder, runs the ingestion and, if the period changed, uploads the database to production. Silent if CADAM published nothing new.",
  "<b>Cars.</b> Lee facturación y stock del API, agrega en la máquina —los datos de clientes nunca salen de ahí— y empuja sólo los conteos.":
    "<b>Cars.</b> Reads invoicing and stock from the API, aggregates on the machine —customer data never leaves it— and pushes only the counts.",
  "<b>Competencia.</b> Empuja el vault de Hermes: benchmark de precios, battle cards y el scan diario de promociones.":
    "<b>Competition.</b> Pushes the Hermes vault: price benchmark, battle cards and the daily promotions scan.",
  "<b>Benchmark semanal.</b> Los lunes, un solo job lee el catálogo de Datacar (precios de lista de la competencia), Bitrix (leads y negocios por marca, modelo, estado y motivo; leads por asesor) y Meta (gasto por cuenta y mes), agrega todo en la máquina y empuja sólo los conteos. Con eso viven Dónde competir, la demanda y la pauta de Nuestra operación, y la mitad del Centro de Inteligencia.":
    "<b>Weekly benchmark.</b> On Mondays, a single job reads the Datacar catalog (competitors' list prices), Bitrix (leads and deals by brand, model, status and reason; leads by advisor) and Meta (spend by account and month), aggregates everything on the machine and pushes only the counts. It powers Where to compete, the demand and ad spend sections of Our operation, and half of the Intelligence center.",
  "¿Buscás si el dato es <i>correcto</i>, no si está fresco? Eso vive en <b>Calidad de datos</b>: validación contra el informe oficial, hallazgos y detalle del procesamiento.":
    "Looking for whether the data is <i>correct</i>, not whether it is fresh? That lives in <b>Data quality</b>: validation against the official report, findings and processing detail.",
  "Qué entró en cada carga": "What came in with each load",
  "Archivo por archivo: cuántas filas traía, cuántas entraron y cuántas se descartaron.":
    "File by file: how many rows it had, how many were loaded and how many were dropped.",
  "activo": "active",
  "{n} leídas": "{n} read",
  "{n} cargadas": "{n} loaded",
  "Archivo": "File",
  "Detectado como": "Detected as",
  "qué informe creyó que era": "which report it thought it was",
  "Filas leídas": "Rows read",
  "renglones que traía el archivo": "lines the file contained",
  "Filas cargadas": "Rows loaded",
  "las que entraron; el resto, descartes": "the ones that were loaded; the rest were dropped",
  "vehículos que suman esas filas": "vehicles those rows add up to",
  "Sin archivos cargados todavía.": "No files loaded yet.",
  "Al día": "Up to date",
  "Envejeciendo": "Aging",
  "Atrasado": "Overdue",
  "Se espera": "Expected",
  "Lo mantiene": "Maintained by",
  "sin registro": "no record",
  "hace minutos": "minutes ago",
  "hace {n} h": "{n} h ago",
  "hace 1 día": "1 day ago",

  // --- cargas/page.tsx: las fuentes
  "Mensual": "Monthly",
  "Diaria": "Daily",
  "Semanal": "Weekly",
  "Cada 4 horas": "Every 4 hours",
  "cuando Finanzas cambia el Excel (el cron mira cada hora)":
    "when Finance changes the Excel (the cron checks every hour)",
  "cuando producto cambia la planilla (el cron mira cada hora)":
    "when Product changes the sheet (the cron checks every hour)",
  "mensual, cuando Fernando manda la planilla (el cron mira cada 4 horas)":
    "monthly, when Fernando sends the sheet (the cron checks every 4 hours)",
  "Hermes · «CADAM desde OneDrive», 06:00 diario": "Hermes · “CADAM desde OneDrive”, daily at 06:00",
  "Hermes · «Operación propia (Cars)», cada 4 h": "Hermes · “Operación propia (Cars)”, every 4 h",
  "Hermes · «Conocimiento de competencia», 08:15 diario": "Hermes · “Conocimiento de competencia”, daily at 08:15",
  "Hermes · «Benchmark competitivo», lunes 10:00": "Hermes · “Benchmark competitivo”, Mondays at 10:00",
  "Hermes · «Presupuesto (Excel Finanzas)», cada hora, notebook":
    "Hermes · “Presupuesto (Excel Finanzas)”, hourly, on the laptop",
  "Hermes · «Batalla por modelo (Excel producto)», cada hora, notebook":
    "Hermes · “Batalla por modelo (Excel producto)”, hourly, on the laptop",
  "Hermes · «Acciones comerciales (Excel)», cada 4 horas, notebook":
    "Hermes · “Acciones comerciales (Excel)”, every 4 hours, on the laptop",
  "Cars (DMS propio)": "Cars (own DMS)",
  "Inteligencia de competencia": "Competitive intelligence",
  "Precios de la competencia (Datacar)": "Competitor prices (Datacar)",
  "Demanda (Bitrix)": "Demand (Bitrix)",
  "Leads por asesor (Bitrix)": "Leads by advisor (Bitrix)",
  "Pauta (Meta)": "Ad spend (Meta)",
  "Presupuesto {anio} (Excel de Finanzas)": "{anio} budget (Finance Excel)",
  "Batalla por modelo (Excel de producto)": "Model battle (Product Excel)",
  "Acciones comerciales (Excel de Fernando)": "Commercial actions (Fernando's Excel)",
  "Sin cargas registradas": "No loads recorded",
  "Sin sincronización registrada": "No sync recorded",
  "Sin documentos cargados": "No documents loaded",
  "Sin precios cargados": "No prices loaded",
  "Sin demanda cargada": "No demand loaded",
  "Sin leads cargados": "No leads loaded",
  "Sin pauta cargada": "No ad spend loaded",
  "{filas} filas de facturación · {unidades} unidades en stock": "{filas} invoicing rows · {unidades} units in stock",
  "{n} documentos (benchmark de precios, battle cards, promociones)":
    "{n} documents (price benchmark, battle cards, promotions)",
  "{precios} precios de lista de {marcas} marcas · catálogo de terceros":
    "{precios} list prices from {marcas} brands · third-party catalog",
  "{leads} leads y {negocios} negocios del año, por marca, modelo, estado y motivo":
    "{leads} leads and {negocios} deals this year, by brand, model, status and reason",
  "Leads por responsable y mes, cruzados con Cars en el ranking de asesores":
    "Leads by owner and month, cross-referenced with Cars in the advisor ranking",
  "US$ {gasto} en el año, {n} marcas · gasto por cuenta y mes":
    "US$ {gasto} this year, {n} brands · spend by account and month",
  "Plan {version} · {grupos} marcas o grupos · real hasta {mes} · plan {plan} u. · presupuesto original {ppto} u. Renew (usados) no entra.":
    "Plan {version} · {grupos} brands or groups · actuals through {mes} · plan {plan} units · original budget {ppto} units. Renew (used cars) is excluded.",
  "Plan {version} · {grupos} marcas o grupos · real hasta {mes} · plan {plan} u. · presupuesto original {ppto} u. · canales {canales} con objetivo y real de Finanzas Renew (usados) no entra.":
    "Plan {version} · {grupos} brands or groups · actuals through {mes} · plan {plan} units · original budget {ppto} units · channels {canales} with target and actuals from Finance. Renew (used cars) is excluded.",
  "Nunca cargado. Lo carga advisor-presupuesto.sh (Hermes, notebook) desde el Budget de Finanzas.":
    "Never loaded. It is loaded by advisor-presupuesto.sh (Hermes, laptop) from the Finance budget.",
  "{modelos} modelos de {marcas} marcas, {versiones} versiones rivales · {archivos} archivos BBCH en la carpeta":
    "{modelos} models from {marcas} brands, {versiones} rival versions · {archivos} BBCH files in the folder",
  "Nunca cargado. Lo carga advisor-batalla.sh (Hermes, notebook) desde los *BBCH*.xlsx de la carpeta.":
    "Never loaded. It is loaded by advisor-batalla.sh (Hermes, laptop) from the *BBCH*.xlsx files in the folder.",
  "{mes} · {marcas} marcas, {versiones} versiones · «{archivo}»":
    "{mes} · {marcas} brands, {versiones} versions · “{archivo}”",
  "Nunca cargado. Lo carga advisor-acciones.sh (Hermes, notebook) desde ACCIONES COMERCIALES <MES>.xlsx de la carpeta.":
    "Never loaded. It is loaded by advisor-acciones.sh (Hermes, laptop) from ACCIONES COMERCIALES <MES>.xlsx in the folder.",

  // --- calidad-datos/page.tsx
  "Todo lo que se detectó al cargar los archivos: controles cruzados contra el informe oficial de CADAM, huecos, ambigüedades y valores sin clasificar.":
    "Everything detected when loading the files: cross-checks against the official CADAM report, gaps, ambiguities and unclassified values.",
  "Todavía no hay ninguna carga registrada.": "No load has been recorded yet.",
  "Errores": "Errors",
  "Avisos": "Warnings",
  "Controles OK": "Checks passed",
  "Validación contra el informe oficial de CADAM": "Validation against the official CADAM report",
  "El control más fuerte que tenemos: los datos fila por fila tienen que reproducir exactamente los totales que CADAM publica en su informe. Se comparan solo los meses que están en las dos fuentes.":
    "The strongest check we have: the row-by-row data has to reproduce exactly the totals CADAM publishes in its report. Only the months present in both sources are compared.",
  "Hallazgos": "Findings",
  "Lo que no cerró al cargar, primero los errores y después los avisos. Un error significa que ese dato no es confiable; un aviso, que hay algo raro que conviene mirar.":
    "What did not reconcile on load, errors first and then warnings. An error means that data is not reliable; a warning means something looks odd and is worth a look.",
  "{n} filas afectadas": "{n} rows affected",
  "Archivos cargados": "Loaded files",
  "Datos de {corte} · cargado {fecha}": "Data for {corte} · loaded {fecha}",
  "Tipo detectado": "Detected type",
  "Corte": "Cutoff",
  "el mes al que pertenece el dato": "the month the data belongs to",
  "Fecha de carga": "Load date",
  "cuándo lo procesamos nosotros": "when we processed it",
  "“Filas leídas” es lo que traía el Excel; “filas cargadas” es lo que quedó después de descartar meses vacíos y agrupar duplicados. La diferencia es normal, no una pérdida: las unidades totales se conservan.":
    "“Rows read” is what the Excel contained; “rows loaded” is what was left after dropping empty months and grouping duplicates. The difference is normal, not a loss: total units are preserved.",
  "Detalle del procesamiento": "Processing detail",

  // --- lib/tipo-archivo.ts (tipos de archivo y mensajes del pipeline de carga)
  "Matriculaciones · detalle por vehículo": "Registrations · vehicle-level detail",
  "Importaciones · detalle por vehículo": "Imports · vehicle-level detail",
  "Importaciones · híbridos y eléctricos": "Imports · hybrids and electric vehicles",
  "Importaciones · camiones y ómnibus": "Imports · trucks and buses",
  "Matriculaciones · por combustible": "Registrations · by fuel",
  "Matriculaciones · por localidad": "Registrations · by location",
  "matriculaciones con detalle por vehículo": "registrations with vehicle-level detail",
  "importaciones con detalle por vehículo": "imports with vehicle-level detail",
  "con detalle por vehículo": "with vehicle-level detail",
  "detalle por vehículo": "vehicle-level detail",
  "importacion de vehiculos de energia nueva (EV/HEV/PHEV)": "imports of new-energy vehicles (EV/HEV/PHEV)",
  "importacion de camiones y omnibus": "imports of trucks and buses",
  "matriculaciones por combustible (nafta/gasoil/flex/hibrido/electrico)":
    "registrations by fuel (gasoline/diesel/flex/hybrid/electric)",
  "matriculaciones por localidad": "registrations by location",
  "Modelos con mas de una clasificacion 'Tipo cadam' en el mismo mes; se tomo la mas frecuente":
    "Models with more than one 'Tipo cadam' classification in the same month; the most frequent one was used",
  "Filas descartadas por fecha vacia o ilegible": "Rows dropped because the date was empty or unreadable",
  "Filas con unidades vacias, computadas como 0": "Rows with empty units, counted as 0",
  "Filas con unidades negativas": "Rows with negative units",
  "Filas sin segmento en el origen (Grupo='NDA'); se muestran como dato no disponible, no como un segmento mas":
    "Rows with no segment at the source (Grupo='NDA'); shown as unavailable data, not as one more segment",
  "Filas reclasificadas por correccion manual de tecnologia": "Rows reclassified by manual powertrain correction",
  "Filas con TIPO GRAL='NO' (sin clasificar en el origen)": "Rows with TIPO GRAL='NO' (unclassified at the source)",
  "Filas sin fecha o de total descartadas (incluye la fila 'Localidades' que trae el archivo)":
    "Rows with no date, or total rows, dropped (includes the 'Localidades' row that comes in the file)",
  "Filas de matriculacion con la misma clave, sumadas": "Registration rows with the same key, summed",
  "Filas de importacion con la misma clave, sumadas": "Import rows with the same key, summed",
  "Filas de NEV con la misma clave, sumadas": "NEV rows with the same key, summed",
  "Filas de camiones con la misma clave, sumadas": "Truck rows with the same key, summed",
  "Filas de movilidad con la misma clave, sumadas": "Fuel rows with the same key, summed",
  "Filas de localidad con la misma clave, sumadas": "Location rows with the same key, summed",
  "Detectado como {desc}": "Detected as {desc}",
  "Matriculacion": "Registrations",
  "Importacion": "Imports",
  "1 mes comparables": "1 comparable month",
  "{n} meses comparables": "{n} comparable months",
  "1 version": "1 version",
  "1 vehiculo": "1 vehicle",
  "{u} vehiculos": "{u} vehicles",
  "{versiones} ({vehiculos})": "{versiones} ({vehiculos})",
  "ese mes": "that month",
  "esos meses": "those months",
  "{tipo} {anio} ({alcance}): {u} unidades, coincide exacto con el informe oficial de CADAM":
    "{tipo} {anio} ({alcance}): {u} units, matches the official CADAM report exactly",
  "{tipo} {anio} ({alcance}): row-level {a} vs informe oficial {b} (diferencia {d})":
    "{tipo} {anio} ({alcance}): row-level {a} vs official report {b} (difference {d})",
  "{tipo}: meses sin datos dentro del rango {rango}: {meses}":
    "{tipo}: months with no data within the range {rango}: {meses}",
  "{tipo}: unidades sin segmento en el origen ({detalle}). Se muestran como dato no disponible, no se reparten entre los demas segmentos.":
    "{tipo}: units with no segment at the source ({detalle}). They are shown as unavailable data, not distributed among the other segments.",
  "Marca/mes donde 'import nev' supera a 'base importacion'. Estas unidades NO se suman al total de importaciones (el NEV es un subconjunto). Marcas: {marcas}":
    "Brand/month combinations where 'import nev' exceeds 'base importacion'. These units are NOT added to total imports (NEV is a subset). Brands: {marcas}",
  "Modelos con varias grafias en el origen (espacios, guiones, barras o puntos) unificados a la mas frecuente. Ej.: {ejemplos}":
    "Models spelled several ways at the source (spaces, hyphens, slashes or dots) were merged into the most frequent spelling. E.g.: {ejemplos}",
  "Modelo separado de version usando el catalogo de importacion: {a} de {b} filas identificadas. Las {c} restantes ({u} unidades) muestran la version completa en el ranking de modelos, en vez de adivinar el corte.":
    "Model split from trim using the import catalog: {a} of {b} rows identified. The remaining {c} ({u} units) show the full trim name in the model ranking instead of guessing the split.",
  "Valores de {columna} no reconocidos: {valores}": "Unrecognized {columna} values: {valores}",
  "Informe estadistico de CADAM ({n} hojas); lo procesa ingest_cadam.py, no este pipeline":
    "CADAM statistical report ({n} sheets); processed by ingest_cadam.py, not by this pipeline",
  "No se pudo abrir el archivo: {motivo}": "Could not open the file: {motivo}",
  "No coincide con ninguna estructura conocida. Columnas del archivo: {columnas}. Falta(n) para la firma mas parecida: {faltan}":
    "Does not match any known structure. File columns: {columnas}. Missing for the closest signature: {faltan}",
  "El control '{nombre}' fallo: {motivo}": "Check '{nombre}' failed: {motivo}",
  "Importacion {meses}: el detalle por vehiculo todavia no llego y se completo desde el Cuadro 8 del informe estadistico de CADAM ({livianos} vehiculos livianos en {modelos} modelos). Tiene marca, modelo, segmento y tipo, pero no origen ni medidas. Se reemplaza solo cuando entre el archivo de detalle.":
    "Imports {meses}: the vehicle-level detail has not arrived yet and was completed from Table 8 of CADAM's statistical report ({livianos} light vehicles in {modelos} models). It has brand, model, segment and type, but no origin or dimensions. It will be replaced automatically once the detail file arrives.",
  "Importacion {meses}: el detalle por vehiculo todavia no llego y se completo desde el Cuadro 8 del informe estadistico de CADAM ({livianos} vehiculos livianos en {modelos} modelos, {camiones} camiones y omnibus). Tiene marca, modelo, segmento y tipo, pero no origen ni medidas. Se reemplaza solo cuando entre el archivo de detalle.":
    "Imports {meses}: the vehicle-level detail has not arrived yet and was completed from Table 8 of CADAM's statistical report ({livianos} light vehicles in {modelos} models, {camiones} trucks and buses). It has brand, model, segment and type, but no origin or dimensions. It will be replaced automatically once the detail file arrives.",
  "Matriculacion {meses}: el detalle de CADAM (matriculaciones.xlsx) no trae {cuando} y se completo desde el archivo por combustible ({u} vehiculos en {v} versiones), que en los {c} meses que tienen los dos coincide exacto. Segmento, tecnologia e importador se copiaron de la misma version en el mes mas cercano. Se reemplaza solo cuando el detalle traiga el mes.":
    "Registrations {meses}: CADAM's detail (matriculaciones.xlsx) does not include {cuando} and was completed from the fuel file ({u} vehicles in {v} versions), which matches exactly in the {c} months both have. Segment, powertrain and importer were copied from the same version in the nearest month. It will be replaced automatically once the detail includes the month.",
  "Matriculacion {meses}: el detalle de CADAM (matriculaciones.xlsx) no trae {cuando} y se completo desde el archivo por combustible ({u} vehiculos en {v} versiones), que en los {c} meses que tienen los dos coincide exacto. Segmento, tecnologia e importador se copiaron de la misma version en el mes mas cercano. {notas}. Se reemplaza solo cuando el detalle traiga el mes.":
    "Registrations {meses}: CADAM's detail (matriculaciones.xlsx) does not include {cuando} and was completed from the fuel file ({u} vehicles in {v} versions), which matches exactly in the {c} months both have. Segment, powertrain and importer were copied from the same version in the nearest month. {notas}. It will be replaced automatically once the detail includes the month.",
  "{cuantas} tenian mas de una combinacion en ese mes y se tomo la de mas unidades":
    "{cuantas} had more than one combination in that month and the one with the most units was used",
  "{cuantas} que el detalle no tiene escritas igual tomaron segmento e importador de su modelo, y la tecnologia de su nombre o de su combustible":
    "{cuantas} that the detail does not have written the same way took segment and importer from their model, and powertrain from their name or fuel",
  "{cuantas} sin modelo reconocible quedan sin segmento ni importador":
    "{cuantas} with no recognizable model are left with no segment or importer",
  "Matriculacion {meses}: el detalle no trae el mes y el archivo por combustible si, pero no se completo porque en {n} de {total} meses en comun los totales no coinciden (ej. {ejemplo}: detalle {detalle}, combustible {combustible}).":
    "Registrations {meses}: the detail does not include the month while the fuel file does, but it was not completed because in {n} of {total} shared months the totals do not match (e.g. {ejemplo}: detail {detalle}, fuel {combustible}).",
  "Matriculacion {meses}: el detalle no trae el mes y el archivo por combustible si, pero no se completo porque no hay ningun mes en comun para comprobar que sean el mismo dato.":
    "Registrations {meses}: the detail does not include the month while the fuel file does, but it was not completed because there is no shared month to check they are the same data.",
};

export default EN;
