import { ArrowDownRight, ArrowUpRight, Minus, HelpCircle } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatPct } from "@/lib/format";

interface KpiCardProps {
  label: string;
  value: string;
  periodo?: string;
  variacion?: number | null;
  tooltip?: string;
  disponible?: boolean;
}

export function KpiCard({
  label,
  value,
  periodo,
  variacion,
  tooltip,
  disponible = true,
}: KpiCardProps) {
  if (!disponible) {
    return (
      <Card className="gap-2 py-4">
        <CardHeader className="flex flex-row items-center justify-between gap-2 px-4">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          {tooltip && <InfoTip text={tooltip} />}
        </CardHeader>
        <CardContent className="px-4">
          <p className="text-lg font-medium text-muted-foreground">Sin datos cargados</p>
          <p className="text-xs text-muted-foreground/70">Pendiente de ingesta</p>
        </CardContent>
      </Card>
    );
  }

  const isUp = (variacion ?? 0) > 0;
  const isDown = (variacion ?? 0) < 0;

  return (
    <Card className="gap-2 py-4">
      <CardHeader className="flex flex-row items-center justify-between gap-2 px-4">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {tooltip && <InfoTip text={tooltip} />}
      </CardHeader>
      <CardContent className="px-4">
        <p className="text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
        <div className="mt-1 flex items-center gap-2">
          {variacion !== undefined && variacion !== null ? (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 text-xs font-medium tabular-nums",
                isUp && "text-emerald-600 dark:text-emerald-400",
                isDown && "text-rose-600 dark:text-rose-400",
                !isUp && !isDown && "text-muted-foreground"
              )}
            >
              {isUp && <ArrowUpRight className="size-3.5" />}
              {isDown && <ArrowDownRight className="size-3.5" />}
              {!isUp && !isDown && <Minus className="size-3.5" />}
              {formatPct(variacion, { signed: true })}
            </span>
          ) : variacion === null ? (
            <span className="text-xs text-muted-foreground">Sin base comparativa</span>
          ) : null}
          {periodo && <span className="text-xs text-muted-foreground">· {periodo}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function InfoTip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger className="rounded-full bg-transparent p-0">
        <HelpCircle className="size-3.5 shrink-0 text-muted-foreground/70" />
      </TooltipTrigger>
      <TooltipContent className="max-w-64 text-xs">{text}</TooltipContent>
    </Tooltip>
  );
}
