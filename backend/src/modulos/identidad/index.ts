// Interfaz provista del módulo identidad (docs/07-arquitectura.md, 7.3; ADR-0008 y ADR-0011).
// Es lo único que src/arranque/ usa de este módulo; los demás módulos nunca lo importan (FA-2).
export { CerrarSesion, ConsultarRoles, type DependenciasSesiones, IniciarSesion, ObtenerSesion, type SesionDTO } from "./aplicacion/sesiones.js";
export type { DirectorioInstitucional, GeneradorDeTokens, Identidad, RepositorioRoles, RepositorioSesiones } from "./aplicacion/puertos.js";
export { CredencialesInvalidas, DirectorioNoDisponible, NoAutenticado, SinAccesoACompuLab } from "./dominio/errores.js";
export { DURACION_SESION_MINUTOS, ROLES, type Rol, type RolAsignado, Sesion } from "./dominio/sesion.js";
export {
  DirectorioDeDemostracion,
  GeneradorDeTokensAleatorio,
  RepositorioRolesEnMemoria,
  RepositorioSesionesEnMemoria,
  type UsuarioDeDemostracion
} from "./infraestructura/en-memoria.js";
export { instalarGanchoDeSesion, NOMBRE_COOKIE, registrarRutasDeSesion, tokenDeLaSolicitud } from "./infraestructura/rutas-http.js";
