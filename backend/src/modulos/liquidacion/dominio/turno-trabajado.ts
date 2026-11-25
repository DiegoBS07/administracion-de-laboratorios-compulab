import { DatoInvalido, type Fecha, Franja, Hora, type Instante } from "../../../compartido/dominio/index.js";

const INICIO_NOCTURNO = Hora.de(18);

export interface DatosTurnoTrabajado {
  idTurno: string;
  idAsistente: string;
  inicioProgramado: Instante;
  finProgramado: Instante;
  entrada: Instante | null;
  salida: Instante | null;
}

/**
 * Un turno con sus marcas, tal como lo entrega el módulo asistencia (puerto HorasTrabajadas).
 * Invariantes: la franja programada es válida; no hay salida sin entrada; la salida es posterior a la entrada.
 */
export class TurnoTrabajado {
  readonly #idTurno: string;
  readonly #idAsistente: string;
  readonly #programado: Franja;
  readonly #entrada: Instante | null;
  readonly #salida: Instante | null;

  private constructor(datos: DatosTurnoTrabajado, programado: Franja) {
    this.#idTurno = datos.idTurno;
    this.#idAsistente = datos.idAsistente;
    this.#programado = programado;
    this.#entrada = datos.entrada;
    this.#salida = datos.salida;
  }

  static de(datos: DatosTurnoTrabajado): TurnoTrabajado {
    if (!datos.idTurno?.trim() || !datos.idAsistente?.trim()) {
      throw new DatoInvalido("turno", datos.idTurno, "El turno trabajado necesita su identificador y el del asistente.");
    }
    if (datos.salida && !datos.entrada) {
      throw new DatoInvalido("salida", datos.salida.aISO(), "No puede haber salida sin entrada.");
    }
    if (datos.entrada && datos.salida && !datos.entrada.esAnteriorA(datos.salida)) {
      throw new DatoInvalido("salida", datos.salida.aISO(), "La salida debe ser posterior a la entrada.");
    }
    return new TurnoTrabajado(datos, Franja.de(datos.inicioProgramado, datos.finProgramado));
  }

  get idTurno(): string {
    return this.#idTurno;
  }

  get idAsistente(): string {
    return this.#idAsistente;
  }

  get programado(): Franja {
    return this.#programado;
  }

  get fecha(): Fecha {
    return this.#programado.inicio.fecha;
  }

  /**
   * RN-23, SUP-06: llevan recargo los turnos que empiezan (según lo programado) a las 18:00 o
   * después, y los de sábado o domingo. Un solo recargo, aunque se cumplan las dos cosas.
   */
  llevaRecargo(): boolean {
    return this.fecha.esFinDeSemana() || !this.#programado.inicio.hora.esAnteriorA(INICIO_NOCTURNO);
  }

  /**
   * RN-12, SUP-07: minutos trabajados = intersección entre [entrada, salida] y la franja programada.
   * Sin entrada (turno no cubierto) o sin salida (marca incompleta) no hay minutos pagables.
   */
  minutosTrabajados(): number {
    if (!this.#entrada || !this.#salida) return 0;
    return interseccion(this.#entrada, this.#salida, this.#programado);
  }

  /** SUP-08: con entrada y sin salida, los minutos desde la entrada hasta el fin programado no se pagan. */
  minutosConMarcaIncompleta(): number {
    if (!this.#entrada || this.#salida) return 0;
    return interseccion(this.#entrada, this.#programado.fin, this.#programado);
  }
}

function interseccion(desde: Instante, hasta: Instante, franja: Franja): number {
  const inicio = desde.esPosteriorA(franja.inicio) ? desde : franja.inicio;
  const fin = hasta.esAnteriorA(franja.fin) ? hasta : franja.fin;
  return Math.max(0, inicio.minutosHasta(fin));
}
