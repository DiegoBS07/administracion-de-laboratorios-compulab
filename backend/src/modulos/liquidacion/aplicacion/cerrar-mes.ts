import type { Reloj } from "../../../compartido/dominio/index.js";
import { CierreMensual } from "../dominio/cierre-mensual.js";
import { MesNoTerminado, TarifaNoDefinida } from "../dominio/errores.js";
import type { LineaDeLiquidacion } from "../dominio/linea-de-liquidacion.js";
import { LiquidacionDelAsistente } from "../dominio/liquidacion-del-asistente.js";
import { MesDeLiquidacion } from "../dominio/mes-de-liquidacion.js";
import { TarifasDelPeriodo } from "../dominio/tarifas-del-periodo.js";
import { TurnoTrabajado } from "../dominio/turno-trabajado.js";
import { CierreYaExiste } from "./errores.js";
import {
  COORDINACION_DE_SOPORTE,
  type DatosDeAsistentes,
  type GeneradorArchivoBecas,
  type HorasTrabajadas,
  type Notificador,
  type RepositorioCierres,
  type TablaTarifas
} from "./puertos.js";
import { type ResumenDeCierreDTO, resumenDe } from "./resumen-de-cierre.js";

export interface ResultadoCerrarMes {
  /** false cuando el mes ya estaba cerrado (ext 2a, 2c): la API responde 200 en lugar de 201. */
  creado: boolean;
  cierre: ResumenDeCierreDTO;
}

export interface DependenciasCerrarMes {
  cierres: RepositorioCierres;
  horas: HorasTrabajadas;
  asistentes: DatosDeAsistentes;
  tarifas: TablaTarifas;
  generador: GeneradorArchivoBecas;
  notificador: Notificador;
  reloj: Reloj;
}

/**
 * CU-14 · Cerrar el mes (docs/04-casos-de-uso.md, 4.4; realización en 10.4).
 * Controlador del caso de uso: coordina; el cálculo vive en LiquidacionDelAsistente.
 */
export class CerrarMes {
  readonly #d: DependenciasCerrarMes;

  constructor(dependencias: DependenciasCerrarMes) {
    this.#d = dependencias;
  }

  async ejecutar(anio: number, mes: number): Promise<ResultadoCerrarMes> {
    // paso 1 · el mes terminó (ext 2b)
    const delMes = MesDeLiquidacion.de(anio, mes);
    const ahora = this.#d.reloj.ahora();
    if (!delMes.terminoAntesDe(ahora)) {
      throw new MesNoTerminado(delMes.clave, delMes.inicioDelSiguiente().aISO());
    }

    // paso 2 · un mes se cierra una sola vez (ext 2a, RN-26)
    const existente = await this.#d.cierres.porMes(delMes);
    if (existente) return { creado: false, cierre: resumenDe(existente) };

    // pasos 3 a 5 · horas, topes y tarifas de cada asistente
    const tarifas = TarifasDelPeriodo.de(await this.#d.tarifas.vigenciasEntre(delMes.primerDia, delMes.ultimoDia));
    const lineas = await this.#calcularLineas(delMes, tarifas);

    // paso 6 · se crea el cierre (P1, P2, P5, P7)
    const cerrado = CierreMensual.cerrar({ mes: delMes, lineas, tarifasAplicadas: tarifas.vigencias, fechaDeCierre: ahora });

    // paso 7 · archivo para Becas antes de guardar: si falla, no se cierra nada (ext 7a, P6)
    const cierre = cerrado.adjuntarArchivo(this.#d.generador.generar(cerrado));

    try {
      await this.#d.cierres.guardar(cierre);
    } catch (error) {
      if (!(error instanceof CierreYaExiste)) throw error;
      // ext 2c · otro disparo guardó primero: se devuelve el suyo
      const ganador = await this.#d.cierres.porMes(delMes);
      if (!ganador) throw error;
      return { creado: false, cierre: resumenDe(ganador) };
    }

    // paso 8 · aviso al coordinador de soporte, de último porque no se puede deshacer (P8)
    const sobreTope = cierre.lineasConHorasSobreElTope();
    await this.#d.notificador.avisar(COORDINACION_DE_SOPORTE, "CIERRE_LISTO", {
      mes: delMes.clave,
      totalCentimos: String(cierre.total.centimos),
      lineas: String(cierre.lineas.length),
      asistentesConHorasSobreElTope: sobreTope.map((l) => l.carne).join(",")
    });
    return { creado: true, cierre: resumenDe(cierre) };
  }

  async #calcularLineas(delMes: MesDeLiquidacion, tarifas: TarifasDelPeriodo): Promise<LineaDeLiquidacion[]> {
    try {
      tarifas.exigirCobertura(delMes.primerDia, delMes.ultimoDia);
      const registros = await this.#d.horas.delPeriodo(delMes.periodoDeCalculo());
      const porAsistente = new Map<string, TurnoTrabajado[]>();
      for (const registro of registros) {
        const turnos = porAsistente.get(registro.idAsistente) ?? [];
        turnos.push(TurnoTrabajado.de(registro));
        porAsistente.set(registro.idAsistente, turnos);
      }

      const lineas: LineaDeLiquidacion[] = [];
      for (const [idAsistente, turnos] of porAsistente) {
        const datos = await this.#d.asistentes.obtener(idAsistente);
        const linea = LiquidacionDelAsistente.de({ id: idAsistente, ...datos }).calcular(turnos, delMes, tarifas);
        if (linea) lineas.push(linea); // ext 3a · sin horas en el mes, sin línea
      }
      return lineas.sort((a, b) => a.carne.localeCompare(b.carne));
    } catch (error) {
      if (error instanceof TarifaNoDefinida) {
        // ext 5b · no se cierra y se avisa al coordinador de soporte
        await this.#d.notificador.avisar(COORDINACION_DE_SOPORTE, "TARIFA_FALTANTE", {
          mes: delMes.clave,
          fecha: String(error.detalle["fecha"]),
          categoria: String(error.detalle["categoria"] ?? "")
        });
      }
      throw error;
    }
  }
}
