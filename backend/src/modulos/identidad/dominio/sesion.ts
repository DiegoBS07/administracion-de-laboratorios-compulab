import { DatoInvalido, type Instante } from "../../../compartido/dominio/index.js";

export const ROLES = ["ESTUDIANTE", "ASISTENTE", "COORDINADOR_LABORATORIO", "COORDINADOR_SOPORTE"] as const;
export type Rol = (typeof ROLES)[number];

export interface RolAsignado {
  rol: Rol;
  /** Solo para COORDINADOR_LABORATORIO: el laboratorio que coordina. */
  idLaboratorio?: string;
}

/** Duración de la sesión propia de CompuLab (ADR-0008): 8 horas. */
export const DURACION_SESION_MINUTOS = 8 * 60;

export interface DatosDeSesion {
  token: string;
  idUsuario: string;
  nombre: string;
  roles: readonly RolAsignado[];
  venceEn: Instante;
}

/**
 * Sesión de CompuLab, emitida después de autenticar contra el Directorio (ADR-0008). Inmutable.
 * Invariantes: token de al menos 32 caracteres; usuario y nombre no vacíos; al menos un rol válido;
 * un coordinador de laboratorio siempre dice qué laboratorio coordina.
 */
export class Sesion {
  readonly #datos: DatosDeSesion;

  private constructor(datos: DatosDeSesion) {
    this.#datos = { ...datos, roles: datos.roles.map((r) => ({ ...r })) };
  }

  static iniciar(datos: { token: string; idUsuario: string; nombre: string; roles: readonly RolAsignado[]; ahora: Instante }): Sesion {
    return Sesion.reconstituir({ ...datos, venceEn: datos.ahora.sumarMinutos(DURACION_SESION_MINUTOS) });
  }

  static reconstituir(datos: DatosDeSesion): Sesion {
    if (!datos.token || datos.token.length < 32) {
      throw new DatoInvalido("token", "(oculto)", "El token de sesión debe tener al menos 32 caracteres.");
    }
    if (!datos.idUsuario?.trim() || !datos.nombre?.trim()) {
      throw new DatoInvalido("usuario", datos.idUsuario, "La sesión necesita el usuario y su nombre.");
    }
    if (datos.roles.length === 0) {
      throw new DatoInvalido("roles", 0, "La sesión necesita al menos un rol.");
    }
    for (const r of datos.roles) {
      if (!(ROLES as readonly string[]).includes(r.rol)) {
        throw new DatoInvalido("rol", r.rol, "El rol no es válido.");
      }
      if (r.rol === "COORDINADOR_LABORATORIO" && !r.idLaboratorio?.trim()) {
        throw new DatoInvalido("idLaboratorio", null, "Un coordinador de laboratorio debe indicar su laboratorio.");
      }
    }
    return new Sesion(datos);
  }

  get token(): string {
    return this.#datos.token;
  }

  get idUsuario(): string {
    return this.#datos.idUsuario;
  }

  get nombre(): string {
    return this.#datos.nombre;
  }

  get roles(): RolAsignado[] {
    return this.#datos.roles.map((r) => ({ ...r }));
  }

  get venceEn(): Instante {
    return this.#datos.venceEn;
  }

  estaVigenteEn(ahora: Instante): boolean {
    return ahora.esAnteriorA(this.#datos.venceEn);
  }
}
