/** Estados de una reserva (docs/10-comportamiento.md, 10.5). */
export const ESTADOS_RESERVA = [
  "ACTIVA",
  "EN_USO",
  "FINALIZADA",
  "LIBERADA",
  "CANCELADA_POR_ESTUDIANTE",
  "CANCELADA_POR_SISTEMA"
] as const;

export type EstadoReserva = (typeof ESTADOS_RESERVA)[number];

export function esEstadoDeReserva(valor: string): valor is EstadoReserva {
  return (ESTADOS_RESERVA as readonly string[]).includes(valor);
}

/** RN-17: una reserva está activa —y ocupa su máquina— mientras está ACTIVA o EN_USO. */
export function estaActiva(estado: EstadoReserva): boolean {
  return estado === "ACTIVA" || estado === "EN_USO";
}

/**
 * SUP-15: para las 6 horas semanales cuentan las activas, en uso, finalizadas y liberadas por
 * no presentación; las canceladas (por el estudiante o por el sistema) no cuentan.
 */
export function cuentaParaElLimiteSemanal(estado: EstadoReserva): boolean {
  return estado === "ACTIVA" || estado === "EN_USO" || estado === "FINALIZADA" || estado === "LIBERADA";
}
