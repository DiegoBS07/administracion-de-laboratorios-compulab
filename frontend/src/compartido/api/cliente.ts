// Cliente HTTP de la API (docs/08-componentes.md, 8.7). Toda llamada al backend pasa por aquí:
// traduce el formato de error común a ErrorDeApi y, en las operaciones que crean, reintenta con la
// misma Idempotency-Key cuando la respuesta no llega (ADR-0010).

/** Error con el formato de 8.7: { codigo, mensaje, detalle, idSolicitud }. */
export class ErrorDeApi extends Error {
  readonly estado: number;
  readonly codigo: string;
  readonly detalle: Record<string, unknown>;
  readonly idSolicitud: string | null;

  constructor(estado: number, codigo: string, mensaje: string, detalle: Record<string, unknown> = {}, idSolicitud: string | null = null) {
    super(mensaje);
    this.name = "ErrorDeApi";
    this.estado = estado;
    this.codigo = codigo;
    this.detalle = detalle;
    this.idSolicitud = idSolicitud;
  }
}

/** La respuesta no llegó ni después de reintentar. */
export class SinRespuesta extends Error {
  constructor() {
    super("El servidor no respondió.");
    this.name = "SinRespuesta";
  }
}

export interface Respuesta<T> {
  estado: number;
  datos: T;
}

export interface OpcionesDePedido {
  cuerpo?: unknown;
  /** Idempotency-Key: se genera una vez por intención del usuario y se reutiliza en cada reintento. */
  clave?: string;
  /** Avisa a la pantalla que se está reintentando (para mostrar "Reintentando…"). */
  alReintentar?: () => void;
}

type Pedir = (entrada: string, init: RequestInit) => Promise<Response>;

const ESPERAS_DE_REINTENTO_MS = [600, 1500];
const ESTADOS_TRANSITORIOS = new Set([502, 503, 504]);

export interface ClienteApi {
  get<T>(ruta: string): Promise<Respuesta<T>>;
  post<T>(ruta: string, opciones?: OpcionesDePedido): Promise<Respuesta<T>>;
  delete(ruta: string): Promise<void>;
  /** Se llama ante un 401 en cualquier operación salvo las de sesión. */
  alPerderSesion: (() => void) | null;
}

export function crearClienteApi(pedir: Pedir = (e, i) => fetch(e, i), esperar = (ms: number) => new Promise((r) => setTimeout(r, ms))): ClienteApi {
  const cliente: ClienteApi = {
    alPerderSesion: null,
    get: (ruta) => enviar("GET", ruta, {}),
    post: (ruta, opciones = {}) => enviar("POST", ruta, opciones),
    delete: async (ruta) => {
      await enviar("DELETE", ruta, {});
    }
  };

  async function enviar<T>(metodo: string, ruta: string, opciones: OpcionesDePedido): Promise<Respuesta<T>> {
    const cabeceras: Record<string, string> = { accept: "application/json" };
    if (opciones.cuerpo !== undefined) cabeceras["content-type"] = "application/json";
    if (opciones.clave) cabeceras["idempotency-key"] = opciones.clave;
    const init: RequestInit = {
      method: metodo,
      headers: cabeceras,
      credentials: "same-origin",
      ...(opciones.cuerpo !== undefined ? { body: JSON.stringify(opciones.cuerpo) } : {})
    };

    // Solo se reintenta lo que es seguro repetir: lecturas y operaciones con clave de solicitud.
    const reintentable = metodo === "GET" || Boolean(opciones.clave);
    for (let intento = 0; ; intento++) {
      let respuesta: Response;
      try {
        respuesta = await pedir(ruta, init);
      } catch {
        if (reintentable && intento < ESPERAS_DE_REINTENTO_MS.length) {
          opciones.alReintentar?.();
          await esperar(ESPERAS_DE_REINTENTO_MS[intento] ?? 0);
          continue;
        }
        throw new SinRespuesta();
      }
      if (ESTADOS_TRANSITORIOS.has(respuesta.status) && reintentable && intento < ESPERAS_DE_REINTENTO_MS.length) {
        opciones.alReintentar?.();
        await esperar(ESPERAS_DE_REINTENTO_MS[intento] ?? 0);
        continue;
      }
      return interpretar<T>(respuesta, ruta);
    }
  }

  async function interpretar<T>(respuesta: Response, ruta: string): Promise<Respuesta<T>> {
    const texto = await respuesta.text();
    const cuerpo: unknown = texto && (respuesta.headers.get("content-type") ?? "").includes("json") ? JSON.parse(texto) : texto;
    if (respuesta.ok) return { estado: respuesta.status, datos: cuerpo as T };

    const error = cuerpo as Partial<{ codigo: string; mensaje: string; detalle: Record<string, unknown>; idSolicitud: string }>;
    const errorDeApi = new ErrorDeApi(
      respuesta.status,
      error?.codigo ?? "ERROR_INTERNO",
      error?.mensaje ?? "Ocurrió un error inesperado.",
      error?.detalle ?? {},
      error?.idSolicitud ?? respuesta.headers.get("x-request-id")
    );
    if (respuesta.status === 401 && !ruta.startsWith("/api/v1/sesion")) cliente.alPerderSesion?.();
    throw errorDeApi;
  }

  return cliente;
}

/** Idempotency-Key nueva (UUID), una por intención del usuario. */
export function nuevaClave(): string {
  return crypto.randomUUID();
}

export const api = crearClienteApi();
