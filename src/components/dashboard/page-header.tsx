import { Info } from "lucide-react";

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
    <header className="flex flex-col gap-1">
      <h1 className="text-xl font-semibold tracking-tight">{titulo}</h1>
      {descripcion && (
        <p className="text-sm text-muted-foreground">{descripcion}</p>
      )}
      {fuente && (
        <p className="text-xs text-muted-foreground/80">{fuente}</p>
      )}
    </header>
  );
}

/** Aviso honesto sobre una limitacion del dato. Se usa siempre que una
 *  vista no puede mostrar todo lo que su titulo promete. */
export function NotaDato({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
      <Info className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-500" />
      <span>{children}</span>
    </div>
  );
}
