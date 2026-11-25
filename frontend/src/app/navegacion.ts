// Navegación por rol (docs/diseno-ux-ui.md, 15.3 a 15.5). Lógica pura: se prueba sin renderizar.
import type { Rol, Sesion } from "../compartido/api/tipos";

export interface ItemDeMenu {
  ruta: string;
  texto: string;
  /** Texto corto para la barra de pestañas del celular. */
  corto?: string;
  icono: string;
  seccion?: string;
}

export const NOMBRE_ROL: Record<Rol, string> = {
  ESTUDIANTE: "Estudiante",
  ASISTENTE: "Asistente",
  COORDINADOR_LABORATORIO: "Coordinación de laboratorio",
  COORDINADOR_SOPORTE: "Coordinación de soporte"
};

/** Un usuario con varios roles entra al inicio del de mayor responsabilidad (15.3). */
const PRIORIDAD: Rol[] = ["COORDINADOR_SOPORTE", "COORDINADOR_LABORATORIO", "ASISTENTE", "ESTUDIANTE"];

function menuDe(rol: Rol, idLaboratorio: string | undefined): ItemDeMenu[] {
  switch (rol) {
    case "ESTUDIANTE":
      return [
        { ruta: "/reservar", texto: "Reservar", icono: "reservar" },
        { ruta: "/mis-reservas", texto: "Mis reservas", icono: "lista" },
        { ruta: "/postulacion", texto: "Postulación", icono: "postulacion" },
        { ruta: "/avisos", texto: "Avisos", icono: "campana" }
      ];
    case "ASISTENTE":
      return [
        { ruta: "/mi-turno", texto: "Mi turno", icono: "reloj" },
        { ruta: "/mis-turnos", texto: "Mis turnos", icono: "calendario" },
        { ruta: "/ofertas", texto: "Ofertas", icono: "intercambio" },
        { ruta: "/reservar", texto: "Reservar", icono: "reservar" },
        { ruta: "/mis-reservas", texto: "Mis reservas", icono: "lista" }
      ];
    case "COORDINADOR_LABORATORIO": {
      const base = `/laboratorios/${idLaboratorio ?? ""}`;
      return [
        { ruta: `${base}/pendientes`, texto: "Pendientes", icono: "inicio" },
        { ruta: `${base}/horario`, texto: "Horario", icono: "calendario" },
        { ruta: `${base}/cambios`, texto: "Cambios por aprobar", corto: "Cambios", icono: "cambios" },
        { ruta: `${base}/cobertura`, texto: "Cobertura", icono: "cobertura" },
        { ruta: `${base}/maquinas`, texto: "Máquinas", icono: "maquinas" }
      ];
    }
    case "COORDINADOR_SOPORTE":
      return [
        { ruta: "/panel", texto: "Panel", icono: "inicio" },
        { ruta: "/laboratorios", texto: "Laboratorios", icono: "laboratorios", seccion: "Operación" },
        { ruta: "/seleccion", texto: "Selección de asistentes", corto: "Selección", icono: "seleccion", seccion: "Operación" },
        { ruta: "/asistentes", texto: "Asistentes", icono: "personas", seccion: "Operación" },
        { ruta: "/cierres", texto: "Cierre mensual", corto: "Cierres", icono: "cierre", seccion: "Pagos" },
        { ruta: "/tarifas", texto: "Tarifas", icono: "tarifas", seccion: "Pagos" },
        { ruta: "/uso-de-maquinas", texto: "Uso de máquinas", corto: "Uso", icono: "uso", seccion: "Informes" }
      ];
    default:
      return [];
  }
}

export const tieneRol = (sesion: Sesion, ...roles: Rol[]) => sesion.roles.some((r) => roles.includes(r.rol));

/** Laboratorio que coordina, si es coordinador de laboratorio. */
export const laboratorioDe = (sesion: Sesion) => sesion.roles.find((r) => r.rol === "COORDINADOR_LABORATORIO")?.idLaboratorio;

export function rolPrincipal(sesion: Sesion): Rol | undefined {
  return PRIORIDAD.find((r) => tieneRol(sesion, r));
}

/** Menú combinado de todos sus roles, sin repetir (SUP-20). Con varios roles, Avisos queda solo en la campana (N-4). */
export function menuDeLaSesion(sesion: Sesion): ItemDeMenu[] {
  const vistos = new Set<string>();
  const items: ItemDeMenu[] = [];
  for (const rol of PRIORIDAD) {
    if (!tieneRol(sesion, rol)) continue;
    for (const item of menuDe(rol, laboratorioDe(sesion))) {
      if (vistos.has(item.ruta)) continue;
      vistos.add(item.ruta);
      items.push(item);
    }
  }
  return sesion.roles.length > 1 ? items.filter((i) => i.ruta !== "/avisos") : items;
}

/** Pestañas del celular: como máximo 5; si hay más, 4 y "Más" (N-4). */
export function pestanasDe(menu: ItemDeMenu[]): ItemDeMenu[] {
  return menu.length > 5 ? [...menu.slice(0, 4), { ruta: "/mas", texto: "Más", icono: "mas" }] : menu;
}

export function inicioDe(sesion: Sesion): string {
  switch (rolPrincipal(sesion)) {
    case "COORDINADOR_SOPORTE":
      return "/panel";
    case "COORDINADOR_LABORATORIO":
      return `/laboratorios/${laboratorioDe(sesion) ?? ""}/pendientes`;
    case "ASISTENTE":
      return "/mi-turno";
    default:
      return "/reservar";
  }
}

/** El coordinador de soporte entra a cualquier laboratorio; el de laboratorio, solo al suyo (15.5). */
export function puedeVerLaboratorio(sesion: Sesion, idLaboratorio: string): boolean {
  return tieneRol(sesion, "COORDINADOR_SOPORTE") || laboratorioDe(sesion) === idLaboratorio;
}

/** El elemento del menú que corresponde a la ruta actual (también para sus subrutas). */
export function estaActivo(item: ItemDeMenu, ruta: string, sesion: Sesion): boolean {
  if (ruta === item.ruta) return true;
  if (item.ruta === "/reservar" && ruta.startsWith("/reservar/")) return true;
  if (item.ruta === "/cierres" && ruta.startsWith("/cierres/")) return true;
  return item.ruta === "/laboratorios" && ruta.startsWith("/laboratorios/") && tieneRol(sesion, "COORDINADOR_SOPORTE");
}

export const textoDeRoles = (sesion: Sesion) => sesion.roles.map((r) => NOMBRE_ROL[r.rol]).join(" y ");
