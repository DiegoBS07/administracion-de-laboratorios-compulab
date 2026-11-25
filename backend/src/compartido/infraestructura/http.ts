// Piezas HTTP comunes a las rutas de todos los módulos (docs/08-componentes.md, 8.7):
// formato de error, traducción de códigos a estados, usuario de la sesión e Idempotency-Key.
import { randomUUID } from "node:crypto";
import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ErrorDeDominio } from "../dominio/index.js";

export type Rol = "ESTUDIANTE" | "ASISTENTE" | "COORDINADOR_LABORATORIO" | "COORDINADOR_SOPORTE";

/** Usuario de la sesión, tal como lo deja el gancho de sesión en cada solicitud. */
export interface UsuarioDeLaSolicitud {
  id: string;
  nombre: string;
  roles: { rol: Rol; idLaboratorio?: string }[];
}

declare module "fastify" {
  interface FastifyRequest {
    usuario: UsuarioDeLaSolicitud | null;
  }
}

/** Error propio del borde HTTP (sesión, permisos por rol, cabeceras): no es una regla de negocio. */
export class ErrorHttp extends Error {
  readonly estado: number;
  readonly codigo: string;
  readonly detalle: Record<string, unknown>;

  constructor(estado: number, codigo: string, mensaje: string, detalle: Record<string, unknown> = {}) {
    super(mensaje);
    this.estado = estado;
    this.codigo = codigo;
    this.detalle = detalle;
  }
}

/** Estado HTTP de cada código de error de dominio (tabla de 8.7). Un código sin estado responde 422. */
const ESTADO_POR_CODIGO: Readonly<Record<string, number>> = {
  SOLICITUD_INVALIDA: 400,
  FRANJA_INVALIDA: 400,
  NO_AUTENTICADO: 401,
  CREDENCIALES_INVALIDAS: 401,
  SIN_PERMISO: 403,
  SIN_PERMISO_SOBRE_LABORATORIO: 403,
  LABORATORIO_NO_EXISTE: 404,
  MAQUINA_NO_EXISTE: 404,
  CIERRE_NO_EXISTE: 404,
  ASISTENTE_NO_EXISTE: 404,
  RECURSO_NO_ENCONTRADO: 404,
  TRASLAPE_DE_TURNO: 409,
  FRANJA_OCUPADA_EN_LABORATORIO: 409,
  MAQUINA_NO_DISPONIBLE: 409,
  YA_TIENE_RESERVA_ACTIVA: 409,
  CIERRE_YA_EXISTE: 409,
  ERROR_AL_GENERAR_ARCHIVO: 500,
  DIRECTORIO_NO_DISPONIBLE: 503
};

export function estadoHttpDe(codigo: string): number {
  return ESTADO_POR_CODIGO[codigo] ?? 422;
}

export function exigirUsuario(solicitud: FastifyRequest): UsuarioDeLaSolicitud {
  if (!solicitud.usuario) {
    throw new ErrorHttp(401, "NO_AUTENTICADO", "Inicie sesión para continuar.");
  }
  return solicitud.usuario;
}

/** Permiso por rol en el borde, para los casos de uso que no tienen su propio puerto de autorización. */
export function exigirRol(solicitud: FastifyRequest, ...roles: Rol[]): UsuarioDeLaSolicitud {
  const usuario = exigirUsuario(solicitud);
  if (!usuario.roles.some((r) => roles.includes(r.rol))) {
    solicitud.log.warn({ seguridad: "acceso-denegado", idUsuario: usuario.id, ruta: solicitud.url, rolesRequeridos: roles });
    throw new ErrorHttp(403, "SIN_PERMISO", "Su rol no permite esta acción.", { rolesRequeridos: roles });
  }
  return usuario;
}

/** ADR-0010: la cabecera Idempotency-Key es obligatoria en las operaciones que crean. */
export function claveDeSolicitud(solicitud: FastifyRequest): string {
  const valor = solicitud.headers["idempotency-key"];
  const clave = Array.isArray(valor) ? valor[0] : valor;
  if (!clave || !/^[A-Za-z0-9-]{8,100}$/.test(clave)) {
    throw new ErrorHttp(400, "SOLICITUD_INVALIDA", "Falta la cabecera Idempotency-Key o no tiene un formato válido.", {
      campo: "Idempotency-Key"
    });
  }
  return clave;
}

/** X-Request-Id: se respeta el del cliente si es seguro de registrar; si no, se genera uno. */
export function idDeSolicitud(solicitud: { headers: Record<string, string | string[] | undefined> }): string {
  const valor = solicitud.headers["x-request-id"];
  const id = Array.isArray(valor) ? valor[0] : valor;
  return id && /^[A-Za-z0-9._-]{1,64}$/.test(id) ? id : randomUUID();
}

function responderError(respuesta: FastifyReply, solicitud: FastifyRequest, estado: number, codigo: string, mensaje: string, detalle: unknown) {
  return respuesta.status(estado).send({ codigo, mensaje, detalle, idSolicitud: solicitud.id });
}

/** Formato de error único (8.7) y X-Request-Id en todas las respuestas. */
export function instalarFormatoDeLaApi(app: FastifyInstance): void {
  app.decorateRequest("usuario", null);

  app.addHook("onSend", async (solicitud, respuesta) => {
    respuesta.header("X-Request-Id", solicitud.id);
  });

  app.setNotFoundHandler((solicitud, respuesta) =>
    responderError(respuesta, solicitud, 404, "RECURSO_NO_ENCONTRADO", "La ruta no existe.", {})
  );

  app.setErrorHandler((error: FastifyError | ErrorHttp | ErrorDeDominio, solicitud, respuesta) => {
    if (error instanceof ErrorHttp) {
      return responderError(respuesta, solicitud, error.estado, error.codigo, error.message, error.detalle);
    }
    if (error instanceof ErrorDeDominio) {
      const estado = estadoHttpDe(error.codigo);
      if (estado >= 500) solicitud.log.error({ err: error }, "falla al atender la solicitud");
      return responderError(respuesta, solicitud, estado, error.codigo, error.message, error.detalle);
    }
    if ("validation" in error && error.validation) {
      return responderError(respuesta, solicitud, 400, "SOLICITUD_INVALIDA", "La solicitud no tiene el formato esperado.", {
        errores: error.validation.map((v) => `${v.instancePath || error.validationContext || ""} ${v.message ?? ""}`.trim())
      });
    }
    const estado = "statusCode" in error ? error.statusCode : undefined;
    if (estado && estado >= 400 && estado < 500) {
      return responderError(respuesta, solicitud, estado, "SOLICITUD_INVALIDA", "La solicitud no tiene el formato esperado.", {});
    }
    solicitud.log.error({ err: error }, "error interno");
    return responderError(respuesta, solicitud, 500, "ERROR_INTERNO", "Ocurrió un error inesperado. Reporte el número de solicitud.", {});
  });
}
