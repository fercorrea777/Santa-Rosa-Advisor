import { Inbox } from "lucide-react";

export function EmptyState({
  title = "Sin datos cargados todavía",
  description,
}: {
  title?: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-10 text-center">
      <Inbox className="size-6 text-muted-foreground/60" />
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <p className="max-w-sm text-xs text-muted-foreground/80">{description}</p>
    </div>
  );
}
