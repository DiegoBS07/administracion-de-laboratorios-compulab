// Raíz de composición (docs/07-arquitectura.md, 7.3): conecta los módulos por sus interfaces con
// los adaptadores elegidos (memoria o PostgreSQL) y levanta la API HTTP con Fastify.
import Fastify, { type FastifyInstance } from "fastify";
import type { Reloj } from "../compartido/dominio/index.js";
import { GeneradorDeIdsAleatorio } from "../compartido/infraestructura/generador-de-ids-aleatorio.js";
import { idDeSolicitud, instalarFormatoDeLaApi } from "../compartido/infraestructura/http.js";
import { RelojDelSistema } from "../compartido/infraestructura/reloj-del-sistema.js";
import * as horarios from "../modulos/horarios/index.js";
import * as identidad from "../modulos/identidad/index.js";
import * as liquidacion from "../modulos/liquidacion/index.js";
import * as reservas from "../modulos/reservas/index.js";
import { type Adaptadores, crearAdaptadoresEnMemoria } from "./adaptadores.js";
import { AutorizacionPorRoles, CoberturaParaReservas, HorasTrabajadasDesdeHorarios } from "./puentes.js";

export interface OpcionesServidor {
  /** Por omisión, la hora del sistema. Las pruebas pasan un RelojFijo. */
  reloj?: Reloj;
  /** Por omisión, todo en memoria con los datos de demostración. */
  adaptadores?: Adaptadores;
  /** Registra cada solicitud en la salida estándar (en el contenedor sí; en las pruebas no). */
  registrarSolicitudes?: boolean;
  /** Cookie de sesión con Secure (cuando se sirve por HTTPS). */
  cookieSegura?: boolean;
}

/** Arma la aplicación completa sin abrir el puerto (las pruebas la usan con app.inject). */
export function crearServidor(opciones: OpcionesServidor = {}): FastifyInstance {
  const reloj = opciones.reloj ?? new RelojDelSistema();
  const a = opciones.adaptadores ?? crearAdaptadoresEnMemoria(reloj);
  const app = Fastify({
    logger: opciones.registrarSolicitudes ? { level: "info", redact: ["req.headers.cookie", "req.headers.authorization"] } : false,
    genReqId: idDeSolicitud,
    requestIdHeader: false,
    bodyLimit: 64 * 1024
  });
  instalarFormatoDeLaApi(app);
  app.addHook("onClose", async () => a.cerrar());

  // identidad (ADR-0008)
  const depsSesion = { directorio: a.directorio, roles: a.roles, sesiones: a.sesiones, tokens: new identidad.GeneradorDeTokensAleatorio(), reloj };
  identidad.instalarGanchoDeSesion(app, new identidad.ObtenerSesion(depsSesion));

  // horarios (CU-06) y sus interfaces provistas para los otros módulos
  const cobertura = new horarios.ConsultarCobertura({ laboratorios: a.laboratorios, turnos: a.turnos });
  const turnosProgramados = new horarios.ConsultarTurnosProgramados({ turnos: a.turnos });
  const coberturaParaReservas = new CoberturaParaReservas(cobertura);

  app.get("/health", async (_solicitud, respuesta) => {
    if (!(await a.comprobarSalud())) return respuesta.status(503).send({ estado: "sin-persistencia" });
    return { estado: "ok" };
  });

  identidad.registrarRutasDeSesion(
    app,
    {
      iniciarSesion: new identidad.IniciarSesion(depsSesion),
      cerrarSesion: new identidad.CerrarSesion(depsSesion),
      usuariosDeDemostracion: () => a.directorio.usuarios
    },
    { cookieSegura: opciones.cookieSegura ?? false }
  );

  horarios.registrarRutasDeHorarios(app, {
    listarLaboratorios: new horarios.ListarLaboratorios({ laboratorios: a.laboratorios }),
    consultarHorario: new horarios.ConsultarHorario({ laboratorios: a.laboratorios, turnos: a.turnos, asistentes: a.asistentes }),
    consultarAsistentes: new horarios.ConsultarAsistentesDelLaboratorio({ laboratorios: a.laboratorios, asistentes: a.asistentes, turnos: a.turnos }),
    asignarTurno: new horarios.AsignarTurno({
      autorizacion: new AutorizacionPorRoles(new identidad.ConsultarRoles(depsSesion), opciones.registrarSolicitudes ? app.log : null),
      calendario: a.calendario,
      asistentes: a.asistentes,
      turnos: a.turnos,
      unidadDeTrabajo: a.unidadDeTrabajo,
      notificador: a.notificador,
      reloj,
      ids: new GeneradorDeIdsAleatorio("t")
    })
  });

  reservas.registrarRutasDeReservas(app, {
    consultarDisponibilidad: new reservas.ConsultarDisponibilidad({ maquinas: a.maquinas, reservas: a.reservas, cobertura: coberturaParaReservas }),
    reservarMaquina: new reservas.ReservarMaquina({
      maquinas: a.maquinas,
      reservas: a.reservas,
      cobertura: coberturaParaReservas,
      unidadDeTrabajo: a.unidadDeTrabajo,
      reloj,
      ids: new GeneradorDeIdsAleatorio("r")
    })
  });

  liquidacion.registrarRutasDeLiquidacion(app, {
    cerrarMes: new liquidacion.CerrarMes({
      cierres: a.cierres,
      horas: new HorasTrabajadasDesdeHorarios(turnosProgramados, a.marcas),
      asistentes: a.datosDeAsistentes,
      tarifas: a.tarifas,
      generador: new liquidacion.GeneradorArchivoBecasCsv(),
      notificador: a.notificador,
      reloj
    }),
    consultarCierre: new liquidacion.ConsultarCierre({ cierres: a.cierres }),
    listarCierres: new liquidacion.ListarCierresDelAnio({ cierres: a.cierres, reloj }),
    obtenerArchivo: new liquidacion.ObtenerArchivoBecas({ cierres: a.cierres })
  });

  return app;
}

/** Levanta la API en el puerto indicado, en todas las interfaces (el contenedor la publica). */
export async function iniciarServidor(opciones: OpcionesServidor & { puerto: number; host?: string }): Promise<FastifyInstance> {
  const app = crearServidor(opciones);
  await app.listen({ port: opciones.puerto, host: opciones.host ?? "0.0.0.0" });
  return app;
}
