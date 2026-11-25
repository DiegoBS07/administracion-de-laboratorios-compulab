/**
 * Límites de uso de máquinas (docs/02-requerimientos.md, RN-16 a RN-18; SUP-15).
 * Viven juntos aquí para que cambiar uno toque un solo archivo (guía de cambios, 7.10).
 */
export const POLITICA_DE_RESERVAS = Object.freeze({
  /** RN-16: una reserva dura como máximo 2 horas. */
  duracionMaximaMinutos: 120,
  /** RN-17: como máximo 6 horas reservadas por semana. */
  limiteSemanalMinutos: 360,
  /** RN-16, SUP-15: se reserva para hoy o para alguno de los 6 días siguientes (7 días contando hoy). */
  diasDeAnticipacion: 6,
  /** RN-18: tolerancia para presentarse antes de que la reserva se libere. */
  toleranciaPresentacionMinutos: 15
});
