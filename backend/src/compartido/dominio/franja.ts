import { FranjaInvalida } from "./errores.js";
import type { Fecha } from "./fecha.js";
import type { Hora } from "./hora.js";
import { Instante } from "./instante.js";

/**
 * Intervalo de tiempo [inicio, fin): incluye el inicio y excluye el fin. Inmutable.
 * Invariante: el inicio es anterior al fin (duración mayor que cero).
 * Es la base de turnos (RN-05, RN-06, RN-09) y reservas (RN-15, RN-16).
 */
export class Franja {
  readonly #inicio: Instante;
  readonly #fin: Instante;

  private constructor(inicio: Instante, fin: Instante) {
    this.#inicio = inicio;
    this.#fin = fin;
  }

  static de(inicio: Instante, fin: Instante): Franja {
    if (!inicio.esAnteriorA(fin)) {
      throw new FranjaInvalida(inicio.aISO(), fin.aISO());
    }
    return new Franja(inicio, fin);
  }

  /** Franja dentro de un mismo día; una hora de fin 24:00 termina a la medianoche. */
  static delDia(fecha: Fecha, horaInicio: Hora, horaFin: Hora): Franja {
    return Franja.de(Instante.de(fecha, horaInicio), Instante.de(fecha, horaFin));
  }

  /**
   * Une las franjas que se traslapan o que son contiguas (una termina cuando empieza otra)
   * y devuelve el resultado ordenado. Lo usa la cobertura de un laboratorio (8.4).
   */
  static fusionar(franjas: readonly Franja[]): Franja[] {
    const ordenadas = [...franjas].sort((a, b) => a.#inicio.comparar(b.#inicio));
    const resultado: Franja[] = [];
    for (const franja of ordenadas) {
      const ultima = resultado[resultado.length - 1];
      if (ultima && !franja.#inicio.esPosteriorA(ultima.#fin)) {
        const fin = franja.#fin.esPosteriorA(ultima.#fin) ? franja.#fin : ultima.#fin;
        resultado[resultado.length - 1] = new Franja(ultima.#inicio, fin);
      } else {
        resultado.push(franja);
      }
    }
    return resultado;
  }

  get inicio(): Instante {
    return this.#inicio;
  }

  get fin(): Instante {
    return this.#fin;
  }

  get duracionMinutos(): number {
    return this.#inicio.minutosHasta(this.#fin);
  }

  /**
   * Dos franjas se traslapan si comparten algún instante con duración mayor que cero:
   * un turno que termina a las 10:00 no traslapa con uno que empieza a las 10:00 (RN-06).
   */
  seTraslapaCon(otra: Franja): boolean {
    return this.#inicio.esAnteriorA(otra.#fin) && otra.#inicio.esAnteriorA(this.#fin);
  }

  contiene(instante: Instante): boolean {
    return !instante.esAnteriorA(this.#inicio) && instante.esAnteriorA(this.#fin);
  }

  contieneFranja(otra: Franja): boolean {
    return !otra.#inicio.esAnteriorA(this.#inicio) && !otra.#fin.esPosteriorA(this.#fin);
  }

  /** Verdadero si la franja completa queda cubierta por las otras, aunque sean varias contiguas (RN-15). */
  estaCubiertaPor(franjas: readonly Franja[]): boolean {
    return Franja.fusionar(franjas).some((f) => f.contieneFranja(this));
  }

  esIgualA(otra: Franja): boolean {
    return this.#inicio.esIgualA(otra.#inicio) && this.#fin.esIgualA(otra.#fin);
  }

  toString(): string {
    return `[${this.#inicio.aISO()}, ${this.#fin.aISO()})`;
  }
}
