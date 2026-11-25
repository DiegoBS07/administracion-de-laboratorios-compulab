import { DatoInvalido } from "./errores.js";
import { Fecha } from "./fecha.js";
import { Hora } from "./hora.js";

const MINUTOS_DEL_DIA = 1440;
/** Costa Rica está en UTC−6 todo el año (no tiene horario de verano). */
const DESFASE_COSTA_RICA_MIN = -360;
const DESFASE_TEXTO = "-06:00";
const PATRON_ISO = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

/**
 * Un momento en la hora oficial de Costa Rica, con precisión de minutos. Inmutable.
 * Invariante: corresponde a una fecha y hora válidas a partir del 1 de enero de 1970.
 * En la API viaja como ISO-8601 con desfase, por ejemplo "2026-11-24T18:00:00-06:00" (7.8).
 */
export class Instante {
  /** Minutos desde 1970-01-01 00:00 en hora de Costa Rica. */
  readonly #minutos: number;

  private constructor(minutos: number) {
    this.#minutos = minutos;
  }

  static de(fecha: Fecha, hora: Hora): Instante {
    return new Instante(fecha.diasDesdeEpoca * MINUTOS_DEL_DIA + hora.minutos);
  }

  static desdeMinutosDesdeEpoca(minutos: number): Instante {
    if (!Number.isSafeInteger(minutos) || minutos < 0) {
      throw new DatoInvalido("instante", minutos, "Los minutos desde 1970 deben ser un entero no negativo.");
    }
    return new Instante(minutos);
  }

  /**
   * Lee un instante ISO-8601 con zona ("Z" o "±HH:MM") y lo lleva a la hora de Costa Rica.
   * Los segundos se descartan: el sistema trabaja con minutos.
   */
  static desdeISO(texto: string): Instante {
    const p = PATRON_ISO.exec(texto);
    if (!p) {
      throw new DatoInvalido("instante", texto, "El instante debe ser ISO-8601 con zona, por ejemplo 2026-11-24T18:00:00-06:00.");
    }
    const fecha = Fecha.de(Number(p[1]), Number(p[2]), Number(p[3]));
    const horas = Number(p[4]);
    const minutos = Number(p[5]);
    if (horas > 23 || minutos > 59 || Number(p[6] ?? 0) > 59) {
      throw new DatoInvalido("instante", texto, "La hora del instante no es válida.");
    }
    const zona = p[7] ?? "Z";
    const desfase = zona === "Z" ? 0 : (zona.startsWith("-") ? -1 : 1) * (Number(zona.slice(1, 3)) * 60 + Number(zona.slice(4, 6)));
    const minutosLocales = fecha.diasDesdeEpoca * MINUTOS_DEL_DIA + horas * 60 + minutos;
    const minutosUTC = minutosLocales - desfase;
    return Instante.desdeMinutosDesdeEpoca(minutosUTC + DESFASE_COSTA_RICA_MIN);
  }

  get minutosDesdeEpoca(): number {
    return this.#minutos;
  }

  get fecha(): Fecha {
    return Fecha.desdeDiasDesdeEpoca(Math.floor(this.#minutos / MINUTOS_DEL_DIA));
  }

  /** Hora del día entre 00:00 y 23:59 (un instante nunca es 24:00: eso ya es el día siguiente). */
  get hora(): Hora {
    return Hora.deMinutos(this.#minutos % MINUTOS_DEL_DIA);
  }

  sumarMinutos(minutos: number): Instante {
    if (!Number.isInteger(minutos)) {
      throw new DatoInvalido("minutos", minutos, "Solo se pueden sumar minutos enteros.");
    }
    return Instante.desdeMinutosDesdeEpoca(this.#minutos + minutos);
  }

  /** Minutos desde este instante hasta otro (negativo si el otro es anterior). */
  minutosHasta(otro: Instante): number {
    return otro.#minutos - this.#minutos;
  }

  comparar(otro: Instante): -1 | 0 | 1 {
    return Math.sign(this.#minutos - otro.#minutos) as -1 | 0 | 1;
  }

  esAnteriorA(otro: Instante): boolean {
    return this.#minutos < otro.#minutos;
  }

  esPosteriorA(otro: Instante): boolean {
    return this.#minutos > otro.#minutos;
  }

  esIgualA(otro: Instante): boolean {
    return this.#minutos === otro.#minutos;
  }

  aISO(): string {
    return `${this.fecha.aTexto()}T${this.hora.aTexto()}:00${DESFASE_TEXTO}`;
  }

  toString(): string {
    return this.aISO();
  }
}
