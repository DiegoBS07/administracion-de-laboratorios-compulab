import { DatoInvalido, type Franja } from "../../../compartido/dominio/index.js";
import { FranjaOcupadaEnLaboratorio, resumenDeConflicto } from "./errores.js";
import type { Turno } from "./turno.js";

/**
 * Los turnos de un laboratorio en un periodo. Sabe si una franja ya tiene responsable (RN-09).
 * Invariante: todos los turnos son de ese laboratorio.
 */
export class AgendaDelLaboratorio {
  readonly #idLaboratorio: string;
  readonly #turnos: readonly Turno[];

  private constructor(idLaboratorio: string, turnos: readonly Turno[]) {
    this.#idLaboratorio = idLaboratorio;
    this.#turnos = [...turnos];
  }

  static de(idLaboratorio: string, turnos: readonly Turno[]): AgendaDelLaboratorio {
    const ajeno = turnos.find((t) => t.idLaboratorio !== idLaboratorio);
    if (ajeno) {
      throw new DatoInvalido("turnos", ajeno.id, "La agenda del laboratorio solo puede contener turnos de ese laboratorio.");
    }
    return new AgendaDelLaboratorio(idLaboratorio, turnos);
  }

  get idLaboratorio(): string {
    return this.#idLaboratorio;
  }

  /** CU-06 ext 4b: lanza FranjaOcupadaEnLaboratorio si otro turno ya ocupa esa franja. */
  verificarLibre(franja: Franja): void {
    const conflicto = this.#turnos.find((t) => t.chocaCon(franja));
    if (conflicto) {
      throw new FranjaOcupadaEnLaboratorio(resumenDeConflicto(conflicto));
    }
  }
}
