/** Estados de un turno (docs/10-comportamiento.md, 10.5). */
export const ESTADOS_TURNO = [
  "PENDIENTE_ACEPTACION",
  "ASIGNADO",
  "EN_CURSO",
  "CUBIERTO",
  "NO_CUBIERTO",
  "MARCA_INCOMPLETA",
  "VACANTE",
  "DESCARTADO"
] as const;

export type EstadoTurno = (typeof ESTADOS_TURNO)[number];

export function esEstadoDeTurno(valor: string): valor is EstadoTurno {
  return (ESTADOS_TURNO as readonly string[]).includes(valor);
}

/**
 * Un turno ocupa su franja —cuenta para el traslape (RN-06, RN-09) y para el tope semanal (RN-07)—
 * en todos sus estados salvo VACANTE (ya no tiene responsable) y DESCARTADO (el asistente lo rechazó).
 */
export function ocupaLaFranja(estado: EstadoTurno): boolean {
  return estado !== "VACANTE" && estado !== "DESCARTADO";
}

/** Abren el laboratorio para reservas solo los turnos asignados o en curso (RN-15). */
export function abreElLaboratorio(estado: EstadoTurno): boolean {
  return estado === "ASIGNADO" || estado === "EN_CURSO";
}
