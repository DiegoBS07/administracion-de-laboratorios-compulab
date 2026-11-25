import { DatoInvalido } from "./errores.js";
import { Fecha } from "./fecha.js";
import { Franja } from "./franja.js";
import { Hora } from "./hora.js";
import { Instante } from "./instante.js";

/**
 * Semana de lunes 00:00 a domingo 23:59 (SUP-05). Inmutable.
 * Invariante: siempre empieza un lunes.
 * Es la unidad del tope de horas de un asistente (RN-07, RN-24) y del límite de 6 horas de
 * reservas de un estudiante (RN-17).
 */
export class Semana {
  readonly #lunes: Fecha;

  private constructor(lunes: Fecha) {
    this.#lunes = lunes;
  }

  static deLaFecha(fecha: Fecha): Semana {
    return new Semana(fecha.lunesDeSuSemana());
  }

  static queEmpiezaEl(lunes: Fecha): Semana {
    if (lunes.diaDeLaSemana !== 1) {
      throw new DatoInvalido("semana", lunes.aTexto(), "Una semana debe empezar un lunes.");
    }
    return new Semana(lunes);
  }

  get lunes(): Fecha {
    return this.#lunes;
  }

  get domingo(): Fecha {
    return this.#lunes.sumarDias(6);
  }

  dias(): Fecha[] {
    return [0, 1, 2, 3, 4, 5, 6].map((n) => this.#lunes.sumarDias(n));
  }

  contiene(fecha: Fecha): boolean {
    return !fecha.esAnteriorA(this.#lunes) && !fecha.esPosteriorA(this.domingo);
  }

  /** La semana como franja: de lunes 00:00 al lunes siguiente 00:00. */
  franja(): Franja {
    return Franja.de(Instante.de(this.#lunes, Hora.medianoche()), Instante.de(this.#lunes.sumarDias(7), Hora.medianoche()));
  }

  siguiente(): Semana {
    return new Semana(this.#lunes.sumarDias(7));
  }

  anterior(): Semana {
    return new Semana(this.#lunes.sumarDias(-7));
  }

  esIgualA(otra: Semana): boolean {
    return this.#lunes.esIgualA(otra.#lunes);
  }

  toString(): string {
    return `semana del ${this.#lunes.aTexto()}`;
  }
}
