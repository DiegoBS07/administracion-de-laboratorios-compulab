/** Un aviso registrado por el Notificador del núcleo. */
export interface Aviso {
  destinatario: string;
  tipo: string;
  datos: Record<string, string>;
  registradoEn: string;
}

/**
 * Adaptador del puerto Notificador para el núcleo ejecutable (docs/08-componentes.md, 8.2):
 * "solo aviso en la app". Guarda los avisos en memoria; el correo real queda fuera del núcleo.
 */
export class BandejaDeAvisos {
  readonly #avisos: Aviso[] = [];
  readonly #ahora: () => string;

  constructor(ahora: () => string = () => new Date().toISOString()) {
    this.#ahora = ahora;
  }

  async avisar(destinatario: string, tipo: string, datos: Record<string, string>): Promise<void> {
    this.#avisos.push({ destinatario, tipo, datos: { ...datos }, registradoEn: this.#ahora() });
  }

  /** Avisos de un destinatario, del más reciente al más antiguo. */
  de(destinatario: string): Aviso[] {
    return this.#avisos.filter((a) => a.destinatario === destinatario).reverse();
  }

  get todos(): readonly Aviso[] {
    return [...this.#avisos];
  }
}
