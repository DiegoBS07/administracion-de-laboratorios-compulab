// Navegación por rol (docs/diseno-ux-ui.md, 15.3 a 15.5).
import { describe, expect, it } from "vitest";
import type { Sesion } from "../compartido/api/tipos";
import { estaActivo, inicioDe, menuDeLaSesion, pestanasDe, puedeVerLaboratorio } from "./navegacion";

const sesion = (...roles: Sesion["roles"]): Sesion => ({ id: "u", nombre: "U", roles });
const ESTUDIANTE = sesion({ rol: "ESTUDIANTE" });
const ASISTENTE = sesion({ rol: "ESTUDIANTE" }, { rol: "ASISTENTE" });
const COORDINADORA = sesion({ rol: "COORDINADOR_LABORATORIO", idLaboratorio: "c1" });
const SOPORTE = sesion({ rol: "COORDINADOR_SOPORTE" });

describe("navegación por rol", () => {
  it("cada rol entra a su pantalla de inicio; con varios roles, a la de mayor responsabilidad", () => {
    expect(inicioDe(ESTUDIANTE)).toBe("/reservar");
    expect(inicioDe(ASISTENTE)).toBe("/mi-turno");
    expect(inicioDe(COORDINADORA)).toBe("/laboratorios/c1/pendientes");
    expect(inicioDe(SOPORTE)).toBe("/panel");
  });

  it("el menú combina los roles sin repetir y con varios roles deja Avisos solo en la campana", () => {
    expect(menuDeLaSesion(ASISTENTE).map((i) => i.ruta)).toEqual(["/mi-turno", "/mis-turnos", "/ofertas", "/reservar", "/mis-reservas", "/postulacion"]);
    expect(menuDeLaSesion(ESTUDIANTE).map((i) => i.ruta)).toContain("/avisos");
  });

  it("en el celular hay como máximo 5 pestañas (N-4)", () => {
    expect(pestanasDe(menuDeLaSesion(SOPORTE)).map((i) => i.ruta)).toEqual(["/panel", "/laboratorios", "/seleccion", "/asistentes", "/mas"]);
    expect(pestanasDe(menuDeLaSesion(COORDINADORA))).toHaveLength(5);
  });

  it("el coordinador de laboratorio solo ve el suyo; el de soporte, todos", () => {
    expect(puedeVerLaboratorio(COORDINADORA, "c1")).toBe(true);
    expect(puedeVerLaboratorio(COORDINADORA, "c2")).toBe(false);
    expect(puedeVerLaboratorio(SOPORTE, "c2")).toBe(true);
    expect(puedeVerLaboratorio(ESTUDIANTE, "c1")).toBe(false);
  });

  it("marca como activo el elemento del menú también en sus subrutas", () => {
    const [, laboratorios] = menuDeLaSesion(SOPORTE);
    expect(laboratorios && estaActivo(laboratorios, "/laboratorios/c2/horario", SOPORTE)).toBe(true);
    const reservar = menuDeLaSesion(ESTUDIANTE)[0];
    expect(reservar && estaActivo(reservar, "/reservar/c1", ESTUDIANTE)).toBe(true);
  });
});
