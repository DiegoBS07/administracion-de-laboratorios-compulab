import { DatoInvalido, type Semana } from "../../../compartido/dominio/index.js";
import { LimiteSemanalDeReservaExcedido, YaTieneReservaActiva } from "./errores.js";
import { POLITICA_DE_RESERVAS } from "./politica-de-reservas.js";
import type { Reserva } from "./reserva.js";

export interface DatosCupoSemanal {
  idEstudiante: string;
  semana: Semana;
  /** Reservas del estudiante que empiezan en esa semana. */
  reservasDeLaSemana: readonly Reserva[];
  /** Su reserva activa, de cualquier semana, si la tiene. */
  reservaActiva: Reserva | null;
}

/**
 * Lo que un estudiante puede reservar todavía (RN-17): una reserva activa a la vez y como
 * máximo 6 horas por semana (cuentan activas, en uso, finalizadas y liberadas; SUP-15).
 * Invariante: todas las reservas son del estudiante y las de la semana empiezan en ella.
 */
export class CupoSemanalDelEstudiante {
  readonly #semana: Semana;
  readonly #reservasDeLaSemana: readonly Reserva[];
  readonly #reservaActiva: Reserva | null;

  private constructor(datos: DatosCupoSemanal) {
    this.#semana = datos.semana;
    this.#reservasDeLaSemana = [...datos.reservasDeLaSemana];
    this.#reservaActiva = datos.reservaActiva;
  }

  static de(datos: DatosCupoSemanal): CupoSemanalDelEstudiante {
    const ajena = [...datos.reservasDeLaSemana, ...(datos.reservaActiva ? [datos.reservaActiva] : [])].find(
      (r) => r.idEstudiante !== datos.idEstudiante
    );
    if (ajena) {
      throw new DatoInvalido("reservas", ajena.id, "El cupo solo puede contener reservas del estudiante.");
    }
    const fuera = datos.reservasDeLaSemana.find((r) => !datos.semana.contiene(r.franja.inicio.fecha));
    if (fuera) {
      throw new DatoInvalido("reservas", fuera.id, "Las reservas de la semana deben empezar en esa semana.");
    }
    if (datos.reservaActiva && !datos.reservaActiva.estaActiva()) {
      throw new DatoInvalido("reservaActiva", datos.reservaActiva.id, "La reserva activa debe estar ACTIVA o EN_USO.");
    }
    return new CupoSemanalDelEstudiante(datos);
  }

  get minutosReservados(): number {
    return this.#reservasDeLaSemana.filter((r) => r.cuentaParaElLimiteSemanal()).reduce((total, r) => total + r.duracionMinutos, 0);
  }

  /** CU-11 paso 6: lanza YaTieneReservaActiva (ext 6a) o LimiteSemanalDeReservaExcedido (ext 6b). */
  verificarQueAdmite(nueva: Reserva): void {
    if (this.#reservaActiva) {
      const activa = this.#reservaActiva;
      throw new YaTieneReservaActiva(activa.id, activa.franja.inicio.aISO(), activa.franja.fin.aISO());
    }
    const reservados = this.minutosReservados;
    if (reservados + nueva.duracionMinutos > POLITICA_DE_RESERVAS.limiteSemanalMinutos) {
      throw new LimiteSemanalDeReservaExcedido(
        reservados,
        nueva.duracionMinutos,
        POLITICA_DE_RESERVAS.limiteSemanalMinutos,
        this.#semana.lunes.aTexto()
      );
    }
  }
}
