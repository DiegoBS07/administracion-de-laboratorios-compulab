import { DatoInvalido } from "./errores.js";

/**
 * Monto en colones costarricenses, guardado en céntimos enteros (RN-27). Inmutable.
 * Invariante: entero no negativo y seguro (sin decimales de punto flotante, que pierden céntimos).
 */
export class Dinero {
  static readonly MONEDA = "CRC";

  readonly #centimos: number;

  private constructor(centimos: number) {
    this.#centimos = centimos;
  }

  static deCentimos(centimos: number): Dinero {
    if (!Number.isSafeInteger(centimos) || centimos < 0) {
      throw new DatoInvalido("monto", centimos, "El monto debe ser una cantidad entera de céntimos, no negativa.");
    }
    return new Dinero(centimos);
  }

  static cero(): Dinero {
    return new Dinero(0);
  }

  /**
   * Convierte una cantidad fraccionaria de céntimos (numerador / denominador) en Dinero,
   * redondeando al céntimo y mitad hacia arriba (RN-27, SUP-25). Usa solo aritmética entera,
   * así que el resultado es exacto: por ejemplo, tarifa × minutos × (100 + recargo) / (60 × 100).
   */
  static desdeFraccionDeCentimos(numerador: number, denominador: number): Dinero {
    if (!Number.isSafeInteger(numerador) || numerador < 0) {
      throw new DatoInvalido("numerador", numerador, "El numerador debe ser un entero no negativo.");
    }
    if (!Number.isSafeInteger(denominador) || denominador <= 0) {
      throw new DatoInvalido("denominador", denominador, "El denominador debe ser un entero positivo.");
    }
    const cociente = Math.floor(numerador / denominador);
    const resto = numerador - cociente * denominador;
    return Dinero.deCentimos(2 * resto >= denominador ? cociente + 1 : cociente);
  }

  static sumarTodos(montos: readonly Dinero[]): Dinero {
    return montos.reduce((total, monto) => total.sumar(monto), Dinero.cero());
  }

  get centimos(): number {
    return this.#centimos;
  }

  sumar(otro: Dinero): Dinero {
    return Dinero.deCentimos(this.#centimos + otro.#centimos);
  }

  comparar(otro: Dinero): -1 | 0 | 1 {
    return Math.sign(this.#centimos - otro.#centimos) as -1 | 0 | 1;
  }

  esIgualA(otro: Dinero): boolean {
    return this.#centimos === otro.#centimos;
  }

  toString(): string {
    return `${Dinero.MONEDA} ${(this.#centimos / 100).toFixed(2)}`;
  }
}
