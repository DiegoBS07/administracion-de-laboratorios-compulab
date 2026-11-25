import { ErrorDeDominio, type Franja } from "../../../compartido/dominio/index.js";

/** Resumen de un turno para el detalle de un error (qué turno provocó el conflicto). */
export interface TurnoEnConflicto {
  idTurno: string;
  idLaboratorio: string;
  idAsistente: string | null;
  inicio: string;
  fin: string;
}

/** CU-06 ext 3a · La hora de fin no es posterior a la de inicio, o el turno termina otro día (RN-05). */
export class FranjaDeTurnoInvalida extends ErrorDeDominio {
  constructor(fecha: string, horaInicio: string, horaFin: string) {
    super("FRANJA_DE_TURNO_INVALIDA", "El turno debe terminar después de empezar y el mismo día.", { fecha, horaInicio, horaFin });
  }
}

/** CU-06 ext 3b · La fecha está fuera del semestre vigente. */
export class FueraDelSemestre extends ErrorDeDominio {
  constructor(fecha: string, inicioSemestre: string | null, finSemestre: string | null) {
    super("FUERA_DEL_SEMESTRE", "La fecha del turno está fuera del semestre.", { fecha, inicioSemestre, finSemestre });
  }
}

/** CU-06 ext 3c · La franja ya empezó o ya pasó. */
export class TurnoEnElPasado extends ErrorDeDominio {
  constructor(inicio: string, ahora: string) {
    super("TURNO_EN_EL_PASADO", "No se puede asignar un turno que ya empezó o ya pasó.", { inicio, ahora });
  }
}

/** CU-06 ext 3d · El asistente renunció, fue dado de baja o no es de este semestre (RN-04). */
export class AsistenteNoActivo extends ErrorDeDominio {
  constructor(idAsistente: string) {
    super("ASISTENTE_NO_ACTIVO", "El asistente no está activo.", { idAsistente });
  }
}

/** CU-06 ext 4a · El asistente ya tiene un turno que se traslapa, en este u otro laboratorio o campus (RN-06). */
export class TraslapeDeTurno extends ErrorDeDominio {
  constructor(conflicto: TurnoEnConflicto) {
    super("TRASLAPE_DE_TURNO", "El asistente ya tiene un turno que se traslapa con ese horario.", { conflicto });
  }
}

/** CU-06 ext 4b · El laboratorio ya tiene otro turno en esa franja (RN-09). */
export class FranjaOcupadaEnLaboratorio extends ErrorDeDominio {
  constructor(conflicto: TurnoEnConflicto) {
    super("FRANJA_OCUPADA_EN_LABORATORIO", "Ese horario ya tiene responsable en este laboratorio.", { conflicto });
  }
}

/** CU-06 ext 4c · Con este turno el asistente superaría su tope semanal (RN-07). */
export class TopeSemanalExcedido extends ErrorDeDominio {
  constructor(minutosProgramados: number, minutosDelTurno: number, topeSemanalMinutos: number, semana: string) {
    super("TOPE_SEMANAL_EXCEDIDO", "Con este turno el asistente superaría su tope semanal.", {
      minutosProgramados,
      minutosDelTurno,
      topeSemanalMinutos,
      semana
    });
  }
}

export function resumenDeConflicto(turno: { id: string; idLaboratorio: string; idAsistente: string | null; franja: Franja }): TurnoEnConflicto {
  return {
    idTurno: turno.id,
    idLaboratorio: turno.idLaboratorio,
    idAsistente: turno.idAsistente,
    inicio: turno.franja.inicio.aISO(),
    fin: turno.franja.fin.aISO()
  };
}
