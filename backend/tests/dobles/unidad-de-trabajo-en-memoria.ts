import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Transacción en memoria: junta lo que se confirma y lo que se libera al terminar.
 * Imita el contrato de UnidadDeTrabajo (docs/08-componentes.md, 8.3): todo o nada, y los
 * bloqueos tomados dentro se liberan al terminar.
 */
export class Transaccion {
  readonly #alConfirmar: (() => void)[] = [];
  readonly #alTerminar: (() => void)[] = [];

  alConfirmar(accion: () => void): void {
    this.#alConfirmar.push(accion);
  }

  alTerminar(accion: () => void): void {
    this.#alTerminar.push(accion);
  }

  confirmar(): void {
    for (const accion of this.#alConfirmar) accion();
  }

  terminar(): void {
    for (const accion of this.#alTerminar) accion();
  }
}

/** Doble de UnidadDeTrabajo: cada ejecución corre en su propia Transaccion, aunque haya varias a la vez. */
export class UnidadDeTrabajoEnMemoria {
  readonly #contexto = new AsyncLocalStorage<Transaccion>();
  #ejecuciones = 0;

  async ejecutar<T>(trabajo: () => Promise<T>): Promise<T> {
    this.#ejecuciones += 1;
    const transaccion = new Transaccion();
    return this.#contexto.run(transaccion, async () => {
      try {
        const resultado = await trabajo();
        transaccion.confirmar();
        return resultado;
      } finally {
        transaccion.terminar();
      }
    });
  }

  /** La transacción en curso; los repositorios en memoria la usan para guardar y bloquear. */
  actual(): Transaccion {
    const transaccion = this.#contexto.getStore();
    if (!transaccion) {
      throw new Error("La operación debe ejecutarse dentro de UnidadDeTrabajo.ejecutar().");
    }
    return transaccion;
  }

  get ejecuciones(): number {
    return this.#ejecuciones;
  }
}

/** Cerrojos por clave: quien llega segundo espera a que el primero libere (como SELECT … FOR UPDATE). */
export class Cerrojos {
  readonly #colas = new Map<string, Promise<void>>();

  async adquirir(clave: string): Promise<() => void> {
    const anterior = this.#colas.get(clave) ?? Promise.resolve();
    let liberar!: () => void;
    const propio = new Promise<void>((resolver) => {
      liberar = resolver;
    });
    this.#colas.set(clave, anterior.then(() => propio));
    await anterior;
    return liberar;
  }
}
