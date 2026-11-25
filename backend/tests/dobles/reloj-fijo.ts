import { Instante, type Reloj } from "../../src/compartido/dominio/index.js";

/**
 * Doble del puerto Reloj (docs/08-componentes.md, 8.3): devuelve siempre la hora que se le fija.
 * Permite probar vencimientos, "en el pasado" y cierres de mes sin depender del reloj real.
 */
export class RelojFijo implements Reloj {
  #ahora: Instante;

  constructor(ahora: Instante | string) {
    this.#ahora = typeof ahora === "string" ? Instante.desdeISO(ahora) : ahora;
  }

  ahora(): Instante {
    return this.#ahora;
  }

  avanzarMinutos(minutos: number): void {
    this.#ahora = this.#ahora.sumarMinutos(minutos);
  }

  fijar(ahora: Instante | string): void {
    this.#ahora = typeof ahora === "string" ? Instante.desdeISO(ahora) : ahora;
  }
}
