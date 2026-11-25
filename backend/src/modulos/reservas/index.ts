// Interfaz provista del módulo reservas (docs/08-componentes.md, 8.5).
// Es lo único que src/arranque/ usa de este módulo; los demás módulos nunca lo importan (FA-2).
export {
  ReservarMaquina,
  type DependenciasReservarMaquina,
  type ReservaDTO,
  type ResultadoReservarMaquina,
  type SolicitudReserva
} from "./aplicacion/reservar-maquina.js";
export {
  ConsultarDisponibilidad,
  type DependenciasConsultarDisponibilidad,
  type DisponibilidadDTO
} from "./aplicacion/consultar-disponibilidad.js";
export type {
  CoberturaDeLaboratorio,
  GeneradorDeIds,
  RepositorioMaquinas,
  RepositorioReservas,
  UnidadDeTrabajo,
  UsuarioActual
} from "./aplicacion/puertos.js";
export { ClaveDeSolicitudReutilizada, LaboratorioNoExiste, MaquinaNoExiste } from "./aplicacion/errores.js";
export {
  FranjaDeReservaInvalida,
  FueraDeHorizonteDeReserva,
  LaboratorioCerradoEnFranja,
  LimiteSemanalDeReservaExcedido,
  MaquinaFueraDeServicio,
  MaquinaNoDisponible,
  ReservaExcedeDuracion,
  YaTieneReservaActiva
} from "./dominio/errores.js";
export { Maquina } from "./dominio/maquina.js";
export { Reserva } from "./dominio/reserva.js";
export type { EstadoReserva } from "./dominio/estado-reserva.js";
export { POLITICA_DE_RESERVAS } from "./dominio/politica-de-reservas.js";
export { RepositorioMaquinasEnMemoria } from "./infraestructura/repositorio-maquinas-en-memoria.js";
export { RepositorioReservasEnMemoria } from "./infraestructura/repositorio-reservas-en-memoria.js";
export { type CasosDeReservas, registrarRutasDeReservas } from "./infraestructura/rutas-http.js";
export { RepositorioMaquinasPostgres, RepositorioReservasPostgres } from "./infraestructura/repositorios-postgres.js";
