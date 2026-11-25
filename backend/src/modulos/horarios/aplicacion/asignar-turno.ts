import { DatoInvalido, Fecha, Franja, FranjaInvalida, Hora, type Reloj, Semana } from "../../../compartido/dominio/index.js";
import { AgendaDelAsistente } from "../dominio/agenda-del-asistente.js";
import { AgendaDelLaboratorio } from "../dominio/agenda-del-laboratorio.js";
import { Disponibilidad } from "../dominio/disponibilidad.js";
import type { EstadoTurno } from "../dominio/estado-turno.js";
import { FranjaDeTurnoInvalida, FueraDelSemestre, TurnoEnElPasado } from "../dominio/errores.js";
import { Turno } from "../dominio/turno.js";
import { AsistenteNoExiste, ClaveDeSolicitudReutilizada, SinPermisoSobreLaboratorio } from "./errores.js";
import type {
  AsistenteParaHorario,
  Autorizacion,
  CalendarioAcademico,
  ConsultaAsistentes,
  GeneradorDeIds,
  Notificador,
  RepositorioTurnos,
  UnidadDeTrabajo,
  UsuarioActual
} from "./puertos.js";

/** Lo que manda la interfaz (cuerpo de POST /api/v1/laboratorios/{id}/turnos + Idempotency-Key). */
export interface SolicitudAsignarTurno {
  idLaboratorio: string;
  idAsistente: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  claveSolicitud: string;
}

/** Respuesta de la API para CU-06 (docs/08-componentes.md, 8.7). */
export interface TurnoAsignadoDTO {
  id: string;
  idLaboratorio: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  estado: EstadoTurno;
  asistente: { id: string; nombre: string };
  minutosSemanaAsistente: number;
  topeSemanalMinutos: number;
}

export interface ResultadoAsignarTurno {
  /** false cuando es un reenvío con la misma clave (la API responde 200 en lugar de 201). */
  creado: boolean;
  turno: TurnoAsignadoDTO;
}

export interface DependenciasAsignarTurno {
  autorizacion: Autorizacion;
  calendario: CalendarioAcademico;
  asistentes: ConsultaAsistentes;
  turnos: RepositorioTurnos;
  unidadDeTrabajo: UnidadDeTrabajo;
  notificador: Notificador;
  reloj: Reloj;
  ids: GeneradorDeIds;
}

/**
 * CU-06 · Asignar un turno a un asistente (docs/04-casos-de-uso.md, 4.2; realización en 10.2).
 * Controlador del caso de uso: coordina; las reglas viven en el dominio.
 */
export class AsignarTurno {
  readonly #d: DependenciasAsignarTurno;

  constructor(dependencias: DependenciasAsignarTurno) {
    this.#d = dependencias;
  }

  async ejecutar(usuario: UsuarioActual, solicitud: SolicitudAsignarTurno): Promise<ResultadoAsignarTurno> {
    // paso 1 · el coordinador indica laboratorio, asistente, fecha y horas
    const fecha = Fecha.desdeTexto(solicitud.fecha);
    const horaInicio = Hora.desdeTexto(solicitud.horaInicio);
    const horaFin = Hora.desdeTexto(solicitud.horaFin);
    if (!solicitud.claveSolicitud?.trim()) {
      throw new DatoInvalido("claveSolicitud", solicitud.claveSolicitud, "Falta la clave de solicitud (Idempotency-Key).");
    }

    // paso 2 · ext 2a
    if (!(await this.#d.autorizacion.puedeModificarHorario(usuario, solicitud.idLaboratorio))) {
      throw new SinPermisoSobreLaboratorio(usuario.id, solicitud.idLaboratorio);
    }

    return this.#d.unidadDeTrabajo.ejecutar(async () => {
      // ext 5b · reenvío con la misma clave (ADR-0010)
      const previo = await this.#d.turnos.porClaveDeSolicitud(usuario.id, solicitud.claveSolicitud);
      if (previo) {
        return this.#reenvio(previo, solicitud, fecha, horaInicio, horaFin);
      }

      // paso 3 · franja válida (ext 3a), dentro del semestre (ext 3b), en el futuro (ext 3c)
      const franja = franjaDelTurno(fecha, horaInicio, horaFin);
      const semestre = await this.#d.calendario.semestreVigente();
      if (!semestre || fecha.esAnteriorA(semestre.inicio) || fecha.esPosteriorA(semestre.fin)) {
        throw new FueraDelSemestre(fecha.aTexto(), semestre?.inicio.aTexto() ?? null, semestre?.fin.aTexto() ?? null);
      }
      const ahora = this.#d.reloj.ahora();
      if (!ahora.esAnteriorA(franja.inicio)) {
        throw new TurnoEnElPasado(franja.inicio.aISO(), ahora.aISO());
      }
      const asistente = await this.#d.asistentes.obtener(solicitud.idAsistente);
      if (!asistente) {
        throw new AsistenteNoExiste(solicitud.idAsistente);
      }

      // paso 4 · agenda bloqueada (ext 5a, ADR-0009); activo (3d), traslape (4a), tope (4c), disponibilidad (4d)
      await this.#d.turnos.bloquearAgendaDe(asistente.id);
      const agenda = await this.#agendaDe(asistente, fecha);
      const { dentroDeDisponibilidad } = agenda.evaluar(franja);
      const turnosDelDia = await this.#d.turnos.delLaboratorioEntre(solicitud.idLaboratorio, diaCompleto(fecha));
      AgendaDelLaboratorio.de(solicitud.idLaboratorio, turnosDelDia).verificarLibre(franja); // ext 4b

      // paso 5 · se registra el turno (P1–P5, P7) y, si quedó pendiente, se avisa al asistente (P6)
      const turno = Turno.asignar({
        id: this.#d.ids.nuevo(),
        idLaboratorio: solicitud.idLaboratorio,
        idAsistente: asistente.id,
        franja,
        dentroDeDisponibilidad,
        creadoPor: usuario.id,
        claveSolicitud: solicitud.claveSolicitud
      });
      await this.#d.turnos.guardar(turno);
      if (turno.estado === "PENDIENTE_ACEPTACION") {
        await this.#d.notificador.avisar(asistente.id, "TURNO_PENDIENTE_ACEPTACION", {
          idTurno: turno.id,
          idLaboratorio: turno.idLaboratorio,
          fecha: turno.fecha.aTexto(),
          horaInicio: turno.horaInicio.aTexto(),
          horaFin: turno.horaFin.aTexto()
        });
      }

