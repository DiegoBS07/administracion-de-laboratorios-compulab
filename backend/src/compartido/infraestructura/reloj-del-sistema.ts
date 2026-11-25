import { Instante, type Reloj } from "../dominio/index.js";

/**
 * Adaptador del puerto Reloj (docs/08-componentes.md, 8.3): la hora del servidor en Costa Rica.
 * Para demostraciones se le puede dar una hora simulada de arranque (APP_HORA_SIMULADA): desde ahí
 * el tiempo sigue corriendo al ritmo real, así que las reglas de "en el pasado" siguen funcionando.
 */
export class RelojDelSistema implements Reloj {
  readonly #desfaseMs: number;

  constructor(horaSimulada: Instante | null = null) {
    this.#desfaseMs = horaSimulada ? Date.parse(horaSimulada.aISO()) - Date.now() : 0;
  }

  ahora(): Instante {
    return Instante.desdeISO(new Date(Date.now() + this.#desfaseMs).toISOString());
  }
}
