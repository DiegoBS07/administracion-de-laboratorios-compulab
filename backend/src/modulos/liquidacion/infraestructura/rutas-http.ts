// Rutas HTTP de CU-14 (docs/08-componentes.md, 8.7 "CU-14 · Cierre mensual"). Solo el coordinador de soporte.
import type { FastifyInstance } from "fastify";
import { exigirRol } from "../../../compartido/infraestructura/http.js";
import type { CerrarMes } from "../aplicacion/cerrar-mes.js";
import type { ConsultarCierre, ListarCierresDelAnio, ObtenerArchivoBecas } from "../aplicacion/consultar-cierre.js";

export interface CasosDeLiquidacion {
  cerrarMes: CerrarMes;
  consultarCierre: ConsultarCierre;
  listarCierres: ListarCierresDelAnio;
  obtenerArchivo: ObtenerArchivoBecas;
}

const ANIO = { type: "integer", minimum: 1970, maximum: 9998 } as const;
const MES = { type: "integer", minimum: 1, maximum: 12 } as const;
const PARAMS_MES = { type: "object", required: ["anio", "mes"], properties: { anio: ANIO, mes: MES } } as const;

type ConMes = { Params: { anio: number; mes: number } };

export function registrarRutasDeLiquidacion(app: FastifyInstance, casos: CasosDeLiquidacion): void {
  app.post<{ Body: { anio: number; mes: number } }>(
    "/api/v1/cierres",
    { schema: { body: { ...PARAMS_MES, additionalProperties: false } } },
    async (solicitud, respuesta) => {
      exigirRol(solicitud, "COORDINADOR_SOPORTE");
      const { creado, cierre } = await casos.cerrarMes.ejecutar(solicitud.body.anio, solicitud.body.mes);
      return respuesta.status(creado ? 201 : 200).send(cierre);
    }
  );

  app.get<{ Querystring: { anio: number } }>(
    "/api/v1/cierres",
    { schema: { querystring: { type: "object", required: ["anio"], properties: { anio: ANIO } } } },
    async (solicitud) => {
      exigirRol(solicitud, "COORDINADOR_SOPORTE");
      return casos.listarCierres.ejecutar(solicitud.query.anio);
    }
  );

  app.get<ConMes>("/api/v1/cierres/:anio/:mes", { schema: { params: PARAMS_MES } }, async (solicitud) => {
    exigirRol(solicitud, "COORDINADOR_SOPORTE");
    return casos.consultarCierre.ejecutar(solicitud.params.anio, solicitud.params.mes);
  });

  app.get<ConMes>("/api/v1/cierres/:anio/:mes/archivo", { schema: { params: PARAMS_MES } }, async (solicitud, respuesta) => {
    exigirRol(solicitud, "COORDINADOR_SOPORTE");
    const archivo = await casos.obtenerArchivo.ejecutar(solicitud.params.anio, solicitud.params.mes);
    return respuesta
      .header("Content-Type", `${archivo.tipo}; charset=utf-8`)
      .header("Content-Disposition", `attachment; filename="${archivo.nombre}"`)
      .send(archivo.contenido);
  });
}
