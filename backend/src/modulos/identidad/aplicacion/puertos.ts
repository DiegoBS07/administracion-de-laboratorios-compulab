// Interfaces requeridas del módulo identidad (docs/08-componentes.md, 8.3 y ADR-0008).
import type { RolAsignado } from "../dominio/sesion.js";
import type { Sesion } from "../dominio/sesion.js";

/** Identidad traducida al vocabulario de CompuLab (capa anticorrupción del Directorio). */
export interface Identidad {
  idUsuario: string;
  carne: string | null;
  nombre: string;
  correo: string;
  esEstudianteDeLaEscuela: boolean;
}

export interface DirectorioInstitucional {
  /** Lanza CredencialesInvalidas o DirectorioNoDisponible (contrato en 8.3). */
  autenticar(usuario: string, secreto: string): Promise<Identidad>;
}

/** Roles internos de CompuLab (ADR-0008): no vienen del Directorio. */
export interface RepositorioRoles {
  de(idUsuario: string): Promise<RolAsignado[]>;
}

export interface RepositorioSesiones {
  guardar(sesion: Sesion): Promise<void>;
  porToken(token: string): Promise<Sesion | null>;
  eliminar(token: string): Promise<void>;
}

export interface GeneradorDeTokens {
  /** Token aleatorio de al menos 32 caracteres, imposible de adivinar. */
  nuevo(): string;
}
