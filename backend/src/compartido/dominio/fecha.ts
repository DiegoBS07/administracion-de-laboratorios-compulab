import { DatoInvalido } from "./errores.js";

const MS_POR_DIA = 86_400_000;
const PATRON = /^(\d{4})-(\d{2})-(\d{2})$/;
const ANIO_MINIMO = 1970;
const ANIO_MAXIMO = 9999;

/** 1 = lunes … 7 = domingo. */
export type DiaDeLaSemana = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/**
 * Fecha del calendario en Costa Rica, sin hora. Inmutable.
 * Invariante: siempre es una fecha que existe (no hay 30 de febrero).
 * Internamente guarda los días transcurridos desde el 1 de enero de 1970; solo usa Date.UTC
 * para la aritmética del calendario, nunca para leer el reloj (R-6).
 */
export class Fecha {
  readonly #dias: number;

  private constructor(dias: number) {
    this.#dias = dias;
  }

  static de(anio: number, mes: number, dia: number): Fecha {
    const texto = `${anio}-${mes}-${dia}`;
    if (![anio, mes, dia].every(Number.isInteger)) {
      throw new DatoInvalido("fecha", texto, "La fecha debe tener año, mes y día enteros.");
    }
    if (anio < ANIO_MINIMO || anio > ANIO_MAXIMO) {
      throw new DatoInvalido("fecha", texto, `El año debe estar entre ${ANIO_MINIMO} y ${ANIO_MAXIMO}.`);
    }
    const ms = Date.UTC(anio, mes - 1, dia);
    const comprobacion = new Date(ms);
    if (comprobacion.getUTCFullYear() !== anio || comprobacion.getUTCMonth() !== mes - 1 || comprobacion.getUTCDate() !== dia) {
      throw new DatoInvalido("fecha", texto, "La fecha no existe en el calendario.");
    }
    return new Fecha(ms / MS_POR_DIA);
  }

  /** Lee "AAAA-MM-DD", el formato de fechas de la API (docs/08-componentes.md, 8.7). */
  static desdeTexto(texto: string): Fecha {
    const partes = PATRON.exec(texto);
    if (!partes) {
      throw new DatoInvalido("fecha", texto, "La fecha debe tener el formato AAAA-MM-DD.");
    }
    return Fecha.de(Number(partes[1]), Number(partes[2]), Number(partes[3]));
  }

  /** Para Instante: la fecha que corresponde a un número de días desde el 1 de enero de 1970. */
  static desdeDiasDesdeEpoca(dias: number): Fecha {
    if (!Number.isSafeInteger(dias) || dias < 0) {
      throw new DatoInvalido("dias", dias, "Los días desde 1970 deben ser un entero no negativo.");
    }
    return new Fecha(dias);
  }

  get diasDesdeEpoca(): number {
    return this.#dias;
  }

  get anio(): number {
    return this.#comoDate().getUTCFullYear();
  }

  get mes(): number {
    return this.#comoDate().getUTCMonth() + 1;
  }

  get dia(): number {
    return this.#comoDate().getUTCDate();
  }

  get diaDeLaSemana(): DiaDeLaSemana {
    return (((this.#comoDate().getUTCDay() + 6) % 7) + 1) as DiaDeLaSemana;
  }

  sumarDias(dias: number): Fecha {
    if (!Number.isInteger(dias)) {
      throw new DatoInvalido("dias", dias, "Solo se pueden sumar días enteros.");
    }
    return Fecha.desdeDiasDesdeEpoca(this.#dias + dias);
  }

  /** Días desde esta fecha hasta otra (negativo si la otra es anterior). */
  diasHasta(otra: Fecha): number {
    return otra.#dias - this.#dias;
  }

  /** El lunes de la semana a la que pertenece (semana de lunes a domingo, SUP-05). */
  lunesDeSuSemana(): Fecha {
    return this.sumarDias(1 - this.diaDeLaSemana);
  }

  esFinDeSemana(): boolean {
    return this.diaDeLaSemana >= 6;
  }

  comparar(otra: Fecha): -1 | 0 | 1 {
    return Math.sign(this.#dias - otra.#dias) as -1 | 0 | 1;
  }

  esAnteriorA(otra: Fecha): boolean {
    return this.#dias < otra.#dias;
  }

  esPosteriorA(otra: Fecha): boolean {
    return this.#dias > otra.#dias;
  }

  esIgualA(otra: Fecha): boolean {
    return this.#dias === otra.#dias;
  }

  aTexto(): string {
    return `${String(this.anio).padStart(4, "0")}-${String(this.mes).padStart(2, "0")}-${String(this.dia).padStart(2, "0")}`;
  }

  toString(): string {
    return this.aTexto();
  }

  #comoDate(): Date {
    return new Date(this.#dias * MS_POR_DIA);
  }
}
