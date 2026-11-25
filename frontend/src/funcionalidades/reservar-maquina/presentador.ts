// Presentador de "Reservar una máquina" (CU-11, docs/diseno-ux-ui.md 15.6). Previene los errores en
// lugar de mostrarlos (N-7): solo ofrece días del horizonte, horas dentro de franjas abiertas,
// duraciones posibles y máquinas libres. La decisión final la toma siempre el backend.
import { ErrorDeApi, SinRespuesta } from "../../compartido/api/cliente";
import type { Disponibilidad, Franja, Laboratorio, MisReservas, ReservaDelEstudiante } from "../../compartido/api/tipos";
import { DIAS_CORTOS, diaDeLaSemana, diaDelMes, duracion, fechaDe, fechaLarga, hora, minutosDe, nombreDelMes, sumarDias } from "../../compartido/ui/formato";

/** RN-16: hoy y los 6 días siguientes. */
export const DIAS_DE_ANTICIPACION = 6;
/** RN-18 y política de reservas del backend. */
export const DURACIONES_MINUTOS = [30, 60, 90, 120];
export const PASO_DE_INICIO_MINUTOS = 30;
export const TOLERANCIA_PRESENTACION_MINUTOS = 15;

interface Tramo {
  ini: number;
  fin: number;
}

const tramos = (franjas: Franja[], fecha: string): Tramo[] => franjas.map((f) => ({ ini: minutosDe(f.inicio, fecha), fin: minutosDe(f.fin, fecha) }));
const seTraslapan = (a: Tramo, b: Tramo) => a.ini < b.fin && b.ini < a.fin;

export const sedesDe = (laboratorios: Laboratorio[]) => [...new Set(laboratorios.map((l) => l.campus))].sort();

/** "de 7:00 a 15:00 y de 17:00 a 21:00". */
export function textoDeFranjas(franjas: Franja[], fecha: string): string {
  return tramos(franjas, fecha)
    .map((t) => `de ${hora(t.ini)} a ${hora(t.fin)}`)
    .join(" y ");
}

export interface DiaOfrecido {
  fecha: string;
  etiqueta: string;
  detalle: string;
  cerrado: boolean;
}

/** Los 7 días que se pueden reservar; un día sin laboratorios abiertos en la sede se marca cerrado. */
export function diasOfrecidos(hoy: string, abiertoPorFecha: ReadonlyMap<string, boolean>): DiaOfrecido[] {
  return Array.from({ length: DIAS_DE_ANTICIPACION + 1 }, (_, i) => {
    const fecha = sumarDias(hoy, i);
    const cerrado = abiertoPorFecha.get(fecha) === false;
    return {
      fecha,
      etiqueta: i === 0 ? "Hoy" : (DIAS_CORTOS[diaDeLaSemana(fecha)] ?? ""),
      detalle: cerrado ? "cerrado" : `${diaDelMes(fecha)} ${nombreDelMes(fecha).slice(0, 3)}`,
      cerrado
    };
  });
}

export interface TarjetaDeLaboratorio {
  id: string;
  nombre: string;
  abierto: boolean;
  horario: string;
  maquinas: string;
}

export function tarjetaDeLaboratorio(laboratorio: Laboratorio, disponibilidad: Disponibilidad): TarjetaDeLaboratorio {
  const enServicio = disponibilidad.maquinas.filter((m) => m.estado === "EN_SERVICIO").length;
  const abierto = disponibilidad.franjasAbiertas.length > 0;
  return {
    id: laboratorio.id,
    nombre: laboratorio.nombre,
    abierto,
    horario: abierto ? `Abierto ${textoDeFranjas(disponibilidad.franjasAbiertas, disponibilidad.fecha)}` : "Cerrado este día",
    maquinas: `${enServicio} de ${disponibilidad.maquinas.length} máquinas en servicio`
  };
}

// ---------- Cupo semanal (RN-17) ----------

export const minutosRestantes = (mias: MisReservas) => Math.max(0, mias.limiteSemanalMinutos - mias.minutosReservadosSemana);

export function textoDelCupo(mias: MisReservas): string {
  const restante = minutosRestantes(mias);
  const usados = mias.minutosReservadosSemana ? duracion(mias.minutosReservadosSemana) : "0 h";
  const limite = duracion(mias.limiteSemanalMinutos);
  return `Esta semana has reservado ${usados}. ${restante ? `Te quedan ${duracion(restante)} de las ${limite} permitidas.` : `Ya usaste las ${limite} permitidas.`}`;
}

