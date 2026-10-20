import type * as React from "react";
import type { IconoNav } from "@/lib/nav";
import {
  IconInicio, IconMercado, IconEvolucion, IconRankings, IconSegmentos,
  IconCombustibles, IconLocalidades, IconMarketShare, IconBrecha, IconBubble,
  IconGama, IconPortafolio, IconOperacion, IconAcciones, IconRentabilidad, IconCbd, IconCarflow,
  IconInteligencia, IconCopiloto, IconCargas,
  IconCalidad, IconConfiguracion,
} from "@/components/icons";

type Icono = React.ComponentType<{ size?: number; className?: string }>;

/** El ícono de línea de cada pantalla del menú. Lo comparten el menú lateral y
 *  la paleta de comandos para que una pantalla se vea igual en los dos. */
export const ICONOS: Record<IconoNav, Icono> = {
  inicio: IconInicio,
  mercado: IconMercado,
  evolucion: IconEvolucion,
  rankings: IconRankings,
  segmentos: IconSegmentos,
  combustibles: IconCombustibles,
  localidades: IconLocalidades,
  "market-share": IconMarketShare,
  brecha: IconBrecha,
  bubble: IconBubble,
  gama: IconGama,
  portafolio: IconPortafolio,
  operacion: IconOperacion,
  acciones: IconAcciones,
  rentabilidad: IconRentabilidad,
  cbd: IconCbd,
  carflow: IconCarflow,
  inteligencia: IconInteligencia,
  copiloto: IconCopiloto,
  cargas: IconCargas,
  calidad: IconCalidad,
  configuracion: IconConfiguracion,
};
