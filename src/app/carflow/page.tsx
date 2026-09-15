import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/dashboard/page-header";
import { Pagina } from "@/components/movimiento/pagina";

/**
 * Carflow — el flujo de unidades. Pedido de Fernando (15/09/2026) para el
 * apartado SANTA ROSA; Croman: "Carflow también vamos a meter".
 *
 * Todavía sin datos ni fuente definida. La pantalla existe para que el
 * renglón del menú diga qué va a mostrar y qué hace falta.
 */
export default function CarflowPage() {
  return (
    <Pagina>
      <PageHeader
        titulo="Carflow"
        descripcion="Dónde está cada unidad antes de llegar a la playa: pedida a fábrica, en producción, embarcada, en tránsito, en aduana, en playa. Por marca y modelo, con fechas estimadas."
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Todavía sin datos
            <Badge variant="outline" className="font-normal">pronto</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
          <p>
            Hoy el tablero conoce dos puntas del flujo: lo que ya entró al país
            (importaciones de CADAM) y lo que está en stock o en viaje según la
            planilla de acciones comerciales. Carflow es lo que hay entre medio:
            pedidos confirmados, unidades en producción, embarques y su fecha de
            llegada.
          </p>
          <p>
            <strong className="text-foreground">Qué falta:</strong> definir la
            fuente. Si es una planilla, con dejarla en{" "}
            <code className="rounded bg-muted px-1 py-0.5">~/Escritorio/DASHBOARD FERNANDO/</code>{" "}
            se carga como las acciones comerciales; si vive en un sistema
            (Cars, SAP, el portal de fábrica), hace falta el acceso.
          </p>
        </CardContent>
      </Card>
    </Pagina>
  );
}
