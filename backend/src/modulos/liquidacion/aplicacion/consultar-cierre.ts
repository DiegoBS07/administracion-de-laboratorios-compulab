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
