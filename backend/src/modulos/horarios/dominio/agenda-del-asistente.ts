import { DatoInvalido, type Franja, type Semana } from "../../../compartido/dominio/index.js";
import type { Disponibilidad } from "./disponibilidad.js";
import { AsistenteNoActivo, resumenDeConflicto, TopeSemanalExcedido, TraslapeDeTurno } from "./errores.js";
import type { Turno } from "./turno.js";

export interface DatosAgendaDelAsistente {
  idAsistente: string;
  activo: boolean;
  topeSemanalMinutos: number;
  disponibilidad: Disponibilidad;
  semana: Semana;
  /** Todos los turnos del asistente en esa semana, de cualquier laboratorio o campus. */
  turnos: readonly Turno[];
}

/**
 * Los turnos de un asistente en una semana, con su tope y su disponibilidad.
 * Es quien conoce todos sus turnos, así que es quien decide si puede tomar uno más
 * (docs/10-comportamiento.md, 10.2): RN-04, RN-06, RN-07 y RN-08.
 * Invariantes: tope entero mayor que cero (RN-03); todos los turnos son de ese asistente y de esa semana.
 */
export class AgendaDelAsistente {
  readonly #idAsistente: string;
  readonly #activo: boolean;
  readonly #topeSemanalMinutos: number;
  readonly #disponibilidad: Disponibilidad;
  readonly #semana: Semana;
  readonly #turnos: readonly Turno[];

  private constructor(datos: DatosAgendaDelAsistente) {
    this.#idAsistente = datos.idAsistente;
    this.#activo = datos.activo;
    this.#topeSemanalMinutos = datos.topeSemanalMinutos;
    this.#disponibilidad = datos.disponibilidad;
    this.#semana = datos.semana;
    this.#turnos = [...datos.turnos];
  }

  static de(datos: DatosAgendaDelAsistente): AgendaDelAsistente {
    if (!Number.isInteger(datos.topeSemanalMinutos) || datos.topeSemanalMinutos <= 0) {
      throw new DatoInvalido("topeSemanalMinutos", datos.topeSemanalMinutos, "El tope semanal debe ser un número entero de minutos mayor que cero.");
    }
    const semana = datos.semana.franja();
    for (const turno of datos.turnos) {
      if (turno.idAsistente !== datos.idAsistente || !semana.seTraslapaCon(turno.franja)) {
        throw new DatoInvalido("turnos", turno.id, "La agenda solo puede contener turnos del asistente en esa semana.");
      }
    }
    return new AgendaDelAsistente(datos);
  }

  /** Minutos que ya cuentan para el tope en la semana (todos los turnos salvo vacantes y descartados, RN-07). */
  get minutosProgramados(): number {
    return this.#turnos.filter((t) => t.ocupaLaFranja()).reduce((total, t) => total + t.duracionMinutos, 0);
  }

  get topeSemanalMinutos(): number {
    return this.#topeSemanalMinutos;
  }

  /**
   * CU-06 paso 4: verifica que el asistente pueda tomar un turno en esa franja.
   * Lanza AsistenteNoActivo (ext 3d), TraslapeDeTurno (ext 4a) o TopeSemanalExcedido (ext 4c).
   * Si puede, dice si la franja está dentro de su disponibilidad declarada (ext 4d).
   */
  evaluar(franja: Franja): { dentroDeDisponibilidad: boolean } {
    if (!this.#semana.franja().contieneFranja(franja)) {
      throw new DatoInvalido("franja", franja.toString(), "La franja debe estar dentro de la semana de la agenda.");
    }
    if (!this.#activo) {
      throw new AsistenteNoActivo(this.#idAsistente);
    }
    const conflicto = this.#turnos.find((t) => t.chocaCon(franja));
    if (conflicto) {
      throw new TraslapeDeTurno(resumenDeConflicto(conflicto));
    }
    const programados = this.minutosProgramados;
    if (programados + franja.duracionMinutos > this.#topeSemanalMinutos) {
      throw new TopeSemanalExcedido(programados, franja.duracionMinutos, this.#topeSemanalMinutos, this.#semana.lunes.aTexto());
    }
    return { dentroDeDisponibilidad: this.#disponibilidad.cubre(franja) };
  }
}
