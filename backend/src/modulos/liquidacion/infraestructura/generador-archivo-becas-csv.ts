import type { GeneradorArchivoBecas } from "../aplicacion/puertos.js";
import type { Archivo, CierreMensual } from "../dominio/cierre-mensual.js";
import { ErrorAlGenerarArchivo } from "../dominio/errores.js";

/** Encabezado exigido por Becas (SUP-03). */
export const ENCABEZADO_BECAS = "mes,carne,nombre,categoria,horas_normales,horas_con_recargo,horas_no_pagadas,monto_colones";

/**
 * Adaptador GeneradorArchivoBecas (docs/08-componentes.md, 8.6): capa anticorrupción y único
 * lugar que conoce el formato de Becas. CSV RFC 4180 (comas, CRLF, comillas dobles), una fila por
 * línea ordenada por carné, horas con dos decimales y monto en colones con dos decimales.
 * Determinista y sin escribir en disco.
 */
export class GeneradorArchivoBecasCsv implements GeneradorArchivoBecas {
  generar(cierre: CierreMensual): Archivo {
    const mes = cierre.mes.clave;
    const filas = [...cierre.lineas]
      .sort((a, b) => a.carne.localeCompare(b.carne))
      .map((l) => {
        if (!l.carne.trim() || !l.nombre.trim() || !l.categoria.trim()) {
          throw new ErrorAlGenerarArchivo(`La línea del asistente ${l.idAsistente} tiene datos vacíos.`);
        }
        return [
          mes,
          l.carne,
          l.nombre,
          l.categoria,
          horas(l.minutosNormales),
          horas(l.minutosConRecargo),
          horas(l.minutosNoPagados),
          colones(l.monto.centimos)
        ]
          .map(campo)
          .join(",");
      });
    return {
      nombre: `becas-${mes}.csv`,
      tipo: "text/csv",
      contenido: [ENCABEZADO_BECAS, ...filas].join("\r\n") + "\r\n"
    };
  }
}

/** Minutos a horas con dos decimales, redondeo a la mitad hacia arriba con enteros (sin errores de coma flotante). */
function horas(minutos: number): string {
  return conDosDecimales(Math.floor((minutos * 100 + 30) / 60));
}

function colones(centimos: number): string {
  return conDosDecimales(centimos);
}

function conDosDecimales(centesimas: number): string {
  return `${Math.floor(centesimas / 100)}.${String(centesimas % 100).padStart(2, "0")}`;
}

/**
 * Comillas cuando hace falta (RFC 4180). Un texto que empieza con = + - @ se precede con un
 * apóstrofo para que una hoja de cálculo no lo ejecute como fórmula (inyección CSV).
 */
function campo(valor: string): string {
  const seguro = /^[=+\-@\t\r]/.test(valor) && !/^-?\d/.test(valor) ? `'${valor}` : valor;
  return /[",\r\n]/.test(seguro) ? `"${seguro.replaceAll('"', '""')}"` : seguro;
}
