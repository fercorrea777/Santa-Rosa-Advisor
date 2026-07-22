import { NotaDato, PageHeader } from "@/components/dashboard/page-header";
import { ChatCopiloto } from "@/components/copiloto/chat";
import { getCobertura } from "@/lib/cadam/mercado";

export default function CopilotoPage() {
  const cobertura = getCobertura();
  const sinClave = !process.env.ANTHROPIC_API_KEY;

  return (
    <div className="flex h-full flex-col gap-5">
      <PageHeader
        titulo="Copiloto"
        descripcion="Preguntale a los datos en lenguaje natural. Responde consultando la misma base que los dashboards y cita las cifras."
        fuente={`Fuente: CADAM / DNRA · snapshot ${cobertura.snapshot ?? "—"} · sin acceso a internet.`}
      />

      {sinClave ? (
        <NotaDato>
          Falta configurar <code>ANTHROPIC_API_KEY</code> en el archivo{" "}
          <code>.env.local</code> de la app. Agregala y reiniciá el servidor
          para habilitar el copiloto.
        </NotaDato>
      ) : (
        <ChatCopiloto
          sugerencias={[
            "¿Cómo viene JETOUR contra CHERY este año?",
            "¿Qué pasó en mayo 2026? Fue un mes rarísimo",
            "Top 5 modelos PHEV y quién los importa",
            "¿En qué segmentos estamos más débiles?",
            "¿Quién ganó y quién perdió market share este año?",
          ]}
        />
      )}
    </div>
  );
}
