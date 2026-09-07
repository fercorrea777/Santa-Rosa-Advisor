import { PageHeader } from "@/components/dashboard/page-header";
import { ChatCopiloto } from "@/components/copiloto/chat";
import { InformesPanel } from "@/components/copiloto/informes-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCobertura } from "@/lib/cadam/mercado";

/**
 * Ya NO se pide ANTHROPIC_API_KEY. El Copiloto corre sobre Gemma en el Ollama
 * del propio servidor (02/09/2026) y no necesita ninguna clave; el cartel de
 * "falta configurar ANTHROPIC_API_KEY" habria bloqueado la pantalla entera el
 * dia que esa variable se saque de produccion, con el modelo funcionando
 * perfecto al lado. Si el modelo no responde, el error llega por el chat, que
 * es donde se puede leer el motivo real.
 */
export default function CopilotoPage() {
  const cobertura = getCobertura();

  return (
    <div className="flex h-full flex-col gap-5">
      <PageHeader
        titulo="Copiloto"
        descripcion="Preguntale a los datos en lenguaje natural. Consulta él mismo las fuentes —CADAM, el relevamiento de competencia de Hermes, nuestra operación, la demanda de Bitrix y la pauta de Meta— y muestra abajo de cada respuesta cuáles abrió."
        fuente={`CADAM / DNRA · snapshot ${cobertura.snapshot ?? "—"} · precios y promociones de competencia relevados por Hermes · facturación, stock y asesores del API de Cars · leads y negocios de Bitrix · pauta de Meta · rivales por clase de vehículo. Sin acceso a internet.`}
      />

      <Tabs defaultValue="chat" className="flex min-h-0 flex-1 flex-col gap-3">
        <TabsList>
          <TabsTrigger value="chat">Chat</TabsTrigger>
          <TabsTrigger value="informes">Informes semanales</TabsTrigger>
        </TabsList>
        <TabsContent value="chat" className="flex min-h-0 flex-1 flex-col">
          <ChatCopiloto
            sugerencias={[
              "¿Contra quién compite la X50 y a qué precio está cada rival?",
              "¿Qué versiones hay que pedir y cuáles empujar con promo?",
              "¿Qué marca pierde más leads y por qué?",
              "¿Cuánto nos cuesta en pauta cada vehículo vendido, por marca?",
              "¿Qué marcas van atrasadas contra el presupuesto 2026?",
              "¿Quiénes son los mejores asesores del año y de cada marca?",
              "¿Quién ganó y quién perdió market share este año?",
            ]}
          />
        </TabsContent>
        <TabsContent value="informes" className="min-h-0 flex-1">
          <InformesPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
