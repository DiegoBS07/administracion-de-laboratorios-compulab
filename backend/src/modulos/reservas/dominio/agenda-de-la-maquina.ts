import { DatoInvalido, type Franja } from "../../../compartido/dominio/index.js";
import { MaquinaNoDisponible } from "./errores.js";
import type { Reserva } from "./reserva.js";

/**
 * Las reservas de una máquina en un periodo. Sabe si la máquina está libre en una franja.
 * Invariante: todas las reservas son de esa máquina.
 */
export class AgendaDeLaMaquina {
  readonly #idMaquina: string;
  readonly #reservas: readonly Reserva[];

  private constructor(idMaquina: string, reservas: readonly Reserva[]) {
    this.#idMaquina = idMaquina;
    this.#reservas = [...reservas];
  }

  static de(idMaquina: string, reservas: readonly Reserva[]): AgendaDeLaMaquina {
    const ajena = reservas.find((r) => r.idMaquina !== idMaquina);
    if (ajena) {
      throw new DatoInvalido("reservas", ajena.id, "La agenda de la máquina solo puede contener reservas de esa máquina.");
    }
    return new AgendaDeLaMaquina(idMaquina, reservas);
  }

  /** CU-11 ext 5b: lanza MaquinaNoDisponible si una reserva activa se traslapa (I1). */
  verificarLibre(franja: Franja): void {
    const conflicto = this.#reservas.find((r) => r.chocaCon(franja));
    if (conflicto) {
      throw new MaquinaNoDisponible(this.#idMaquina, conflicto.franja.inicio.aISO(), conflicto.franja.fin.aISO());
    }
  }

  /** Franjas ocupadas por reservas activas (para mostrar la disponibilidad, RF-22). */
  franjasOcupadas(): Franja[] {
    return this.#reservas.filter((r) => r.estaActiva()).map((r) => r.franja);
  }
}
