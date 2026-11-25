// Rutas HTTP de CU-06 (docs/08-componentes.md, 8.7 "CU-06 · Horario y asignación de turnos").
// Solo traducen HTTP ↔ casos de uso: las reglas viven en el dominio (7.4, regla 5).
import type { FastifyInstance } from "fastify";
import { claveDeSolicitud, exigirRol, exigirUsuario } from "../../../compartido/infraestructura/http.js";
import type { AsignarTurno } from "../aplicacion/asignar-turno.js";
import type { ConsultarAsistentesDelLaboratorio, ConsultarHorario, ListarLaboratorios } from "../aplicacion/consultas.js";

export interface CasosDeHorarios {
  listarLaboratorios: ListarLaboratorios;
  consultarHorario: ConsultarHorario;
  consultarAsistentes: ConsultarAsistentesDelLaboratorio;
  asignarTurno: AsignarTurno;
}

const ID = { type: "string", pattern: "^[A-Za-z0-9_-]{1,64}$" } as const;
const FECHA = { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" } as const;
const HORA = { type: "string", pattern: "^\\d{2}:\\d{2}$" } as const;
const PARAMS_LABORATORIO = { type: "object", required: ["idLaboratorio"], properties: { idLaboratorio: ID } } as const;
const QUERY_SEMANA = { type: "object", required: ["semana"], properties: { semana: FECHA } } as const;

type ConLaboratorio = { Params: { idLaboratorio: string } };
type ConSemana = ConLaboratorio & { Querystring: { semana: string } };

export function registrarRutasDeHorarios(app: FastifyInstance, casos: CasosDeHorarios): void {
  app.get("/api/v1/laboratorios", async (solicitud) => {
    exigirUsuario(solicitud);
    return casos.listarLaboratorios.ejecutar();
  });

  app.get<ConSemana>(
    "/api/v1/laboratorios/:idLaboratorio/turnos",
    { schema: { params: PARAMS_LABORATORIO, querystring: QUERY_SEMANA } },
    async (solicitud) => {
      exigirUsuario(solicitud);
      return casos.consultarHorario.ejecutar(solicitud.params.idLaboratorio, solicitud.query.semana);
    }
  );

  app.get<ConSemana>(
    "/api/v1/laboratorios/:idLaboratorio/asistentes",
    { schema: { params: PARAMS_LABORATORIO, querystring: QUERY_SEMANA } },
    async (solicitud) => {
      exigirRol(solicitud, "COORDINADOR_LABORATORIO", "COORDINADOR_SOPORTE");
      return casos.consultarAsistentes.ejecutar(solicitud.params.idLaboratorio, solicitud.query.semana);
    }
  );

  app.post<ConLaboratorio & { Body: { idAsistente: string; fecha: string; horaInicio: string; horaFin: string } }>(
    "/api/v1/laboratorios/:idLaboratorio/turnos",
    {
      schema: {
        params: PARAMS_LABORATORIO,
        body: {
          type: "object",
          required: ["idAsistente", "fecha", "horaInicio", "horaFin"],
          additionalProperties: false,
          properties: { idAsistente: ID, fecha: FECHA, horaInicio: HORA, horaFin: HORA }
        }
      }
    },
    async (solicitud, respuesta) => {
      const usuario = exigirUsuario(solicitud);
      const { creado, turno } = await casos.asignarTurno.ejecutar(
        { id: usuario.id },
        { idLaboratorio: solicitud.params.idLaboratorio, ...solicitud.body, claveSolicitud: claveDeSolicitud(solicitud) }
      );
      return respuesta.status(creado ? 201 : 200).send(turno);
    }
  );
}
