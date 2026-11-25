// Tipos de las tablas para Kysely. Reflejan database/migrations/ (Flyway es la única fuente del
// esquema): si cambia una migración, se cambia aquí. timestamptz se lee como Date y se escribe en
// ISO-8601 con zona; date y time se leen como texto; bigint se lee como number (ver conexion.ts).
import type { ColumnType, Generated } from "kysely";

type Instante = ColumnType<Date, string, string>;
type SoloLectura<T> = ColumnType<T, never, never>;

export interface TablaLaboratorios {
  id: string;
  nombre: string;
  campus: string;
}

export interface TablaMaquinas {
  id: string;
  id_laboratorio: string;
  codigo: string;
  en_servicio: boolean;
}

export interface TablaAsistentes {
  id: string;
  nombre: string;
  carne: string;
  categoria: string;
  activo: boolean;
}

export interface TablaAsistentesLaboratorios {
  id_asistente: string;
  id_laboratorio: string;
}

export interface TablaTopesAsistentes {
  id_asistente: string;
  vigente_desde: string;
  minutos_por_semana: number;
}

export interface TablaDisponibilidadAsistentes {
  id_asistente: string;
  dia: number;
  hora_inicio: string;
  hora_fin: string;
}

export interface TablaSemestres {
  id: string;
  inicio: string;
  fin: string;
}

export interface TablaVigenciasTarifas {
  vigente_desde: string;
  vigente_hasta: string | null;
  porcentaje_recargo: number;
}

export interface TablaTarifasPorCategoria {
  vigente_desde: string;
  categoria: string;
  centimos_por_hora: number;
}

export interface TablaRolesUsuarios {
  id_usuario: string;
  rol: string;
  id_laboratorio: string | null;
}

export interface TablaTurnos {
  id: string;
  id_laboratorio: string;
  id_asistente: string | null;
  inicio: Instante;
  fin: Instante;
  franja: SoloLectura<string>;
  estado: string;
  creado_por: string | null;
  clave_solicitud: string | null;
}

export interface TablaMarcas {
  id_turno: string;
  entrada: Instante;
  salida: ColumnType<Date | null, string | null, string | null>;
}

export interface TablaReservas {
  id: string;
  id_estudiante: string;
  id_maquina: string;
  inicio: Instante;
  fin: Instante;
  franja: SoloLectura<string>;
  estado: string;
  clave_solicitud: string | null;
}

export interface TablaCierres {
  anio: number;
  mes: number;
  fecha_de_cierre: Instante;
  estado: ColumnType<string, string | undefined, never>;
  archivo_nombre: string;
  archivo_contenido: string;
}

export interface TablaTarifasAplicadas {
  anio: number;
  mes: number;
  vigente_desde: string;
  vigente_hasta: string | null;
  tarifa_por_hora: ColumnType<Record<string, number>, string, never>;
  porcentaje_recargo: number;
}

export interface TablaLineasLiquidacion {
  anio: number;
  mes: number;
  id_asistente: string;
  carne: string;
  nombre: string;
  categoria: string;
  minutos_normales: number;
  minutos_con_recargo: number;
  monto_centimos: number;
}

export interface TablaHorasNoPagadas {
  anio: number;
  mes: number;
  id_asistente: string;
  semana: string;
  motivo: string;
  minutos: number;
}

export interface TablaSesiones {
  huella_token: string;
  id_usuario: string;
  nombre: string;
  roles: ColumnType<{ rol: string; idLaboratorio?: string }[], string, never>;
  vence_en: Instante;
}

export interface TablaAvisos {
  id: Generated<number>;
  destinatario: string;
  tipo: string;
  datos: ColumnType<Record<string, string>, string, never>;
  registrado_en: ColumnType<Date, string | undefined, never>;
}

export interface BaseDeDatos {
  laboratorios: TablaLaboratorios;
  maquinas: TablaMaquinas;
  asistentes: TablaAsistentes;
  asistentes_laboratorios: TablaAsistentesLaboratorios;
  topes_asistentes: TablaTopesAsistentes;
  disponibilidad_asistentes: TablaDisponibilidadAsistentes;
  semestres: TablaSemestres;
  vigencias_tarifas: TablaVigenciasTarifas;
  tarifas_por_categoria: TablaTarifasPorCategoria;
  roles_usuarios: TablaRolesUsuarios;
  turnos: TablaTurnos;
  marcas: TablaMarcas;
  reservas: TablaReservas;
  cierres: TablaCierres;
  tarifas_aplicadas: TablaTarifasAplicadas;
  lineas_liquidacion: TablaLineasLiquidacion;
  horas_no_pagadas: TablaHorasNoPagadas;
  sesiones: TablaSesiones;
  avisos: TablaAvisos;
}
