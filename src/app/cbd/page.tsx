import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/dashboard/page-header";
import { Pagina } from "@/components/movimiento/pagina";

/**
 * CBD — Cost Break Down. Pedido de Fernando (15/09/2026) para el apartado
 * SANTA ROSA, junto con las acciones comerciales y Carflow.
 *
 * Todavía sin datos: en la carpeta hay un solo CBD (el de Dongfeng, dentro
 * de "CBD Y BBCH DONGFENG.xlsx") y no uno por marca. La pantalla existe
 * para que el renglón del menú diga qué va a mostrar y qué falta para
 * mostrarlo, en vez de un 404.
 */
export default function CbdPage() {
  return (
    <Pagina>
      <PageHeader
        titulo="CBD — Cost break down"
        descripcion="El costo de cada versión abierto paso a paso: FOB, flete, C&F, despacho, seguro, SBLC, playa fiscal… hasta el costo puesto en playa, y el margen contra el precio de lista."
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
            Esta pantalla va a mostrar, por marca y versión, el desglose del
            costo con el que se arma el precio: lo que se paga a fábrica (FOB),
            el flete, los gastos de importación y despacho, y cuánto queda de
            margen sobre el PVP. Es el mismo cuadro «COST BREAK DOWN» que el
            equipo de producto arma en Excel.
          </p>
          <p>
            <strong className="text-foreground">Qué falta:</strong> un CBD por
            marca en <code className="rounded bg-muted px-1 py-0.5">~/Escritorio/DASHBOARD FERNANDO/</code>.
            Hoy hay uno solo (Dongfeng, en «CBD Y BBCH DONGFENG.xlsx»); con los
            de Jetour, GWM, JAC, Renault, Mitsubishi, Soueast, Leapmotor, Zeekr,
            JMEV y XPeng se carga igual que las acciones comerciales, sin tocar
            nada a mano.
          </p>
        </CardContent>
      </Card>
    </Pagina>
  );
}
