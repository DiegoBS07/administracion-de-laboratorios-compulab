import { DatoInvalido } from "./errores.js";

const MINUTOS_DEL_DIA = 1440;
const PATRON = /^(\d{2}):(\d{2})$/;

/**
 * Hora del día con precisión de minutos. Inmutable.
 * Invariante: entre 00:00 y 24:00. 24:00 solo representa el final del día (por ejemplo, el fin
 * de un turno que termina a medianoche); el inicio del día siguiente es 00:00.
 */
export class Hora {
  static readonly MINUTOS_DEL_DIA = MINUTOS_DEL_DIA;

  readonly #minutos: number;

  private constructor(minutos: number) {
    this.#minutos = minutos;
  }

  static deMinutos(minutos: number): Hora {
    if (!Number.isInteger(minutos) || minutos < 0 || minutos > MINUTOS_DEL_DIA) {
      throw new DatoInvalido("hora", minutos, "La hora debe estar entre 00:00 y 24:00.");
    }
    return new Hora(minutos);
  }

  static de(horas: number, minutos = 0): Hora {
    if (!Number.isInteger(horas) || !Number.isInteger(minutos) || minutos < 0 || minutos > 59) {
      throw new DatoInvalido("hora", `${horas}:${minutos}`, "La hora debe tener horas y minutos enteros (minutos de 0 a 59).");
    }
    return Hora.deMinutos(horas * 60 + minutos);
  }

  /** Lee "HH:MM", el formato de horas de la API (docs/08-componentes.md, 8.7). */
  static desdeTexto(texto: string): Hora {
    const partes = PATRON.exec(texto);
    if (!partes) {
      throw new DatoInvalido("hora", texto, "La hora debe tener el formato HH:MM.");
    }
    return Hora.de(Number(partes[1]), Number(partes[2]));
  }

  static medianoche(): Hora {
    return new Hora(0);
  }

  get minutos(): number {
    return this.#minutos;
  }

  get horas(): number {
    return Math.floor(this.#minutos / 60);
  }

  get minutosDeLaHora(): number {
    return this.#minutos % 60;
  }

  esFinDelDia(): boolean {
    return this.#minutos === MINUTOS_DEL_DIA;
  }

  comparar(otra: Hora): -1 | 0 | 1 {
    return Math.sign(this.#minutos - otra.#minutos) as -1 | 0 | 1;
  }

  esAnteriorA(otra: Hora): boolean {
    return this.#minutos < otra.#minutos;
  }

  esIgualA(otra: Hora): boolean {
    return this.#minutos === otra.#minutos;
  }

  aTexto(): string {
    return `${String(this.horas).padStart(2, "0")}:${String(this.minutosDeLaHora).padStart(2, "0")}`;
  }

  toString(): string {
    return this.aTexto();
  }
}
