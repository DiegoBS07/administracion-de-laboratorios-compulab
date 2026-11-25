// Tipos del contrato de la API (docs/08-componentes.md, 8.7). Es el acuerdo con el backend:
// si el contrato cambia, se cambia aquí y TypeScript señala cada pantalla afectada.
// Los enumerados son abiertos (8.7): estado, motivo y codigo pueden recibir valores nuevos.

export type Rol = "ESTUDIANTE" | "ASISTENTE" | "COORDINADOR_LABORATORIO" | "COORDINADOR_SOPORTE";

export interface RolAsignado {
  rol: Rol;
  idLaboratorio?: string;
}

export interface Sesion {
  id: string;
  nombre: string;
  roles: RolAsignado[];
}

export interface UsuarioDeDemostracion {
  usuario: string;
  nombre: string;
  descripcion: string;
}

export interface Laboratorio {
  id: string;
  nombre: string;
  campus: string;
}

export interface Franja {
  inicio: string;
  fin: string;
}

// ---------- CU-06 ----------

export interface TurnoDelHorario {
  id: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  estado: string;
  asistente: { id: string; nombre: string } | null;
}

export interface HorarioSemanal {
  idLaboratorio: string;
  semana: string;
  turnos: TurnoDelHorario[];
}

export interface BloqueDeDisponibilidad {
  dia: number;
  horaInicio: string;
  horaFin: string;
}

export interface AsistenteParaElegir {
  id: string;
  nombre: string;
  categoria: string;
  topeSemanalMinutos: number;
  minutosProgramadosSemana: number;
  disponibilidad: BloqueDeDisponibilidad[];
}

export interface SolicitudDeTurno {
  idAsistente: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
}

export interface TurnoAsignado {
  id: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  estado: string;
  asistente: { id: string; nombre: string };
  minutosSemanaAsistente: number;
  topeSemanalMinutos: number;
}

// ---------- CU-11 ----------

export interface Disponibilidad {
  idLaboratorio: string;
  fecha: string;
  franjasAbiertas: Franja[];
  maquinas: { id: string; codigo: string; estado: string; reservas: Franja[] }[];
}

export interface SolicitudDeReserva {
  idMaquina: string;
  inicio: string;
  fin: string;
}

export interface ReservaCreada {
  id: string;
  idMaquina: string;
  inicio: string;
  fin: string;
  estado: string;
  limitePresentacion: string;
}

export interface ReservaDelEstudiante extends ReservaCreada {
  codigoMaquina: string;
  idLaboratorio: string;
}

export interface MisReservas {
  semana: string;
  minutosReservadosSemana: number;
  limiteSemanalMinutos: number;
  activa: ReservaDelEstudiante | null;
  deLaSemana: ReservaDelEstudiante[];
}

// ---------- CU-14 ----------

export interface MesDelAnio {
  anio: number;
  mes: number;
  estado: string;
}

export interface LineaDelCierre {
  idAsistente: string;
  carne: string;
  nombre: string;
  categoria: string;
  minutosNormales: number;
  minutosConRecargo: number;
  minutosNoPagados: number;
  montoCentimos: number;
  noPagados: { semana: string; motivo: string; minutos: number }[];
}

export interface ResumenDeCierre {
  id: string;
  anio: number;
  mes: number;
  fechaDeCierre: string;
  estado: string;
  moneda: string;
  totalCentimos: number;
  tarifasAplicadas: { vigenteDesde: string; vigenteHasta: string | null; tarifaPorHoraCentimos: Record<string, number>; porcentajeRecargo: number }[];
  lineas: LineaDelCierre[];
}
