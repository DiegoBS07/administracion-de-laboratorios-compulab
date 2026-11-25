// Adaptadores del módulo identidad para el núcleo ejecutable: sin Directorio real ni base de datos
// (docs/03-alcance.md, 3.3). Se reemplazan por LDAP/OIDC y PostgreSQL sin tocar los casos de uso.
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { DirectorioInstitucional, GeneradorDeTokens, Identidad, RepositorioRoles, RepositorioSesiones } from "../aplicacion/puertos.js";
import { CredencialesInvalidas } from "../dominio/errores.js";
import type { RolAsignado, Sesion } from "../dominio/sesion.js";

export interface UsuarioDeDemostracion {
  usuario: string;
  secreto: string;
  identidad: Identidad;
  /** Qué puede hacer, para el selector de 15.7. */
  descripcion: string;
}

const huella = (texto: string) => createHash("sha256").update(texto, "utf8").digest();

/** Doble del Directorio institucional con usuarios fijos (8.2: "un doble con usuarios fijos"). */
export class DirectorioDeDemostracion implements DirectorioInstitucional {
  readonly #usuarios: ReadonlyMap<string, UsuarioDeDemostracion>;

  constructor(usuarios: readonly UsuarioDeDemostracion[]) {
    this.#usuarios = new Map(usuarios.map((u) => [u.usuario, u]));
  }

  async autenticar(usuario: string, secreto: string): Promise<Identidad> {
    const encontrado = this.#usuarios.get(usuario);
    // se compara siempre, aunque el usuario no exista, para no revelar cuáles existen por el tiempo de respuesta
    const iguales = timingSafeEqual(huella(encontrado?.secreto ?? "\u0000"), huella(secreto));
    if (!encontrado || !iguales) throw new CredencialesInvalidas();
    return { ...encontrado.identidad };
  }

  /** Para el selector de usuarios de la versión de demostración (diseno-ux-ui.md, 15.7). */
  get usuarios(): { usuario: string; nombre: string; descripcion: string }[] {
    return [...this.#usuarios.values()].map((u) => ({ usuario: u.usuario, nombre: u.identidad.nombre, descripcion: u.descripcion }));
  }
}

export class RepositorioRolesEnMemoria implements RepositorioRoles {
  readonly #roles: ReadonlyMap<string, readonly RolAsignado[]>;

  constructor(roles: Record<string, readonly RolAsignado[]>) {
    this.#roles = new Map(Object.entries(roles));
  }

  async de(idUsuario: string): Promise<RolAsignado[]> {
    return (this.#roles.get(idUsuario) ?? []).map((r) => ({ ...r }));
  }
}

/** Sesiones en memoria, indexadas por la huella del token: el token en claro solo lo tiene la cookie. */
export class RepositorioSesionesEnMemoria implements RepositorioSesiones {
  readonly #sesiones = new Map<string, Sesion>();

  async guardar(sesion: Sesion): Promise<void> {
    this.#sesiones.set(huella(sesion.token).toString("hex"), sesion);
  }

  async porToken(token: string): Promise<Sesion | null> {
    return this.#sesiones.get(huella(token).toString("hex")) ?? null;
  }

  async eliminar(token: string): Promise<void> {
    this.#sesiones.delete(huella(token).toString("hex"));
  }
}

/** 32 bytes aleatorios en base64url (43 caracteres). */
export class GeneradorDeTokensAleatorio implements GeneradorDeTokens {
  nuevo(): string {
    return randomBytes(32).toString("base64url");
  }
}
