// Rutas HTTP de CU-11 (docs/08-componentes.md, 8.7 "CU-11 · Disponibilidad y reserva").
import type { FastifyInstance } from "fastify";
import { claveDeSolicitud, exigirRol, exigirUsuario } from "../../../compartido/infraestructura/http.js";
import type { ConsultarDisponibilidad } from "../aplicacion/consultar-disponibilidad.js";
import type { ConsultarMisReservas } from "../aplicacion/consultar-mis-reservas.js";
import type { ReservarMaquina } from "../aplicacion/reservar-maquina.js";

export interface CasosDeReservas {
  consultarDisponibilidad: ConsultarDisponibilidad;
  consultarMisReservas: ConsultarMisReservas;
  reservarMaquina: ReservarMaquina;
}

const ID = { type: "string", pattern: "^[A-Za-z0-9_-]{1,64}$" } as const;
const INSTANTE = { type: "string", minLength: 16, maxLength: 40 } as const;

export function registrarRutasDeReservas(app: FastifyInstance, casos: CasosDeReservas): void {
  app.get<{ Params: { idLaboratorio: string }; Querystring: { fecha: string } }>(
    "/api/v1/laboratorios/:idLaboratorio/disponibilidad",
    {
      schema: {
        params: { type: "object", required: ["idLaboratorio"], properties: { idLaboratorio: ID } },
        querystring: { type: "object", required: ["fecha"], properties: { fecha: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" } } }
      }
    },
    async (solicitud) => {
      exigirUsuario(solicitud);
      return casos.consultarDisponibilidad.ejecutar(solicitud.params.idLaboratorio, solicitud.query.fecha);
    }
  );

  app.get("/api/v1/reservas/mias", async (solicitud) => {
    const usuario = exigirRol(solicitud, "ESTUDIANTE");
    return casos.consultarMisReservas.ejecutar({ id: usuario.id });
  });

  app.post<{ Body: { idMaquina: string; inicio: string; fin: string } }>(
    "/api/v1/reservas",
    {
      schema: {
        body: {
          type: "object",
          required: ["idMaquina", "inicio", "fin"],
          additionalProperties: false,
          properties: { idMaquina: ID, inicio: INSTANTE, fin: INSTANTE }
        }
      }
    },
    async (solicitud, respuesta) => {
      const usuario = exigirRol(solicitud, "ESTUDIANTE");
      const { creada, reserva } = await casos.reservarMaquina.ejecutar(
        { id: usuario.id },
        { ...solicitud.body, claveSolicitud: claveDeSolicitud(solicitud) }
      );
      return respuesta.status(creada ? 201 : 200).send(reserva);
    }
  );
}
