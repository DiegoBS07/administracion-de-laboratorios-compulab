import type { Archivo, CierreMensual } from "../dominio/cierre-mensual.js";
import type { MotivoNoPagado } from "../dominio/linea-de-liquidacion.js";

/** Respuesta de la API para CU-14 (docs/08-componentes.md, 8.7). */
export interface ResumenDeCierreDTO {
  id: string;
  anio: number;
  mes: number;
  fechaDeCierre: string;
  estado: "CERRADO";
  moneda: "CRC";
  totalCentimos: number;
  tarifasAplicadas: {
    vigenteDesde: string;
    vigenteHasta: string | null;
    tarifaPorHoraCentimos: Record<string, number>;
    porcentajeRecargo: number;
  }[];
  lineas: {
    idAsistente: string;
    carne: string;
    nombre: string;
    categoria: string;
    minutosNormales: number;
    minutosConRecargo: number;
    minutosNoPagados: number;
    montoCentimos: number;
    noPagados: { semana: string; motivo: MotivoNoPagado; minutos: number }[];
  }[];
}

export type ArchivoDTO = Archivo;

export function resumenDe(cierre: CierreMensual): ResumenDeCierreDTO {
  return {
    id: cierre.id,
    anio: cierre.mes.anio,
    mes: cierre.mes.mes,
    fechaDeCierre: cierre.fechaDeCierre.aISO(),
    estado: cierre.estado,
    moneda: "CRC",
    totalCentimos: cierre.total.centimos,
    tarifasAplicadas: cierre.tarifasAplicadas.map((v) => ({
      vigenteDesde: v.vigenteDesde.aTexto(),
      vigenteHasta: v.vigenteHasta?.aTexto() ?? null,
      tarifaPorHoraCentimos: Object.fromEntries(Object.entries(v.tarifaPorHora).map(([categoria, d]) => [categoria, d.centimos])),
      porcentajeRecargo: v.porcentajeRecargo
    })),
    lineas: cierre.lineas.map((l) => ({
      idAsistente: l.idAsistente,
      carne: l.carne,
      nombre: l.nombre,
      categoria: l.categoria,
      minutosNormales: l.minutosNormales,
      minutosConRecargo: l.minutosConRecargo,
      minutosNoPagados: l.minutosNoPagados,
      montoCentimos: l.monto.centimos,
      noPagados: [...l.noPagados]
    }))
  };
}
