// Interfaz provista del módulo horarios (docs/08-componentes.md, 8.4).
// Es lo único que src/arranque/ usa de este módulo; los demás módulos nunca lo importan (FA-2).
export {
  AsignarTurno,
  type DependenciasAsignarTurno,
  type ResultadoAsignarTurno,
  type SolicitudAsignarTurno,
  type TurnoAsignadoDTO
} from "./aplicacion/asignar-turno.js";
export type {
  AsistenteParaHorario,
  Autorizacion,
  CalendarioAcademico,
  ConsultaAsistentes,
  GeneradorDeIds,
  Notificador,
  RepositorioTurnos,
  UnidadDeTrabajo,
  UsuarioActual
} from "./aplicacion/puertos.js";
export { AsistenteNoExiste, ClaveDeSolicitudReutilizada, SinPermisoSobreLaboratorio } from "./aplicacion/errores.js";
export {
  AsistenteNoActivo,
  FranjaDeTurnoInvalida,
  FranjaOcupadaEnLaboratorio,
  FueraDelSemestre,
  TopeSemanalExcedido,
  TraslapeDeTurno,
  TurnoEnElPasado
} from "./dominio/errores.js";
export { Turno } from "./dominio/turno.js";
export type { EstadoTurno } from "./dominio/estado-turno.js";
