
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
    <header className="flex flex-col gap-1.5 border-b pb-4">
      <h1 className="text-xl font-extrabold uppercase tracking-[0.04em] text-balance">
        {titulo}
      </h1>
      {descripcion && (
        <p className="max-w-[75ch] text-sm text-muted-foreground text-pretty">
          {descripcion}
        </p>
      )}
      {fuente && (
        <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground/75">
          {fuente}
        </p>
      )}
    </header>
  );
}

/** Aviso honesto sobre una limitacion del dato. Se usa siempre que una
 *  vista no puede mostrar todo lo que su titulo promete. */
export function NotaDato({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
      <span
        aria-hidden="true"
        className="mt-0.5 flex size-3.5 shrink-0 items-center justify-center rounded-full border border-amber-600/50 text-[9px] font-bold leading-none text-amber-600 dark:border-amber-500/50 dark:text-amber-500"
      >
        i
      </span>
      <span>{children}</span>
    </div>
  );
}
