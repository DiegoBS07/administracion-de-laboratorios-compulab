// Presentador del cierre mensual (CU-14). Humble Object: convierte las respuestas de la API en lo
// que la pantalla muestra (textos, montos, resaltados) y se prueba sin renderizar (FF-1).
import { ErrorDeApi, SinRespuesta } from "../../compartido/api/cliente";
import type { MesDelAnio, ResumenDeCierre } from "../../compartido/api/tipos";
import { diaDelMes, dinero, duracion, fechaDe, hora, MESES, mayuscula, minutosDe, nombreDelMes } from "../../compartido/ui/formato";

export type EstadoDelMes = "CERRADO" | "POR_CERRAR" | "EN_CURSO" | "FUTURO";

export interface MesVista {
  anio: number;
  mes: number;
  nombre: string;
  estado: EstadoDelMes;
  texto: string;
  /** Los meses que no han empezado no llevan a ninguna parte. */
  tieneEnlace: boolean;
}

const TEXTO_DEL_ESTADO: Record<EstadoDelMes, string> = { CERRADO: "Cerrado", POR_CERRAR: "Por cerrar", EN_CURSO: "En curso", FUTURO: "Aún no empieza" };

export const nombreDelMesDelAnio = (anio: number, mes: number) => `${mayuscula(MESES[mes - 1] ?? "")} de ${anio}`;

/** Los 12 meses del año; los que la API no devuelve aún no empiezan. */
export function mesesDelAnio(anio: number, lista: MesDelAnio[]): MesVista[] {
  return Array.from({ length: 12 }, (_, i) => {
    const mes = i + 1;
    const recibido = lista.find((m) => m.anio === anio && m.mes === mes)?.estado;
    const estado: EstadoDelMes = recibido === "CERRADO" || recibido === "POR_CERRAR" || recibido === "EN_CURSO" ? recibido : "FUTURO";
    return { anio, mes, nombre: mayuscula(MESES[i] ?? ""), estado, texto: TEXTO_DEL_ESTADO[estado], tieneEnlace: estado !== "FUTURO" };
  });
}

/** Estado de un mes sin cierre, según la fecha de hoy: terminado → por cerrar; si no, en curso o futuro. */
export function estadoSinCierre(anio: number, mes: number, hoy: string): EstadoDelMes {
  const actual = Number(hoy.slice(0, 4)) * 12 + Number(hoy.slice(5, 7));
  const pedido = anio * 12 + mes;
  return pedido < actual ? "POR_CERRAR" : pedido === actual ? "EN_CURSO" : "FUTURO";
}

export interface LineaVista {
  id: string;
  nombre: string;
  carne: string;
  categoria: string;
  normales: string;
  conRecargo: string;
  noPagadas: string;
  monto: string;
  /** Las horas no pagadas se resaltan: es lo que el coordinador debe atender (RN-24). */
  resaltada: boolean;
  notas: string[];
}

export interface CierreVista {
  total: string;
  subtitulo: string;
  avisoNoPagados: string | null;
  lineas: LineaVista[];
  categorias: string[];
  tarifas: { vigencia: string; valores: string[]; recargo: string }[];
  archivo: { url: string; nombre: string };
}

const horasDeTabla = (minutos: number) => (minutos ? duracion(minutos) : "0 h");
const fechaCorta = (fecha: string) => `${diaDelMes(fecha)} de ${nombreDelMes(fecha)} de ${fecha.slice(0, 4)}`;