export function textoDeReserva(reserva: ReservaDelEstudiante, laboratorios: Laboratorio[]): string {
  const fecha = fechaDe(reserva.inicio);
  const lab = laboratorios.find((l) => l.id === reserva.idLaboratorio)?.nombre;
  return `${reserva.codigoMaquina}${lab ? `, ${lab}` : ""}, ${fechaLarga(fecha)} de ${hora(minutosDe(reserva.inicio))} a ${hora(minutosDe(reserva.fin, fecha))}`;
}

export interface AvisoDeCupo {
  titulo: string;
  texto: string;
  tipo: "activa" | "agotado";
}

/** Se dice arriba antes de ofrecer máquinas, en lugar de mostrarlo como error (ext 6a y 6b). */
export function avisoDeCupo(mias: MisReservas, laboratorios: Laboratorio[]): AvisoDeCupo | null {
  if (mias.activa) {
    return {
      tipo: "activa",
      titulo: `Ya tienes una reserva activa: ${textoDeReserva(mias.activa, laboratorios)}.`,
      texto: "Solo se permite una reserva a la vez. Podrás hacer otra cuando termine."
    };
  }
  if (minutosRestantes(mias) === 0) {
    return { tipo: "agotado", titulo: `Ya usaste tus ${duracion(mias.limiteSemanalMinutos)} de esta semana.`, texto: "El lunes vuelves a tener horas disponibles." };
  }
  return null;
}

// ---------- Hora, duración y plano ----------

/** Horas de inicio cada 30 minutos dentro de las franjas abiertas; si es hoy, solo las que no han pasado. */
export function iniciosPosibles(disponibilidad: Disponibilidad, ahora: string): number[] {
  const esHoy = fechaDe(ahora) === disponibilidad.fecha;
  const ahoraMin = esHoy ? minutosDe(ahora) : -1;
  return tramos(disponibilidad.franjasAbiertas, disponibilidad.fecha).flatMap((t) => {
    const inicios: number[] = [];
    for (let m = t.ini; m <= t.fin - PASO_DE_INICIO_MINUTOS; m += PASO_DE_INICIO_MINUTOS) if (m > ahoraMin) inicios.push(m);
    return inicios;
  });
}

export interface OpcionDeDuracion {
  minutos: number;
  texto: string;
  habilitada: boolean;
  razon: string | null;
}

export function duracionesPosibles(disponibilidad: Disponibilidad, inicio: number | null, restante: number, tieneActiva: boolean): OpcionDeDuracion[] {
  const tramo = inicio === null ? undefined : tramos(disponibilidad.franjasAbiertas, disponibilidad.fecha).find((t) => inicio >= t.ini && inicio < t.fin);
  return DURACIONES_MINUTOS.map((minutos) => {
    let razon: string | null = null;
    if (tramo && inicio !== null && inicio + minutos > tramo.fin) razon = "cierra antes";
    else if (inicio !== null && minutos > restante) razon = "pasa tus 6 h";
    return { minutos, texto: duracion(minutos), habilitada: Boolean(tramo) && razon === null && !tieneActiva, razon };
  });
}

export type EstadoDelPuesto = "libre" | "ocupada" | "fuera" | "espera";

export interface Puesto {
  id: string;
  codigo: string;
  estado: EstadoDelPuesto;
  elegida: boolean;
  habilitado: boolean;
  etiqueta: string;
}

const ETIQUETA: Record<EstadoDelPuesto, string> = { libre: ", libre", ocupada: ", reservada en ese horario", fuera: ", fuera de servicio", espera: "" };

/**
 * Plano del laboratorio en filas de 4 (dos puestos, pasillo, dos puestos). Primero se elige la hora:
 * así solo se ofrecen las máquinas libres en ese horario (15.6).
 */
