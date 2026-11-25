import { ErrorDeDominio } from "../../../compartido/dominio/index.js";

/** CU-11 ext 4a · El fin no es posterior al inicio, o la reserva empieza en el pasado (RN-16). */
export class FranjaDeReservaInvalida extends ErrorDeDominio {
  constructor(inicio: string, fin: string, motivo: "FIN_NO_POSTERIOR" | "INICIO_EN_EL_PASADO") {
    super("FRANJA_DE_RESERVA_INVALIDA", "La reserva debe empezar en el futuro y terminar después de empezar.", { inicio, fin, motivo });
  }
}

/** CU-11 ext 4b · La reserva empieza más allá de los días de anticipación permitidos (RN-16, SUP-15). */
export class FueraDeHorizonteDeReserva extends ErrorDeDominio {
  constructor(inicio: string, fechaMaxima: string) {
    super("FUERA_DE_HORIZONTE_DE_RESERVA", "Solo se puede reservar para hoy o los próximos 6 días.", { inicio, fechaMaxima });
  }
}

/** CU-11 ext 4c · La reserva dura más de 2 horas (RN-16). */
export class ReservaExcedeDuracion extends ErrorDeDominio {
  constructor(minutosSolicitados: number, maximoMinutos: number) {
    super("RESERVA_EXCEDE_DURACION", "Una reserva dura como máximo 2 horas.", { minutosSolicitados, maximoMinutos });
  }
}

/** CU-11 ext 4d · Alguna parte de la franja no está cubierta por un turno asignado (RN-15). */
export class LaboratorioCerradoEnFranja extends ErrorDeDominio {
  constructor(idLaboratorio: string, franjasAbiertas: { inicio: string; fin: string }[]) {
    super("LABORATORIO_CERRADO_EN_FRANJA", "El laboratorio no estará abierto durante todo ese horario.", { idLaboratorio, franjasAbiertas });
  }
}

/** CU-11 ext 5a · La máquina está fuera de servicio (RN-20). */
export class MaquinaFueraDeServicio extends ErrorDeDominio {
  constructor(idMaquina: string, codigo: string) {
    super("MAQUINA_FUERA_DE_SERVICIO", "Esa máquina está fuera de servicio.", { idMaquina, codigo });
  }
}

/** CU-11 ext 5b y 7a · La máquina ya tiene una reserva que se traslapa. */
export class MaquinaNoDisponible extends ErrorDeDominio {
  constructor(idMaquina: string, inicio: string, fin: string) {
    super("MAQUINA_NO_DISPONIBLE", "Esa máquina ya está reservada en ese horario.", { idMaquina, inicio, fin });
  }
}

/** CU-11 ext 6a y 7c · El estudiante ya tiene una reserva activa (RN-17). */
export class YaTieneReservaActiva extends ErrorDeDominio {
  constructor(idReservaActiva: string, inicio: string, fin: string) {
    super("YA_TIENE_RESERVA_ACTIVA", "Ya tienes una reserva activa. Solo se permite una a la vez.", { idReservaActiva, inicio, fin });
  }
}

/** CU-11 ext 6b · Con esta reserva el estudiante superaría 6 horas en la semana (RN-17). */
export class LimiteSemanalDeReservaExcedido extends ErrorDeDominio {
  constructor(minutosReservados: number, minutosDeLaReserva: number, limiteSemanalMinutos: number, semana: string) {
    super("LIMITE_SEMANAL_DE_RESERVA_EXCEDIDO", "Con esta reserva pasarías de 6 horas esta semana.", {
      minutosReservados,
      minutosDeLaReserva,
      limiteSemanalMinutos,
      semana
    });
  }
}
