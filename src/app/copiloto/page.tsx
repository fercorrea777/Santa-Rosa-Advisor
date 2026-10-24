import { PageHeader } from "@/components/dashboard/page-header";
import { Pagina } from "@/components/movimiento/pagina";
import { ChatCopiloto } from "@/components/copiloto/chat";
import { InformesPanel } from "@/components/copiloto/informes-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCobertura } from "@/lib/cadam/mercado";
import { getI18n } from "@/lib/i18n/servidor";

/**
 * Ya NO se pide ANTHROPIC_API_KEY. El Copiloto corre sobre Gemma en el Ollama
 * del propio servidor (02/09/2026) y no necesita ninguna clave; el cartel de
 * "falta configurar ANTHROPIC_API_KEY" habria bloqueado la pantalla entera el
 * dia que esa variable se saque de produccion, con el modelo funcionando
 * perfecto al lado. Si el modelo no responde, el error llega por el chat, que
 * es donde se puede leer el motivo real.
 */
export default async function CopilotoPage() {
  const { t, fmt } = await getI18n();
  const cobertura = getCobertura();

  return (
    <Pagina className="h-full">
      <PageHeader
        titulo={t("Copiloto")}
        descripcion={t("Preguntale a los datos en lenguaje natural. Consulta él mismo las fuentes —CADAM, el relevamiento de precios de la competencia, nuestra operación, la demanda de Bitrix y la pauta de Meta— y, si ahí no está, busca en internet. Muestra abajo de cada respuesta cuáles abrió.")}
        fuente={t("CADAM / DNRA · {cortes} · precios y promociones de la competencia relevados a diario · facturación, stock y asesores de Cars · leads y negocios de Bitrix · pauta de Meta · rivales por clase de vehículo · internet (DuckDuckGo) solo para lo que no está en esas fuentes, citando la URL.", { cortes: fmt.etiquetaCortes(cobertura) })}
      />

      <Tabs defaultValue="chat" className="flex min-h-0 flex-1 flex-col gap-3">
        <TabsList>
          <TabsTrigger value="chat">{t("Chat")}</TabsTrigger>
          <TabsTrigger value="informes">{t("Informes semanales")}</TabsTrigger>
        </TabsList>
        <TabsContent value="chat" className="flex min-h-0 flex-1 flex-col">
          <ChatCopiloto
            sugerencias={[
              t("¿Contra quién compite la X50 y a qué precio está cada rival?"),
              t("¿Qué versiones hay que pedir y cuáles empujar con promo?"),
              t("¿Qué marca pierde más leads y por qué?"),
              t("¿Cuánto nos cuesta en pauta cada vehículo vendido, por marca?"),
              t("¿Qué marcas van atrasadas contra el presupuesto 2026?"),
              t("¿Quiénes son los mejores asesores del año y de cada marca?"),
              t("¿Quién ganó y quién perdió market share este año?"),
            ]}
          />
        </TabsContent>
        <TabsContent value="informes" className="min-h-0 flex-1">
          <InformesPanel />
        </TabsContent>
      </Tabs>
    </Pagina>
  );
}
