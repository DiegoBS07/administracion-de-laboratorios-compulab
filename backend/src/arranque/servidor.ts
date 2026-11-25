// Raíz de composición (docs/07-arquitectura.md, 7.3): crea los adaptadores, conecta los módulos
// por sus interfaces y levanta la API HTTP con Fastify. Es el único lugar que conoce a todos.
import Fastify, { type FastifyInstance } from "fastify";
import type { Reloj } from "../compartido/dominio/index.js";
import { BandejaDeAvisos } from "../compartido/infraestructura/bandeja-de-avisos.js";
import { GeneradorDeIdsAleatorio } from "../compartido/infraestructura/generador-de-ids-aleatorio.js";
import { idDeSolicitud, instalarFormatoDeLaApi } from "../compartido/infraestructura/http.js";
import { RelojDelSistema } from "../compartido/infraestructura/reloj-del-sistema.js";
import { UnidadDeTrabajoEnMemoria } from "../compartido/infraestructura/unidad-de-trabajo-en-memoria.js";
import * as horarios from "../modulos/horarios/index.js";
import * as identidad from "../modulos/identidad/index.js";
import * as liquidacion from "../modulos/liquidacion/index.js";
import * as reservas from "../modulos/reservas/index.js";
import { crearDatosDeDemostracion } from "./datos-de-demostracion.js";
import {
  AsistentesDeDemostracion,
  AutorizacionPorRoles,
  CalendarioFijo,
  CatalogoDeLaboratoriosFijo,
  CoberturaParaReservas,
  HorasTrabajadasDeDemostracion,
  TablaTarifasFija
} from "./puentes.js";

export interface OpcionesServidor {
  /** Por omisión, la hora del sistema. Las pruebas pasan un RelojFijo. */
  reloj?: Reloj;
  /** Registra cada solicitud en la salida estándar (en el contenedor sí; en las pruebas no). */
  registrarSolicitudes?: boolean;
  /** Cookie de sesión con Secure (cuando se sirve por HTTPS). */
  cookieSegura?: boolean;
}

/** Arma la aplicación completa sin abrir el puerto (las pruebas la usan con app.inject). */
export function crearServidor(opciones: OpcionesServidor = {}): FastifyInstance {
  const reloj = opciones.reloj ?? new RelojDelSistema();
  const app = Fastify({
    logger: opciones.registrarSolicitudes ? { level: "info", redact: ["req.headers.cookie", "req.headers.authorization"] } : false,
    genReqId: idDeSolicitud,
    requestIdHeader: false,
    bodyLimit: 64 * 1024
  });
  instalarFormatoDeLaApi(app);

  const datos = crearDatosDeDemostracion(reloj.ahora());
  const unidadDeTrabajo = new UnidadDeTrabajoEnMemoria();
  const avisos = new BandejaDeAvisos(() => reloj.ahora().aISO());

  // identidad (ADR-0008): Directorio de demostración, roles y sesiones en memoria
  const directorio = new identidad.DirectorioDeDemostracion(datos.usuarios);
  const depsSesion = {
    directorio,
    roles: new identidad.RepositorioRolesEnMemoria(datos.roles),
    sesiones: new identidad.RepositorioSesionesEnMemoria(),
    tokens: new identidad.GeneradorDeTokensAleatorio(),
    reloj
  };
  const consultarRoles = new identidad.ConsultarRoles(depsSesion);
  identidad.instalarGanchoDeSesion(app, new identidad.ObtenerSesion(depsSesion));

  // horarios (CU-06)
  const laboratorios = new CatalogoDeLaboratoriosFijo(datos.laboratorios);
  const asistentes = new AsistentesDeDemostracion(datos.asistentes, () => reloj.ahora().fecha);
  const turnos = new horarios.RepositorioTurnosEnMemoria(unidadDeTrabajo, datos.turnos);
  const cobertura = new horarios.ConsultarCobertura({ laboratorios, turnos });
  const turnosProgramados = new horarios.ConsultarTurnosProgramados({ turnos });

  // reservas (CU-11)
  const maquinas = new reservas.RepositorioMaquinasEnMemoria(datos.maquinas);
  const repositorioReservas = new reservas.RepositorioReservasEnMemoria(unidadDeTrabajo, datos.reservas);
  const coberturaParaReservas = new CoberturaParaReservas(cobertura);

  // liquidación (CU-14)
  const cierres = new liquidacion.RepositorioCierresEnMemoria();

  app.get("/health", async () => ({ estado: "ok" }));

  identidad.registrarRutasDeSesion(
    app,
    {
      iniciarSesion: new identidad.IniciarSesion(depsSesion),
      cerrarSesion: new identidad.CerrarSesion(depsSesion),
      usuariosDeDemostracion: () => directorio.usuarios
    },
    { cookieSegura: opciones.cookieSegura ?? false }
  );

  horarios.registrarRutasDeHorarios(app, {
    listarLaboratorios: new horarios.ListarLaboratorios({ laboratorios }),
    consultarHorario: new horarios.ConsultarHorario({ laboratorios, turnos, asistentes }),
    consultarAsistentes: new horarios.ConsultarAsistentesDelLaboratorio({ laboratorios, asistentes, turnos }),
    asignarTurno: new horarios.AsignarTurno({
      autorizacion: new AutorizacionPorRoles(consultarRoles, opciones.registrarSolicitudes ? app.log : null),
      calendario: new CalendarioFijo(datos.semestre),
      asistentes,
      turnos,
      unidadDeTrabajo,
      notificador: avisos,
      reloj,
      ids: new GeneradorDeIdsAleatorio("t")
    })
  });

  reservas.registrarRutasDeReservas(app, {
    consultarDisponibilidad: new reservas.ConsultarDisponibilidad({ maquinas, reservas: repositorioReservas, cobertura: coberturaParaReservas }),
    reservarMaquina: new reservas.ReservarMaquina({
      maquinas,
      reservas: repositorioReservas,
      cobertura: coberturaParaReservas,
      unidadDeTrabajo,
      reloj,
      ids: new GeneradorDeIdsAleatorio("r")
    })
  });

  liquidacion.registrarRutasDeLiquidacion(app, {
    cerrarMes: new liquidacion.CerrarMes({
      cierres,
      horas: new HorasTrabajadasDeDemostracion(turnosProgramados, datos.marcas),
      asistentes: asistentes.paraLiquidacion(),
      tarifas: new TablaTarifasFija(datos.tarifas),
      generador: new liquidacion.GeneradorArchivoBecasCsv(),
      notificador: avisos,
      reloj
    }),
    consultarCierre: new liquidacion.ConsultarCierre({ cierres }),
    listarCierres: new liquidacion.ListarCierresDelAnio({ cierres, reloj }),
    obtenerArchivo: new liquidacion.ObtenerArchivoBecas({ cierres })
  });

  return app;
}

/** Levanta la API en el puerto indicado, en todas las interfaces (el contenedor la publica). */
export async function iniciarServidor(opciones: OpcionesServidor & { puerto: number; host?: string }): Promise<FastifyInstance> {
  const app = crearServidor(opciones);
  await app.listen({ port: opciones.puerto, host: opciones.host ?? "0.0.0.0" });
  return app;
}
