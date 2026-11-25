// Interfaces requeridas del módulo reservas (docs/08-componentes.md, 8.5), en el idioma de este módulo.
import type { Franja, Semana } from "../../../compartido/dominio/index.js";
import type { Maquina } from "../dominio/maquina.js";
import type { Reserva } from "../dominio/reserva.js";

export interface UsuarioActual {
  id: string;
}

export interface RepositorioMaquinas {
  porId(idMaquina: string): Promise<Maquina | null>;
  delLaboratorio(idLaboratorio: string): Promise<Maquina[]>;
}

export interface RepositorioReservas {
  /** ADR-0010: la reserva que ese estudiante ya creó con esa clave, si existe. */
  porClaveDeSolicitud(idEstudiante: string, claveSolicitud: string): Promise<Reserva | null>;
  /** Su reserva ACTIVA o EN_USO, de cualquier semana (RN-17). */
  activaDelEstudiante(idEstudiante: string): Promise<Reserva | null>;
  /** Reservas del estudiante que empiezan en esa semana (RN-17). */
  delEstudianteEnSemana(idEstudiante: string, semana: Semana): Promise<Reserva[]>;
  /** Reservas de la máquina que tocan la franja. */
  deMaquinaEntre(idMaquina: string, franja: Franja): Promise<Reserva[]>;
  /**
   * Guarda en la transacción en curso. Segunda barrera de ADR-0009: si al guardar salta la
   * exclusión por máquina lanza MaquinaNoDisponible (ext 7a); si salta el índice de una reserva
   * activa por estudiante lanza YaTieneReservaActiva (ext 7c).
   */
  guardar(reserva: Reserva): Promise<void>;
}

/** Todo o nada (8.3). */
export interface UnidadDeTrabajo {
  ejecutar<T>(trabajo: () => Promise<T>): Promise<T>;
}

/**
 * Franjas en que el laboratorio estará abierto según sus turnos asignados o en curso, ordenadas
 * y con los turnos contiguos ya unidos (contrato en 8.4). Lanza LaboratorioNoExiste de este módulo.
 * La implementa el módulo horarios, conectado en src/arranque/.
 */
export interface CoberturaDeLaboratorio {
  franjasAbiertas(idLaboratorio: string, franja: Franja): Promise<Franja[]>;
}

export interface GeneradorDeIds {
  nuevo(): string;
}
