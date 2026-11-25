import { DatoInvalido, Fecha, Franja, Hora, Instante } from "../../../compartido/dominio/index.js";

/**
 * Un mes del calendario que se liquida (CU-14). Inmutable.
 * Invariantes: mes de 1 a 12 y año entre 1970 y 9998.
 */
export class MesDeLiquidacion {
  readonly #anio: number;
  readonly #mes: number;

  private constructor(anio: number, mes: number) {
    this.#anio = anio;
    this.#mes = mes;
  }

  static de(anio: number, mes: number): MesDeLiquidacion {
    if (!Number.isInteger(anio) || anio < 1970 || anio > 9998) {
      throw new DatoInvalido("anio", anio, "El año debe ser un entero entre 1970 y 9998.");
    }
    if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
      throw new DatoInvalido("mes", mes, "El mes debe ser un entero de 1 a 12.");
    }
    return new MesDeLiquidacion(anio, mes);
  }

  get anio(): number {
    return this.#anio;
  }

  get mes(): number {
    return this.#mes;
  }

  /** "2026-10": identifica el cierre del mes (RN-26, UNIQUE (anio, mes)). */
  get clave(): string {
    return `${this.#anio}-${String(this.#mes).padStart(2, "0")}`;
  }

  get primerDia(): Fecha {
    return Fecha.de(this.#anio, this.#mes, 1);
  }

  get ultimoDia(): Fecha {
    return this.#primerDiaDelSiguiente().sumarDias(-1);
  }

  contiene(fecha: Fecha): boolean {
    return !fecha.esAnteriorA(this.primerDia) && !fecha.esPosteriorA(this.ultimoDia);
  }

  /** CU-14 ext 2b: el mes se puede cerrar a partir del día 1 del mes siguiente a las 00:00. */
  terminoAntesDe(instante: Instante): boolean {
    return !instante.esAnteriorA(this.inicioDelSiguiente());
  }

  inicioDelSiguiente(): Instante {
    return Instante.de(this.#primerDiaDelSiguiente(), Hora.medianoche());
  }

  /**
   * Periodo que hay que leer para calcular el mes: desde el lunes de la semana del día 1 hasta
   * el fin del mes. Las horas de la semana que viene del mes anterior cuentan para el tope (SUP-05).
   */
  periodoDeCalculo(): Franja {
    return Franja.de(Instante.de(this.primerDia.lunesDeSuSemana(), Hora.medianoche()), this.inicioDelSiguiente());
  }

  esIgualA(otro: MesDeLiquidacion): boolean {
    return this.#anio === otro.#anio && this.#mes === otro.#mes;
  }

  toString(): string {
    return this.clave;
  }

  #primerDiaDelSiguiente(): Fecha {
    return this.#mes === 12 ? Fecha.de(this.#anio + 1, 1, 1) : Fecha.de(this.#anio, this.#mes + 1, 1);
  }
}
