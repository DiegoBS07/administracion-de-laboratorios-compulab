// Interfaces requeridas del módulo horarios (docs/08-componentes.md, 8.3 y 8.4).
// Se declaran aquí, en el idioma de este módulo; las implementa la infraestructura,
// otro módulo conectado en src/arranque/, o un doble en las pruebas.
import type { Fecha, Franja } from "../../../compartido/dominio/index.js";
import type { Turno } from "../dominio/turno.js";

export interface UsuarioActual {
  id: string;
}

export interface RepositorioTurnos {
  /** ADR-0010: el turno que ese usuario ya creó con esa clave, si existe. */
  porClaveDeSolicitud(idUsuario: string, claveSolicitud: string): Promise<Turno | null>;
  /**
   * ADR-0009: desde aquí y hasta que termine la transacción, ninguna otra asignación de ese
   * asistente avanza. Así dos asignaciones simultáneas no pueden pasar juntas el tope (ext 5a).
   */
  bloquearAgendaDe(idAsistente: string): Promise<void>;
  /** Turnos del asistente, de cualquier laboratorio, que tocan la franja. */
  delAsistenteEntre(idAsistente: string, franja: Franja): Promise<Turno[]>;
  /** Turnos del laboratorio que tocan la franja. */
  delLaboratorioEntre(idLaboratorio: string, franja: Franja): Promise<Turno[]>;
  /**
   * Guarda el turno en la transacción en curso. Si al confirmar salta una restricción de la base
   * (segunda barrera de ADR-0009), lanza TraslapeDeTurno o FranjaOcupadaEnLaboratorio.
   */
  guardar(turno: Turno): Promise<void>;
}

/** Todo o nada: lo que el trabajo escribió queda confirmado junto, o nada si lanzó un error (8.3). */
export interface UnidadDeTrabajo {
  ejecutar<T>(trabajo: () => Promise<T>): Promise<T>;
}

export interface BloqueDeDisponibilidadDTO {
  dia: number;
  horaInicio: string;
  horaFin: string;
}

export interface AsistenteParaHorario {
  id: string;
  nombre: string;
  activo: boolean;
  topeSemanalMinutos: number;
  disponibilidad: BloqueDeDisponibilidadDTO[];
}

export interface ConsultaAsistentes {
  obtener(idAsistente: string): Promise<AsistenteParaHorario | null>;
}

export interface CalendarioAcademico {
  semestreVigente(): Promise<{ inicio: Fecha; fin: Fecha } | null>;
}

export interface Autorizacion {
  /**
   * Verdadero si el usuario coordina ese laboratorio o es coordinador de soporte.
   * Un laboratorio inexistente devuelve falso. La implementación registra los intentos
   * denegados en la bitácora de seguridad (QA-7).
   */
  puedeModificarHorario(usuario: UsuarioActual, idLaboratorio: string): Promise<boolean>;
}

export type TipoDeAviso = "TURNO_PENDIENTE_ACEPTACION";

export interface Notificador {
  /** Registra el aviso en la misma transacción; el correo sale después (8.3). */
  avisar(destinatario: string, tipo: TipoDeAviso, datos: Record<string, string>): Promise<void>;
}

export interface GeneradorDeIds {
  nuevo(): string;
}