export function vistaDelCierre(cierre: ResumenDeCierre): CierreVista {
  const lineas = cierre.lineas.map((l) => ({
    id: l.idAsistente,
    nombre: l.nombre,
    carne: l.carne,
    categoria: l.categoria,
    normales: horasDeTabla(l.minutosNormales),
    conRecargo: horasDeTabla(l.minutosConRecargo),
    noPagadas: horasDeTabla(l.minutosNoPagados),
    monto: dinero(l.montoCentimos),
    resaltada: l.minutosNoPagados > 0,
    notas: l.noPagados.map(
      (n) =>
        `${duracion(n.minutos)} ${n.motivo === "SOBRE_TOPE" ? "sobre su tope" : n.motivo === "MARCA_INCOMPLETA" ? "sin marca de salida" : "sin pagar"} en la semana del ${diaDelMes(n.semana)} de ${nombreDelMes(n.semana)}. No se pagan.`
    )
  }));
  const conNoPagados = lineas.filter((l) => l.resaltada).length;
  const categorias = [...new Set(cierre.tarifasAplicadas.flatMap((t) => Object.keys(t.tarifaPorHoraCentimos)))].sort();
  const fecha = fechaDe(cierre.fechaDeCierre);
  const asistentes = cierre.lineas.length === 1 ? "1 asistente" : `${cierre.lineas.length} asistentes`;
  return {
    total: dinero(cierre.totalCentimos),
    subtitulo: `Total a pagar a ${asistentes}. Cerrado el ${diaDelMes(fecha)} de ${nombreDelMes(fecha)} a las ${hora(minutosDe(cierre.fechaDeCierre))}.`,
    avisoNoPagados: conNoPagados === 0 ? null : `${conNoPagados === 1 ? "1 asistente tiene" : `${conNoPagados} asistentes tienen`} horas que no se pagan. Están resaltados en la tabla.`,
    lineas,
    categorias,
    tarifas: cierre.tarifasAplicadas.map((t) => ({
      vigencia: t.vigenteHasta ? `Del ${fechaCorta(t.vigenteDesde)} al ${fechaCorta(t.vigenteHasta)}` : `Desde el ${fechaCorta(t.vigenteDesde)}`,
      valores: categorias.map((c) => (t.tarifaPorHoraCentimos[c] === undefined ? "—" : dinero(t.tarifaPorHoraCentimos[c] ?? 0))),
      recargo: `${t.porcentajeRecargo} %`
    })),
    archivo: { url: `/api/v1/cierres/${cierre.anio}/${cierre.mes}/archivo`, nombre: `becas-${cierre.anio}-${String(cierre.mes).padStart(2, "0")}.csv` }
  };
}

export interface MensajeDeError {
  titulo: string;
  texto: string;
  /** Ofrecer el enlace a /tarifas (ext 5b). */
  irATarifas?: boolean;
}

/** Mensajes en lenguaje sencillo (N-8), según la tabla del flujo de CU-14 (15.6). */
export function mensajeDeErrorDelCierre(error: unknown): MensajeDeError {
  if (error instanceof ErrorDeApi) {
    switch (error.codigo) {
      case "TARIFA_NO_DEFINIDA": {
        const fecha = typeof error.detalle["fecha"] === "string" ? error.detalle["fecha"] : null;
        const categoria = typeof error.detalle["categoria"] === "string" ? error.detalle["categoria"] : null;
        return {
          titulo: "No se pudo cerrar el mes.",
          texto: `Falta la tarifa${categoria ? ` de la categoría ${categoria}` : ""} vigente${fecha ? ` el ${fechaCorta(fecha)}` : ""}. Regístrala y vuelve a cerrar el mes.`,
          irATarifas: true
        };
      }
      case "MES_NO_TERMINADO":
        return { titulo: "Este mes todavía no termina.", texto: "Se podrá cerrar a partir del día 1 del mes siguiente." };
      case "ERROR_AL_GENERAR_ARCHIVO":
        return { titulo: "No se pudo generar el archivo para Becas.", texto: `El mes no se cerró. Intenta de nuevo; si sigue fallando, reporta el número ${error.idSolicitud ?? ""}.`.trim() };
      default:
        if (error.estado >= 500) return { titulo: "Ocurrió un error inesperado.", texto: `Reporta el número de solicitud ${error.idSolicitud ?? ""}.`.trim() };
        return { titulo: "No se pudo cerrar el mes.", texto: error.message };
    }
  }
  if (error instanceof SinRespuesta) return { titulo: "No llegó la respuesta del servidor.", texto: "Revisa tu conexión e intenta de nuevo; si el mes ya se cerró, verás el mismo resultado." };
  return { titulo: "Ocurrió un error inesperado.", texto: "Intenta de nuevo." };
}