export function planoDelLaboratorio(disponibilidad: Disponibilidad, inicio: number | null, minutos: number | null, elegida: string | null, tieneActiva: boolean): Puesto[][] {
  const pedido = inicio !== null && minutos !== null ? { ini: inicio, fin: inicio + minutos } : null;
  const puestos = disponibilidad.maquinas.map((m): Puesto => {
    const ocupada = pedido !== null && tramos(m.reservas, disponibilidad.fecha).some((r) => seTraslapan(r, pedido));
    const estado: EstadoDelPuesto = m.estado !== "EN_SERVICIO" ? "fuera" : !pedido ? "espera" : ocupada ? "ocupada" : "libre";
    return { id: m.id, codigo: m.codigo, estado, elegida: m.id === elegida, habilitado: estado === "libre" && !tieneActiva, etiqueta: m.codigo + ETIQUETA[estado] };
  });
  const filas: Puesto[][] = [];
  for (let i = 0; i < puestos.length; i += 4) filas.push(puestos.slice(i, i + 4));
  return filas;
}

export interface Confirmacion {
  codigo: string;
  laboratorio: string;
  dia: string;
  horario: string;
  limite: string;
  quedan: string;
}

export function confirmacion(codigo: string, laboratorio: string, fecha: string, inicio: number, minutos: number, restante: number): Confirmacion {
  return {
    codigo,
    laboratorio,
    dia: fechaLarga(fecha),
    horario: `De ${hora(inicio)} a ${hora(inicio + minutos)}`,
    limite: hora(inicio + TOLERANCIA_PRESENTACION_MINUTOS),
    quedan: duracion(Math.max(0, restante - minutos))
  };
}

// ---------- Errores (tabla de 15.6) ----------

export type AccionDeError = "otra-maquina" | "ver-franjas" | "mis-reservas" | "acortar" | "elegir-horario" | "reintentar";

export interface MensajeDeError {
  titulo: string;
  texto: string;
  accion: AccionDeError;
}

export function mensajeDeErrorDeReserva(error: unknown): MensajeDeError {
  if (error instanceof ErrorDeApi) {
    switch (error.codigo) {
      case "MAQUINA_NO_DISPONIBLE":
        return { titulo: "Alguien acaba de reservar esa máquina para ese horario.", texto: "Elige otra máquina; la lista ya está actualizada.", accion: "otra-maquina" };
      case "MAQUINA_FUERA_DE_SERVICIO":
        return { titulo: "Esa máquina se acaba de reportar dañada.", texto: "Elige otra máquina.", accion: "otra-maquina" };
      case "LABORATORIO_CERRADO_EN_FRANJA":
        return { titulo: "El laboratorio no estará abierto durante todo ese horario.", texto: "Revisa las franjas abiertas y elige otra hora.", accion: "ver-franjas" };
      case "YA_TIENE_RESERVA_ACTIVA":
        return { titulo: "Ya tienes una reserva activa.", texto: "Solo se permite una a la vez.", accion: "mis-reservas" };
      case "LIMITE_SEMANAL_DE_RESERVA_EXCEDIDO": {
        const reservados = Number(error.detalle["minutosReservados"] ?? NaN);
        const limite = Number(error.detalle["limiteSemanalMinutos"] ?? NaN);
        const quedan = Number.isFinite(reservados) && Number.isFinite(limite) ? `; te quedan ${duracion(Math.max(0, limite - reservados))}` : "";
        return { titulo: "Con esta reserva pasarías de 6 horas esta semana.", texto: `Acorta la reserva${quedan}.`, accion: "acortar" };
      }
      case "RESERVA_EXCEDE_DURACION":
      case "FRANJA_DE_RESERVA_INVALIDA":
      case "FUERA_DE_HORIZONTE_DE_RESERVA":
        return { titulo: "Revisa el horario elegido.", texto: "Vuelve a elegir la hora y la duración.", accion: "elegir-horario" };
      default:
        if (error.estado >= 500) return { titulo: "Ocurrió un error inesperado.", texto: `Reporta el número de solicitud ${error.idSolicitud ?? ""}.`.trim(), accion: "reintentar" };
        return { titulo: "No se pudo hacer la reserva.", texto: error.message, accion: "reintentar" };
    }
  }
  if (error instanceof SinRespuesta) {
    return { titulo: "No llegó la respuesta del servidor.", texto: "Intenta de nuevo: si la reserva ya se hizo, no se duplicará.", accion: "reintentar" };
  }
  return { titulo: "Ocurrió un error inesperado.", texto: "Intenta de nuevo.", accion: "reintentar" };
}
