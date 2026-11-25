import type { UnidadDeTrabajoPostgres } from "./conexion.js";

/**
 * Adaptador del puerto Notificador (8.3) sobre PostgreSQL: registra el aviso en la transacción del
 * caso de uso; si la transacción se revierte, el aviso no existe. El correo queda fuera del núcleo.
 */
export class AvisosPostgres {
  readonly #unidad: UnidadDeTrabajoPostgres;

  constructor(unidad: UnidadDeTrabajoPostgres) {
    this.#unidad = unidad;
  }

  async avisar(destinatario: string, tipo: string, datos: Record<string, string>): Promise<void> {
    await this.#unidad.ejecutor().insertInto("avisos").values({ destinatario, tipo, datos: JSON.stringify(datos) }).execute();
  }
}
