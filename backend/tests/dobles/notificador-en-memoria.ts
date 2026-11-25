/** Aviso registrado por el doble del puerto Notificador. */
export interface AvisoRegistrado {
  destinatario: string;
  tipo: string;
  datos: Record<string, string>;
}

/** Doble del puerto Notificador (docs/08-componentes.md, 8.3): guarda los avisos en memoria. */
export class NotificadorEnMemoria {
  readonly avisos: AvisoRegistrado[] = [];

  async avisar(destinatario: string, tipo: string, datos: Record<string, string>): Promise<void> {
    this.avisos.push({ destinatario, tipo, datos });
  }
}

/** Doble de GeneradorDeIds: identificadores predecibles ("t-1", "t-2"…). */
export class GeneradorDeIdsSecuencial {
  #siguiente = 1;

  constructor(private readonly prefijo: string) {}

  nuevo(): string {
    const id = `${this.prefijo}-${this.#siguiente}`;
    this.#siguiente += 1;
    return id;
  }
}
