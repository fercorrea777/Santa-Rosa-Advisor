import { getI18n } from "@/lib/i18n/servidor";

export async function EmptyState({
  title,
  description,
}: {
  title?: string;
  description: string;
}) {
  const { t } = await getI18n();
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-10 text-center">
      <p className="text-sm font-medium text-muted-foreground">{title ?? t("Sin datos cargados todavía")}</p>
      <p className="max-w-sm text-xs text-muted-foreground">{description}</p>
    </div>
  );
}
