/**
 * Base de todos los errores de dominio (docs/07-arquitectura.md, 7.8 "Errores").
 * Cada regla que falla lanza un error con nombre propio y un código estable que la capa HTTP
 * traduce a su respuesta (docs/08-componentes.md, 8.7). Nunca se responde 500 por una regla.
 */
export abstract class ErrorDeDominio extends Error {
  /** Código estable del contrato de la API, por ejemplo "TOPE_SEMANAL_EXCEDIDO". */
  readonly codigo: string;
  /** Datos para que quien llama arme un mensaje útil (por ejemplo, el turno en conflicto). */
  readonly detalle: Readonly<Record<string, unknown>>;

  protected constructor(codigo: string, mensaje: string, detalle: Record<string, unknown> = {}) {
    super(mensaje);
    this.name = new.target.name;
    this.codigo = codigo;
    this.detalle = Object.freeze({ ...detalle });
  }
}

/** Un dato con formato o valor imposible (fecha que no existe, hora "25:00", monto negativo…). */
export class DatoInvalido extends ErrorDeDominio {
  constructor(campo: string, valor: unknown, mensaje: string) {
    super("SOLICITUD_INVALIDA", mensaje, { campo, valor });
  }
}

/** Una franja cuyo inicio no es anterior a su fin. Cada módulo la traduce a su error propio. */
export class FranjaInvalida extends ErrorDeDominio {
  constructor(inicio: string, fin: string) {
    super("FRANJA_INVALIDA", "El inicio de la franja debe ser anterior a su fin.", { inicio, fin });
  }
}
