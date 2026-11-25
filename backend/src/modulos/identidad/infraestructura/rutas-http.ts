// Rutas HTTP de sesión (docs/08-componentes.md, 8.7 "Sesión").
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { CerrarSesion, IniciarSesion, ObtenerSesion } from "../aplicacion/sesiones.js";
import { DURACION_SESION_MINUTOS } from "../dominio/sesion.js";
import { NoAutenticado } from "../dominio/errores.js";

export const NOMBRE_COOKIE = "compulab_sesion";

export interface OpcionesDeSesionHttp {
  /** Agrega Secure a la cookie; debe estar activo cuando el sitio se sirve por HTTPS. */
  cookieSegura: boolean;
}

export function tokenDeLaSolicitud(solicitud: FastifyRequest): string | null {
  const cabecera = solicitud.headers.cookie ?? "";
  for (const parte of cabecera.split(";")) {
    const [nombre, ...valor] = parte.trim().split("=");
    if (nombre === NOMBRE_COOKIE) return valor.join("=") || null;
  }
  return null;
}

function cookie(token: string, maxAgeSegundos: number, segura: boolean): string {
  return [`${NOMBRE_COOKIE}=${token}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${maxAgeSegundos}`, ...(segura ? ["Secure"] : [])].join("; ");
}

/** Gancho de cada solicitud: deja en solicitud.usuario la sesión vigente, o null. */
export function instalarGanchoDeSesion(app: FastifyInstance, obtenerSesion: ObtenerSesion): void {
  app.addHook("onRequest", async (solicitud) => {
    try {
      solicitud.usuario = await obtenerSesion.ejecutar(tokenDeLaSolicitud(solicitud));
    } catch (error) {
      if (!(error instanceof NoAutenticado)) throw error;
      solicitud.usuario = null;
    }
  });
}

export interface CasosDeSesion {
  iniciarSesion: IniciarSesion;
  cerrarSesion: CerrarSesion;
  /** Solo en la versión de demostración: usuarios para el selector de 15.7. */
  usuariosDeDemostracion: (() => { usuario: string; nombre: string; descripcion: string }[]) | null;
}

export function registrarRutasDeSesion(app: FastifyInstance, casos: CasosDeSesion, opciones: OpcionesDeSesionHttp): void {
  app.post<{ Body: { usuario: string; secreto: string } }>(
    "/api/v1/sesion",
    {
      schema: {
        body: {
          type: "object",
          required: ["usuario", "secreto"],
          additionalProperties: false,
          properties: { usuario: { type: "string", minLength: 1, maxLength: 100 }, secreto: { type: "string", minLength: 1, maxLength: 200 } }
        }
      }
    },
    async (solicitud, respuesta) => {
      const { token, sesion } = await casos.iniciarSesion.ejecutar(solicitud.body.usuario, solicitud.body.secreto);
      respuesta.header("Set-Cookie", cookie(token, DURACION_SESION_MINUTOS * 60, opciones.cookieSegura));
      return respuesta.status(201).send(sesion);
    }
  );

  app.get("/api/v1/sesion", async (solicitud) => {
    if (!solicitud.usuario) throw new NoAutenticado();
    return solicitud.usuario;
  });

  app.delete("/api/v1/sesion", async (solicitud, respuesta) => {
    await casos.cerrarSesion.ejecutar(tokenDeLaSolicitud(solicitud));
    respuesta.header("Set-Cookie", cookie("", 0, opciones.cookieSegura));
    return respuesta.status(204).send();
  });

  const usuarios = casos.usuariosDeDemostracion;
  if (usuarios) {
    app.get("/api/v1/sesion/usuarios-de-demostracion", async () => usuarios());
  }
}
