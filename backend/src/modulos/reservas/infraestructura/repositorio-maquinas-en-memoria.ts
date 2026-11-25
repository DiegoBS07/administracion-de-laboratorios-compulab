import type { RepositorioMaquinas } from "../aplicacion/puertos.js";
import type { Maquina } from "../dominio/maquina.js";

/** Catálogo de máquinas en memoria: lo usa el núcleo ejecutable (sin PostgreSQL) y las pruebas. */
export class RepositorioMaquinasEnMemoria implements RepositorioMaquinas {
  readonly #maquinas: readonly Maquina[];

  constructor(maquinas: readonly Maquina[]) {
    this.#maquinas = maquinas;
  }

  async porId(idMaquina: string): Promise<Maquina | null> {
    return this.#maquinas.find((m) => m.id === idMaquina) ?? null;
  }

  async delLaboratorio(idLaboratorio: string): Promise<Maquina[]> {
    return this.#maquinas.filter((m) => m.idLaboratorio === idLaboratorio);
  }
}
