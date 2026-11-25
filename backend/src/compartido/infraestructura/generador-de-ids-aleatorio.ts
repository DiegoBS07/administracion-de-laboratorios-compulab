import { randomUUID } from "node:crypto";

/** Adaptador de GeneradorDeIds: identificadores UUID v4 con un prefijo legible ("t-…", "r-…"). */
export class GeneradorDeIdsAleatorio {
  readonly #prefijo: string;

  constructor(prefijo: string) {
    this.#prefijo = prefijo;
  }

  nuevo(): string {
    return `${this.#prefijo}-${randomUUID()}`;
  }
}
