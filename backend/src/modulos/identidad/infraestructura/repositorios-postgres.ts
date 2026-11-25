import { createHash } from "node:crypto";
import { instanteDe, type UnidadDeTrabajoPostgres } from "../../../compartido/infraestructura/postgres/conexion.js";
import type { RepositorioRoles, RepositorioSesiones } from "../aplicacion/puertos.js";
import { type Rol, type RolAsignado, Sesion } from "../dominio/sesion.js";

const huella = (token: string) => createHash("sha256").update(token, "utf8").digest("hex");

export class RepositorioRolesPostgres implements RepositorioRoles {
  readonly #unidad: UnidadDeTrabajoPostgres;

  constructor(unidad: UnidadDeTrabajoPostgres) {
    this.#unidad = unidad;
  }

  async de(idUsuario: string): Promise<RolAsignado[]> {
    const filas = await this.#unidad.ejecutor().selectFrom("roles_usuarios").selectAll().where("id_usuario", "=", idUsuario).orderBy("rol").execute();
    return filas.map((f) => ({ rol: f.rol as Rol, ...(f.id_laboratorio ? { idLaboratorio: f.id_laboratorio } : {}) }));
  }
}

/** Sesiones en PostgreSQL, indexadas por la huella SHA-256 del token: el token en claro no se guarda. */
export class RepositorioSesionesPostgres implements RepositorioSesiones {
  readonly #unidad: UnidadDeTrabajoPostgres;

  constructor(unidad: UnidadDeTrabajoPostgres) {
    this.#unidad = unidad;
  }

  async guardar(sesion: Sesion): Promise<void> {
    await this.#unidad
      .ejecutor()
      .insertInto("sesiones")
      .values({
        huella_token: huella(sesion.token),
        id_usuario: sesion.idUsuario,
        nombre: sesion.nombre,
        roles: JSON.stringify(sesion.roles),
        vence_en: sesion.venceEn.aISO()
      })
      .execute();
  }

  async porToken(token: string): Promise<Sesion | null> {
    const fila = await this.#unidad.ejecutor().selectFrom("sesiones").selectAll().where("huella_token", "=", huella(token)).executeTakeFirst();
    if (!fila) return null;
    return Sesion.reconstituir({
      token,
      idUsuario: fila.id_usuario,
      nombre: fila.nombre,
      roles: fila.roles.map((r) => ({ rol: r.rol as Rol, ...(r.idLaboratorio ? { idLaboratorio: r.idLaboratorio } : {}) })),
      venceEn: instanteDe(fila.vence_en)
    });
  }

  async eliminar(token: string): Promise<void> {
    await this.#unidad.ejecutor().deleteFrom("sesiones").where("huella_token", "=", huella(token)).execute();
  }
}
