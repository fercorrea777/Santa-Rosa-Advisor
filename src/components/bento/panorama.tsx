"use client";

import * as React from "react";
import { useI18n } from "@/lib/i18n/cliente";
import { ProveedorTip } from "./comun";
import { TarjetaEstacionalidad, type PropsEstacionalidad } from "./tarjeta-estacionalidad";
import { TarjetaImportaciones, type PropsImportaciones } from "./tarjeta-importaciones";
import { TarjetaMarcas, type PropsMarcas } from "./tarjeta-marcas";
import { TarjetaMatriculaciones, type PropsMatriculaciones } from "./tarjeta-matriculaciones";
import { TarjetaParticipacion, type PropsParticipacion } from "./tarjeta-participacion";
import { TarjetaTreemap, type PropsTreemap } from "./tarjeta-treemap";

export interface DatosPanorama {
  matriculaciones: PropsMatriculaciones;
  importaciones: PropsImportaciones;
  treemap: PropsTreemap;
  participacion: PropsParticipacion;
  marcas: PropsMarcas;
  /** null = no hay serie de matriculaciones para el filtro. */
  estacionalidad: PropsEstacionalidad | null;
}

/**
 * El Panorama: el bento de seis tarjetas que abre el Resumen del mercado, en
 * lugar de la fila de indicadores de antes. Dice lo mismo (matriculaciones,
 * importaciones, diferencia, participación propia y quién lidera) pero cada
 * cifra viene con su historia: la evolución del año, quién gana terreno, dónde
 * están nuestras marcas y cómo es la estacionalidad.
 *
 * Es UN componente de cliente con un solo tooltip compartido; los datos llegan
 * ya calculados de la página (servidor), con los mismos filtros que el resto
 * de la pantalla.
 */
export function Panorama({ datos }: { datos: DatosPanorama }) {
  const { t } = useI18n();
  return (
    <ProveedorTip>
      <section aria-label={t("Panorama del mercado")} className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-12">
        <TarjetaMatriculaciones {...datos.matriculaciones} />
        <TarjetaImportaciones {...datos.importaciones} />
        <TarjetaTreemap {...datos.treemap} />
        <TarjetaParticipacion {...datos.participacion} />
        <TarjetaMarcas {...datos.marcas} />
        {datos.estacionalidad && <TarjetaEstacionalidad {...datos.estacionalidad} />}
      </section>
    </ProveedorTip>
  );
}
