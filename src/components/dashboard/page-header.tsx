export function PageHeader({
  titulo,
  descripcion,
  fuente,
}: {
  titulo: string;
  descripcion?: string;
  fuente?: string;
}) {
  return (
    // Lenguaje bento: título grande en caja alta/baja (no versalitas de
    // instrumento), descripción al lado del peso, fuente como pill suave.
    <header className="flex flex-col gap-1.5 pb-1">
      <h1 className="text-3xl font-extrabold tracking-tight text-balance">
        {titulo}
      </h1>
      {descripcion && (
        <p className="max-w-[75ch] text-sm text-muted-foreground text-pretty">
          {descripcion}
        </p>
      )}
      {fuente && (
        <p className="w-fit rounded-full bg-card px-3 py-1 font-mono text-[11px] uppercase tracking-wide text-muted-foreground shadow-[var(--card-shadow)]">
          {fuente}
        </p>
      )}
    </header>
  );
}

// La nota vive en su propio archivo (es de cliente: se pliega).
export { NotaDato } from "./nota-dato";
