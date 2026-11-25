import { DatoInvalido, Dinero, type Fecha, Semana } from "../../../compartido/dominio/index.js";
import { type HorasNoPagadas, LineaDeLiquidacion, type MotivoNoPagado } from "./linea-de-liquidacion.js";
import type { MesDeLiquidacion } from "./mes-de-liquidacion.js";
import type { TarifasDelPeriodo } from "./tarifas-del-periodo.js";
import type { TurnoTrabajado } from "./turno-trabajado.js";

/** Minutos por hora × 100 (el recargo es un porcentaje): denominador común del monto (RN-27). */
const DENOMINADOR_MONTO = 60 * 100;

export interface TopeVigente {
  minutosPorSemana: number;
  vigenteDesde: Fecha;
}

export interface DatosDelAsistente {
  id: string;
  carne: string;
  nombre: string;
  categoria: string;
  /** Historial de topes (RF-07); se usa el vigente el lunes de cada semana. */
  topes: readonly TopeVigente[];
}

/**
 * Calcula la línea de un asistente para un mes (CU-14 pasos 3 a 5). Tiene los datos del asistente
 * y su historial de topes, así que el cálculo ocurre aquí y no como mensajes sueltos (10.4).
 * Invariantes: datos del asistente no vacíos; al menos un tope, todos enteros mayores que cero.
 */
export class LiquidacionDelAsistente {
  readonly #asistente: DatosDelAsistente;
  readonly #topes: readonly TopeVigente[];

  private constructor(asistente: DatosDelAsistente) {
    this.#asistente = asistente;
    this.#topes = [...asistente.topes].sort((a, b) => a.vigenteDesde.comparar(b.vigenteDesde));
  }

  static de(asistente: DatosDelAsistente): LiquidacionDelAsistente {
    for (const campo of ["id", "carne", "nombre", "categoria"] as const) {
      if (!asistente[campo]?.trim()) {
        throw new DatoInvalido(campo, asistente[campo], `El campo ${campo} del asistente no puede venir vacío.`);
      }
    }
    if (asistente.topes.length === 0 || asistente.topes.some((t) => !Number.isInteger(t.minutosPorSemana) || t.minutosPorSemana <= 0)) {
      throw new DatoInvalido("topes", asistente.topes.length, "El asistente necesita al menos un tope semanal entero mayor que cero.");
    }
    return new LiquidacionDelAsistente(asistente);
  }

  /**
   * Recorre cada semana en orden cronológico (SUP-05): las primeras horas hasta el tope se pagan,
   * las siguientes quedan como no pagadas (RN-24). Las horas de días anteriores al mes solo cuentan
   * para el tope. Cada hora pagable se cobra con la tarifa y el recargo vigentes en su fecha (RN-22,
   * RN-23, SUP-17), y el monto se redondea una sola vez al céntimo (RN-27).
   * Devuelve null si el asistente no tiene ningún minuto en el mes (CU-14 ext 3a, SUP-26).
   */
  calcular(turnos: readonly TurnoTrabajado[], mes: MesDeLiquidacion, tarifas: TarifasDelPeriodo): LineaDeLiquidacion | null {
    const ajeno = turnos.find((t) => t.idAsistente !== this.#asistente.id);
    if (ajeno) {
      throw new DatoInvalido("turnos", ajeno.idTurno, "Solo se pueden liquidar turnos del asistente.");
    }

    let minutosNormales = 0;
    let minutosConRecargo = 0;
    let numerador = 0;
    const noPagados = new Map<string, HorasNoPagadas>();
    const anotarNoPagado = (semana: Semana, motivo: MotivoNoPagado, minutos: number) => {
      const clave = `${semana.lunes.aTexto()}|${motivo}`;
      const previo = noPagados.get(clave);
      noPagados.set(clave, { semana: semana.lunes.aTexto(), motivo, minutos: (previo?.minutos ?? 0) + minutos });
    };

    for (const [semana, delaSemana] of agruparPorSemana(turnos)) {
      const tope = this.#topeVigenteEn(semana.lunes);
      let acumulado = 0;
      for (const turno of delaSemana) {
        const trabajados = turno.minutosTrabajados();
        const pagables = Math.min(trabajados, Math.max(0, tope - acumulado));
        acumulado += trabajados;
        if (!mes.contiene(turno.fecha)) continue; // de la semana anterior al mes: solo cuenta para el tope

        if (pagables > 0) {
          const tarifa = tarifas.tarifaPorHora(this.#asistente.categoria, turno.fecha);
          const recargo = turno.llevaRecargo() ? tarifas.porcentajeRecargo(turno.fecha) : 0;
          numerador += tarifa.centimos * pagables * (100 + recargo);
          if (turno.llevaRecargo()) minutosConRecargo += pagables;
          else minutosNormales += pagables;
        }
        if (trabajados - pagables > 0) anotarNoPagado(semana, "SOBRE_TOPE", trabajados - pagables);
        const incompletos = turno.minutosConMarcaIncompleta();
        if (incompletos > 0) anotarNoPagado(semana, "MARCA_INCOMPLETA", incompletos);
      }
    }

    const detalle = [...noPagados.values()].sort((a, b) => a.semana.localeCompare(b.semana) || a.motivo.localeCompare(b.motivo));
    if (minutosNormales + minutosConRecargo + detalle.length === 0) {
      return null;
    }
    return LineaDeLiquidacion.de({
      idAsistente: this.#asistente.id,
      carne: this.#asistente.carne,
      nombre: this.#asistente.nombre,
      categoria: this.#asistente.categoria,
      minutosNormales,
      minutosConRecargo,
      noPagados: detalle,
      monto: Dinero.desdeFraccionDeCentimos(numerador, DENOMINADOR_MONTO)
    });
  }

  #topeVigenteEn(lunes: Fecha): number {
    const vigentes = this.#topes.filter((t) => !t.vigenteDesde.esPosteriorA(lunes));
    const tope = vigentes[vigentes.length - 1] ?? this.#topes[0];
    return tope ? tope.minutosPorSemana : 0;
  }
}

function agruparPorSemana(turnos: readonly TurnoTrabajado[]): [Semana, TurnoTrabajado[]][] {
  const porSemana = new Map<string, { semana: Semana; turnos: TurnoTrabajado[] }>();
  for (const turno of turnos) {
    const semana = Semana.deLaFecha(turno.fecha);
    const clave = semana.lunes.aTexto();
    const grupo = porSemana.get(clave) ?? { semana, turnos: [] };
    grupo.turnos.push(turno);
    porSemana.set(clave, grupo);
  }
  return [...porSemana.values()]
    .sort((a, b) => a.semana.lunes.comparar(b.semana.lunes))
    .map((g) => [g.semana, g.turnos.sort((a, b) => a.programado.inicio.comparar(b.programado.inicio))]);
}
