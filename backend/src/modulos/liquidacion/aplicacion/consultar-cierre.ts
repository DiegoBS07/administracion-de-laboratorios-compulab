import type { Reloj } from "../../../compartido/dominio/index.js";
import type { CierreMensual } from "../dominio/cierre-mensual.js";
import { MesDeLiquidacion } from "../dominio/mes-de-liquidacion.js";
import { CierreNoExiste } from "./errores.js";
import type { RepositorioCierres } from "./puertos.js";
import { type ArchivoDTO, type ResumenDeCierreDTO, resumenDe } from "./resumen-de-cierre.js";

async function cierreDe(cierres: RepositorioCierres, anio: number, mes: number): Promise<CierreMensual> {
  const delMes = MesDeLiquidacion.de(anio, mes);
  const cierre = await cierres.porMes(delMes);
  if (!cierre) throw new CierreNoExiste(delMes.clave);
  return cierre;
}

/** Consulta de un cierre ya hecho (GET /api/v1/cierres/{anio}/{mes}). Sin efectos. */
export class ConsultarCierre {
  readonly #cierres: RepositorioCierres;

  constructor(dependencias: { cierres: RepositorioCierres }) {
    this.#cierres = dependencias.cierres;
  }

  async ejecutar(anio: number, mes: number): Promise<ResumenDeCierreDTO> {
    return resumenDe(await cierreDe(this.#cierres, anio, mes));
  }
}

export interface MesDelAnioDTO {
  anio: number;
  mes: number;
  estado: "CERRADO" | "POR_CERRAR" | "EN_CURSO";
}

/**
 * Meses del año con su estado, para la lista de /cierres (GET /api/v1/cierres?anio=). Sin efectos.
 * CERRADO: tiene cierre. POR_CERRAR: terminó y no se ha cerrado. EN_CURSO: el mes actual.
 * Los meses que todavía no empiezan no aparecen.
 */
export class ListarCierresDelAnio {
  readonly #d: { cierres: RepositorioCierres; reloj: Reloj };

  constructor(dependencias: { cierres: RepositorioCierres; reloj: Reloj }) {
    this.#d = dependencias;
  }

  async ejecutar(anio: number): Promise<MesDelAnioDTO[]> {
    MesDeLiquidacion.de(anio, 1); // valida el año
    const ahora = this.#d.reloj.ahora();
    const cerrados = new Set((await this.#d.cierres.delAnio(anio)).map((c) => c.mes.mes));
    const meses: MesDelAnioDTO[] = [];
    for (let mes = 1; mes <= 12; mes++) {
      const delMes = MesDeLiquidacion.de(anio, mes);
      if (cerrados.has(mes)) meses.push({ anio, mes, estado: "CERRADO" });
      else if (delMes.terminoAntesDe(ahora)) meses.push({ anio, mes, estado: "POR_CERRAR" });
      else if (delMes.contiene(ahora.fecha)) meses.push({ anio, mes, estado: "EN_CURSO" });
    }
    return meses;
  }
}

/** El archivo para Becas guardado con el cierre (GET /api/v1/cierres/{anio}/{mes}/archivo). Sin efectos. */
export class ObtenerArchivoBecas {
  readonly #cierres: RepositorioCierres;

  constructor(dependencias: { cierres: RepositorioCierres }) {
    this.#cierres = dependencias.cierres;
  }

  async ejecutar(anio: number, mes: number): Promise<ArchivoDTO> {
    const cierre = await cierreDe(this.#cierres, anio, mes);
    if (!cierre.archivo) throw new CierreNoExiste(cierre.mes.clave);
    return { ...cierre.archivo };
  }
}
