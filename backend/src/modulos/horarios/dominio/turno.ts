import { DatoInvalido, type Fecha, type Franja, Hora } from "../../../compartido/dominio/index.js";
import { abreElLaboratorio, esEstadoDeTurno, type EstadoTurno, ocupaLaFranja } from "./estado-turno.js";

const MINUTOS_DEL_DIA = 1440;

export interface DatosDeTurno {
  id: string;
  idLaboratorio: string;
  /** null solo cuando el turno está VACANTE (SUP-01). */
  idAsistente: string | null;
  franja: Franja;
  estado: EstadoTurno;
  /** Usuario que lo creó y clave de su solicitud (ADR-0010); null en turnos creados por otros caminos. */
  creadoPor: string | null;
  claveSolicitud: string | null;
}

export interface SolicitudDeAsignacion {
  id: string;
  idLaboratorio: string;
  idAsistente: string;
  franja: Franja;
  dentroDeDisponibilidad: boolean;
  creadoPor: string;
  claveSolicitud: string;
}

/**
 * Turno: un laboratorio, una franja de un solo día y exactamente un responsable (RN-05).
 * Invariantes verificadas al crear:
 * - identificadores no vacíos;
 * - la franja empieza y termina el mismo día (SUP-21), con fin a las 24:00 como máximo;
 * - exactamente un asistente responsable, salvo si está VACANTE (I4, SUP-01).
 */
export class Turno {
  readonly #id: string;
  readonly #idLaboratorio: string;
  readonly #idAsistente: string | null;
  readonly #franja: Franja;
  readonly #estado: EstadoTurno;
  readonly #creadoPor: string | null;
  readonly #claveSolicitud: string | null;

  private constructor(datos: DatosDeTurno) {
    this.#id = datos.id;
    this.#idLaboratorio = datos.idLaboratorio;
    this.#idAsistente = datos.idAsistente;
    this.#franja = datos.franja;
    this.#estado = datos.estado;
    this.#creadoPor = datos.creadoPor;
    this.#claveSolicitud = datos.claveSolicitud;
  }

  /**
   * CU-06 paso 5: crea un turno nuevo. Queda ASIGNADO si la franja está dentro de la
   * disponibilidad declarada, o PENDIENTE_ACEPTACION si no (RN-08, ext 4d).
   */
  static asignar(solicitud: SolicitudDeAsignacion): Turno {
    exigirTexto("idAsistente", solicitud.idAsistente);
    exigirTexto("creadoPor", solicitud.creadoPor);
    exigirTexto("claveSolicitud", solicitud.claveSolicitud);
    return Turno.reconstituir({
      id: solicitud.id,
      idLaboratorio: solicitud.idLaboratorio,
      idAsistente: solicitud.idAsistente,
      franja: solicitud.franja,
      estado: solicitud.dentroDeDisponibilidad ? "ASIGNADO" : "PENDIENTE_ACEPTACION",
      creadoPor: solicitud.creadoPor,
      claveSolicitud: solicitud.claveSolicitud
    });
  }

  /** Reconstruye un turno guardado (lo usan los repositorios); verifica las mismas invariantes. */
  static reconstituir(datos: DatosDeTurno): Turno {
    exigirTexto("id", datos.id);
    exigirTexto("idLaboratorio", datos.idLaboratorio);
    if (!esEstadoDeTurno(datos.estado)) {
      throw new DatoInvalido("estado", datos.estado, "El estado del turno no es válido.");
    }
    if (datos.estado === "VACANTE" ? datos.idAsistente !== null : !datos.idAsistente) {
      throw new DatoInvalido(
        "idAsistente",
        datos.idAsistente,
        "Todo turno tiene exactamente un asistente responsable, salvo cuando está vacante."
      );
    }
    const { franja } = datos;
    const terminaElMismoDia = franja.inicio.fecha.esIgualA(franja.fin.sumarMinutos(-1).fecha);
    if (!terminaElMismoDia || franja.duracionMinutos > MINUTOS_DEL_DIA) {
      throw new DatoInvalido("franja", franja.toString(), "Un turno empieza y termina el mismo día.");
    }
    return new Turno(datos);
  }

  get id(): string {
    return this.#id;
  }

  get idLaboratorio(): string {
    return this.#idLaboratorio;
  }

  get idAsistente(): string | null {
    return this.#idAsistente;
  }

  get franja(): Franja {
    return this.#franja;
  }

  get estado(): EstadoTurno {
    return this.#estado;
  }

  get creadoPor(): string | null {
    return this.#creadoPor;
  }

  get claveSolicitud(): string | null {
    return this.#claveSolicitud;
  }

  get fecha(): Fecha {
    return this.#franja.inicio.fecha;
  }

  get horaInicio(): Hora {
    return this.#franja.inicio.hora;
  }

  /** Hora de fin del día del turno; puede ser 24:00. */
  get horaFin(): Hora {
    return Hora.deMinutos(this.#franja.fin.minutosDesdeEpoca - this.fecha.diasDesdeEpoca * MINUTOS_DEL_DIA);
  }

  get duracionMinutos(): number {
    return this.#franja.duracionMinutos;
  }

  /** Cuenta para el traslape y el tope semanal (todos los estados salvo VACANTE y DESCARTADO). */
  ocupaLaFranja(): boolean {
    return ocupaLaFranja(this.#estado);
  }

  abreElLaboratorio(): boolean {
    return abreElLaboratorio(this.#estado);
  }

  /** Verdadero si ocupa su franja y esta se traslapa con la dada. */
  chocaCon(franja: Franja): boolean {
    return this.ocupaLaFranja() && this.#franja.seTraslapaCon(franja);
  }

  fueCreadoCon(idUsuario: string, claveSolicitud: string): boolean {
    return this.#creadoPor === idUsuario && this.#claveSolicitud === claveSolicitud;
  }
}

function exigirTexto(campo: string, valor: string | null | undefined): void {
  if (typeof valor !== "string" || valor.trim() === "") {
    throw new DatoInvalido(campo, valor, `El campo ${campo} no puede venir vacío.`);
  }
}