      // paso 6 · el turno con las horas semanales del asistente actualizadas
      return { creado: true, turno: aDTO(turno, asistente, agenda.minutosProgramados + turno.duracionMinutos) };
    });
  }

  async #agendaDe(asistente: AsistenteParaHorario, fecha: Fecha): Promise<AgendaDelAsistente> {
    const semana = Semana.deLaFecha(fecha);
    return AgendaDelAsistente.de({
      idAsistente: asistente.id,
      activo: asistente.activo,
      topeSemanalMinutos: asistente.topeSemanalMinutos,
      disponibilidad: Disponibilidad.de(asistente.disponibilidad),
      semana,
      turnos: await this.#d.turnos.delAsistenteEntre(asistente.id, semana.franja())
    });
  }

  async #reenvio(previo: Turno, solicitud: SolicitudAsignarTurno, fecha: Fecha, horaInicio: Hora, horaFin: Hora): Promise<ResultadoAsignarTurno> {
    const mismaFranja = horaInicio.esAnteriorA(horaFin) && previo.franja.esIgualA(Franja.delDia(fecha, horaInicio, horaFin));
    if (previo.idLaboratorio !== solicitud.idLaboratorio || previo.idAsistente !== solicitud.idAsistente || !mismaFranja) {
      throw new ClaveDeSolicitudReutilizada(solicitud.claveSolicitud);
    }
    const asistente = await this.#d.asistentes.obtener(solicitud.idAsistente);
    if (!asistente) {
      throw new AsistenteNoExiste(solicitud.idAsistente);
    }
    const agenda = await this.#agendaDe(asistente, fecha);
    return { creado: false, turno: aDTO(previo, asistente, agenda.minutosProgramados) };
  }
}

function franjaDelTurno(fecha: Fecha, horaInicio: Hora, horaFin: Hora): Franja {
  try {
    return Franja.delDia(fecha, horaInicio, horaFin);
  } catch (error) {
    if (error instanceof FranjaInvalida) {
      throw new FranjaDeTurnoInvalida(fecha.aTexto(), horaInicio.aTexto(), horaFin.aTexto());
    }
    throw error;
  }
}

function diaCompleto(fecha: Fecha): Franja {
  return Franja.delDia(fecha, Hora.medianoche(), Hora.deMinutos(Hora.MINUTOS_DEL_DIA));
}

function aDTO(turno: Turno, asistente: AsistenteParaHorario, minutosSemana: number): TurnoAsignadoDTO {
  return {
    id: turno.id,
    idLaboratorio: turno.idLaboratorio,
    fecha: turno.fecha.aTexto(),
    horaInicio: turno.horaInicio.aTexto(),
    horaFin: turno.horaFin.aTexto(),
    estado: turno.estado,
    asistente: { id: asistente.id, nombre: asistente.nombre },
    minutosSemanaAsistente: minutosSemana,
    topeSemanalMinutos: asistente.topeSemanalMinutos
  };
}
