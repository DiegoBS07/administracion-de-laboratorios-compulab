import type { Reloj } from "../../../compartido/dominio/index.js";
import { NoAutenticado, SinAccesoACompuLab } from "../dominio/errores.js";
import { type RolAsignado, Sesion } from "../dominio/sesion.js";
import type { DirectorioInstitucional, GeneradorDeTokens, RepositorioRoles, RepositorioSesiones } from "./puertos.js";

/** Cuerpo de las respuestas de /api/v1/sesion (8.7). */
export interface SesionDTO {
  id: string;
  nombre: string;
  roles: RolAsignado[];
}

const aDTO = (sesion: Sesion): SesionDTO => ({ id: sesion.idUsuario, nombre: sesion.nombre, roles: sesion.roles });

export interface DependenciasSesiones {
  directorio: DirectorioInstitucional;
  roles: RepositorioRoles;
  sesiones: RepositorioSesiones;
  tokens: GeneradorDeTokens;
  reloj: Reloj;
}

/**
 * POST /api/v1/sesion: autentica contra el Directorio y emite la sesión propia de CompuLab
 * (ADR-0008). Los estudiantes de la Escuela reciben el rol ESTUDIANTE sin registro previo;
 * los demás roles se guardan en CompuLab. Ante un Directorio caído se falla cerrado (ADR-0011).
 */
export class IniciarSesion {
  readonly #d: DependenciasSesiones;

  constructor(dependencias: DependenciasSesiones) {
    this.#d = dependencias;
  }

  async ejecutar(usuario: string, secreto: string): Promise<{ token: string; sesion: SesionDTO }> {
    const identidad = await this.#d.directorio.autenticar(usuario, secreto);
    const roles = await this.#d.roles.de(identidad.idUsuario);
    if (identidad.esEstudianteDeLaEscuela && !roles.some((r) => r.rol === "ESTUDIANTE")) {
      roles.unshift({ rol: "ESTUDIANTE" });
    }
    if (roles.length === 0) throw new SinAccesoACompuLab(identidad.idUsuario);

    const sesion = Sesion.iniciar({
      token: this.#d.tokens.nuevo(),
      idUsuario: identidad.idUsuario,
      nombre: identidad.nombre,
      roles,
      ahora: this.#d.reloj.ahora()
    });
    await this.#d.sesiones.guardar(sesion);
    return { token: sesion.token, sesion: aDTO(sesion) };
  }
}

/** GET /api/v1/sesion y el gancho de cada solicitud: la sesión vigente de ese token. */
export class ObtenerSesion {
  readonly #d: Pick<DependenciasSesiones, "sesiones" | "reloj">;

  constructor(dependencias: Pick<DependenciasSesiones, "sesiones" | "reloj">) {
    this.#d = dependencias;
  }

  async ejecutar(token: string | null): Promise<SesionDTO> {
    const sesion = token ? await this.#d.sesiones.porToken(token) : null;
    if (!sesion) throw new NoAutenticado();
    if (!sesion.estaVigenteEn(this.#d.reloj.ahora())) {
      await this.#d.sesiones.eliminar(sesion.token);
      throw new NoAutenticado();
    }
    return aDTO(sesion);
  }
}

/** DELETE /api/v1/sesion. Cerrar una sesión que no existe no es un error. */
export class CerrarSesion {
  readonly #sesiones: RepositorioSesiones;

  constructor(dependencias: Pick<DependenciasSesiones, "sesiones">) {
    this.#sesiones = dependencias.sesiones;
  }

  async ejecutar(token: string | null): Promise<void> {
    if (token) await this.#sesiones.eliminar(token);
  }
}

/** Interfaz provista para la autorización de otros módulos (la conecta src/arranque/). */
export class ConsultarRoles {
  readonly #roles: RepositorioRoles;

  constructor(dependencias: Pick<DependenciasSesiones, "roles">) {
    this.#roles = dependencias.roles;
  }

  async de(idUsuario: string): Promise<RolAsignado[]> {
    return this.#roles.de(idUsuario);
  }
}
