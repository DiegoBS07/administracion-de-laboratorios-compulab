import { DatoInvalido, type Franja, type Instante } from "../../../compartido/dominio/index.js";
import { cuentaParaElLimiteSemanal, esEstadoDeReserva, estaActiva, type EstadoReserva } from "./estado-reserva.js";
import { FranjaDeReservaInvalida, FueraDeHorizonteDeReserva, ReservaExcedeDuracion } from "./errores.js";
import { POLITICA_DE_RESERVAS } from "./politica-de-reservas.js";

export interface DatosDeReserva {
  id: string;
  idEstudiante: string;
  idMaquina: string;
  franja: Franja;
  estado: EstadoReserva;
  /** Clave de la solicitud que la creó (ADR-0010); null en reservas creadas por otros caminos. */
  claveSolicitud: string | null;
}

export interface SolicitudDeReserva {
  id: string;
  idEstudiante: string;
  idMaquina: string;
  franja: Franja;
  claveSolicitud: string;
  /** Hora oficial al momento de reservar (puerto Reloj). */
  ahora: Instante;
}

/**
 * Reserva de una máquina por un estudiante (CU-11).
 * Invariantes al crearla (RN-16): empieza en el futuro, dura como máximo 2 horas y su día está
 * entre hoy y los 6 días siguientes. Al reconstituirla: identificadores no vacíos y estado válido.
 */
export class Reserva {
  readonly #id: string;
  readonly #idEstudiante: string;
  readonly #idMaquina: string;
  readonly #franja: Franja;
  readonly #estado: EstadoReserva;
  readonly #claveSolicitud: string | null;

  private constructor(datos: DatosDeReserva) {
    this.#id = datos.id;
    this.#idEstudiante = datos.idEstudiante;
    this.#idMaquina = datos.idMaquina;
    this.#franja = datos.franja;
    this.#estado = datos.estado;
    this.#claveSolicitud = datos.claveSolicitud;
  }

  /** CU-11 paso 4: crea una reserva ACTIVA (P1, P2, P5, P7). Lanza ext 4a, 4b o 4c. */
  static crear(solicitud: SolicitudDeReserva): Reserva {
    const { franja, ahora } = solicitud;
    exigirTexto("claveSolicitud", solicitud.claveSolicitud);
    if (!ahora.esAnteriorA(franja.inicio)) {
      throw new FranjaDeReservaInvalida(franja.inicio.aISO(), franja.fin.aISO(), "INICIO_EN_EL_PASADO");
    }
    const fechaMaxima = ahora.fecha.sumarDias(POLITICA_DE_RESERVAS.diasDeAnticipacion);
    if (franja.inicio.fecha.esPosteriorA(fechaMaxima)) {
      throw new FueraDeHorizonteDeReserva(franja.inicio.aISO(), fechaMaxima.aTexto());
    }
    if (franja.duracionMinutos > POLITICA_DE_RESERVAS.duracionMaximaMinutos) {
      throw new ReservaExcedeDuracion(franja.duracionMinutos, POLITICA_DE_RESERVAS.duracionMaximaMinutos);
    }
    return Reserva.reconstituir({
      id: solicitud.id,
      idEstudiante: solicitud.idEstudiante,
      idMaquina: solicitud.idMaquina,
      franja,
      estado: "ACTIVA",
      claveSolicitud: solicitud.claveSolicitud
    });
  }

  /** Reconstruye una reserva guardada (lo usan los repositorios). */
  static reconstituir(datos: DatosDeReserva): Reserva {
    exigirTexto("id", datos.id);
    exigirTexto("idEstudiante", datos.idEstudiante);
    exigirTexto("idMaquina", datos.idMaquina);
    if (!esEstadoDeReserva(datos.estado)) {
      throw new DatoInvalido("estado", datos.estado, "El estado de la reserva no es válido.");
    }
    return new Reserva(datos);
  }

  get id(): string {
    return this.#id;
  }

  get idEstudiante(): string {
    return this.#idEstudiante;
  }

  get idMaquina(): string {
    return this.#idMaquina;
  }

  get franja(): Franja {
    return this.#franja;
  }

  get estado(): EstadoReserva {
    return this.#estado;
  }

  get claveSolicitud(): string | null {
    return this.#claveSolicitud;
  }

  get duracionMinutos(): number {
    return this.#franja.duracionMinutos;
  }

  /** P6 · Hora límite para presentarse: inicio + 15 minutos (RN-18). */
  get limitePresentacion(): Instante {
    return this.#franja.inicio.sumarMinutos(POLITICA_DE_RESERVAS.toleranciaPresentacionMinutos);
  }

  estaActiva(): boolean {
    return estaActiva(this.#estado);
  }

  cuentaParaElLimiteSemanal(): boolean {
    return cuentaParaElLimiteSemanal(this.#estado);
  }

  /** Verdadero si está activa y se traslapa con la franja: la máquina no está libre (ext 5b). */
  chocaCon(franja: Franja): boolean {
    return this.estaActiva() && this.#franja.seTraslapaCon(franja);
  }

  fueCreadaCon(idEstudiante: string, claveSolicitud: string): boolean {
    return this.#idEstudiante === idEstudiante && this.#claveSolicitud === claveSolicitud;
  }
}

function exigirTexto(campo: string, valor: string | null | undefined): void {
  if (typeof valor !== "string" || valor.trim() === "") {
    throw new DatoInvalido(campo, valor, `El campo ${campo} no puede venir vacío.`);
  }
}
