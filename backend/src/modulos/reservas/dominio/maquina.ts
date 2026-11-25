import { DatoInvalido } from "../../../compartido/dominio/index.js";
import { MaquinaFueraDeServicio } from "./errores.js";

export interface DatosDeMaquina {
  id: string;
  idLaboratorio: string;
  /** Identificador visible pegado en la máquina, por ejemplo "C1-04". */
  codigo: string;
  enServicio: boolean;
}

/**
 * Máquina de un laboratorio. Solo se sabe qué máquina es y si está en servicio:
 * el inventario de hardware está fuera del alcance (docs/03-alcance.md, 3.2).
 * Invariantes: identificador, laboratorio y código no vacíos.
 */
export class Maquina {
  readonly #id: string;
  readonly #idLaboratorio: string;
  readonly #codigo: string;
  readonly #enServicio: boolean;

  private constructor(datos: DatosDeMaquina) {
    this.#id = datos.id;
    this.#idLaboratorio = datos.idLaboratorio;
    this.#codigo = datos.codigo;
    this.#enServicio = datos.enServicio;
  }

  static reconstituir(datos: DatosDeMaquina): Maquina {
    for (const campo of ["id", "idLaboratorio", "codigo"] as const) {
      if (!datos[campo]?.trim()) {
        throw new DatoInvalido(campo, datos[campo], `El campo ${campo} de la máquina no puede venir vacío.`);
      }
    }
    return new Maquina(datos);
  }

  get id(): string {
    return this.#id;
  }

  get idLaboratorio(): string {
    return this.#idLaboratorio;
  }

  get codigo(): string {
    return this.#codigo;
  }

  get enServicio(): boolean {
    return this.#enServicio;
  }

  /** CU-11 ext 5a: una máquina fuera de servicio no se puede reservar (RN-20). */
  verificarReservable(): void {
    if (!this.#enServicio) {
      throw new MaquinaFueraDeServicio(this.#id, this.#codigo);
    }
  }
}
