import { NotaDato, PageHeader } from "@/components/dashboard/page-header";
import { ChatCopiloto } from "@/components/copiloto/chat";
import { InformesPanel } from "@/components/copiloto/informes-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCobertura } from "@/lib/cadam/mercado";

export default function CopilotoPage() {
  const cobertura = getCobertura();
  const sinClave = !process.env.ANTHROPIC_API_KEY;

  return (
    <div className="flex h-full flex-col gap-5">
      <PageHeader
        titulo="Copiloto"
        descripcion="Preguntale a los datos en lenguaje natural. Cita las cifras internas por período y las de mercado/competencia por fuente y fecha."
        fuente={`Fuente interna: CADAM / DNRA · snapshot ${cobertura.snapshot ?? "—"}. Fuente externa: búsqueda web citada.`}
      />

      {sinClave ? (
        <NotaDato>
          Falta configurar <code>ANTHROPIC_API_KEY</code> en el archivo{" "}
          <code>.env.local</code> de la app. Agregala y reiniciá el servidor
          para habilitar el copiloto.
        </NotaDato>
      ) : (
        <Tabs defaultValue="chat" className="flex min-h-0 flex-1 flex-col gap-3">
          <TabsList>
            <TabsTrigger value="chat">Chat</TabsTrigger>
            <TabsTrigger value="informes">Informes semanales</TabsTrigger>
          </TabsList>
          <TabsContent value="chat" className="flex min-h-0 flex-1 flex-col">
            <ChatCopiloto
              sugerencias={[
                "¿Cómo viene JETOUR contra CHERY este año?",
                "¿Qué pasó en mayo 2026? Fue un mes rarísimo",
                "Top 5 modelos PHEV y quién los importa",
                "¿En qué segmentos estamos más débiles?",
                "¿Quién ganó y quién perdió market share este año?",
                "¿Qué dice el último informe de competencia sobre precios?",
              ]}
            />
          </TabsContent>
          <TabsContent value="informes" className="min-h-0 flex-1">
            <InformesPanel />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
