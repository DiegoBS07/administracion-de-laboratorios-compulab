// Módulo identidad (ADR-0008, ADR-0011): sesión propia de 8 h, roles internos y Directorio caído.
import { beforeEach, describe, expect, it } from "vitest";
import { DatoInvalido, Instante } from "../../../src/compartido/dominio/index.js";
import {
  CerrarSesion,
  CredencialesInvalidas,
  type DirectorioInstitucional,
  DirectorioDeDemostracion,
  DirectorioNoDisponible,
  GeneradorDeTokensAleatorio,
  IniciarSesion,
  NoAutenticado,
  ObtenerSesion,
  RepositorioRolesEnMemoria,
  RepositorioSesionesEnMemoria,
  Sesion,
  SinAccesoACompuLab
} from "../../../src/modulos/identidad/index.js";
import { RelojFijo } from "../../dobles/reloj-fijo.js";

const identidad = (idUsuario: string, esEstudianteDeLaEscuela: boolean) => ({ idUsuario, carne: null, nombre: `Persona ${idUsuario}`, correo: `${idUsuario}@tec.cr`, esEstudianteDeLaEscuela });
const DIRECTORIO = new DirectorioDeDemostracion([
  { usuario: "ana", secreto: "s3creto", identidad: identidad("est-ana", true) },
  { usuario: "marta", secreto: "s3creto", identidad: identidad("coord-c1", false) },
  { usuario: "visitante", secreto: "s3creto", identidad: identidad("otro", false) }
]);
const ROLES = new RepositorioRolesEnMemoria({ "coord-c1": [{ rol: "COORDINADOR_LABORATORIO", idLaboratorio: "c1" }] });

let reloj: RelojFijo;
let sesiones: RepositorioSesionesEnMemoria;
const deps = (directorio: DirectorioInstitucional = DIRECTORIO) => ({ directorio, roles: ROLES, sesiones, tokens: new GeneradorDeTokensAleatorio(), reloj });

beforeEach(() => {
  reloj = new RelojFijo("2026-11-24T08:00:00-06:00");
  sesiones = new RepositorioSesionesEnMemoria();
});

describe("IniciarSesion", () => {
  it("emite una sesión con los roles internos y un token aleatorio", async () => {
    const { token, sesion } = await new IniciarSesion(deps()).ejecutar("marta", "s3creto");

    expect(token).toMatch(/^[\w-]{43}$/);
    expect(sesion).toEqual({ id: "coord-c1", nombre: "Persona coord-c1", roles: [{ rol: "COORDINADOR_LABORATORIO", idLaboratorio: "c1" }] });
  });

  it("da el rol ESTUDIANTE a los estudiantes de la Escuela sin registro previo", async () => {
    const { sesion } = await new IniciarSesion(deps()).ejecutar("ana", "s3creto");

    expect(sesion.roles).toEqual([{ rol: "ESTUDIANTE" }]);
  });

  it("rechaza credenciales incorrectas, usuarios sin roles y falla cerrado si el Directorio no responde", async () => {
    const caido: DirectorioInstitucional = { autenticar: async () => Promise.reject(new DirectorioNoDisponible()) };

    await expect(new IniciarSesion(deps()).ejecutar("ana", "mal")).rejects.toBeInstanceOf(CredencialesInvalidas);
    await expect(new IniciarSesion(deps()).ejecutar("nadie", "s3creto")).rejects.toBeInstanceOf(CredencialesInvalidas);
    await expect(new IniciarSesion(deps()).ejecutar("visitante", "s3creto")).rejects.toBeInstanceOf(SinAccesoACompuLab);
    await expect(new IniciarSesion(deps(caido)).ejecutar("ana", "s3creto")).rejects.toBeInstanceOf(DirectorioNoDisponible);
  });
});

describe("ObtenerSesion y CerrarSesion", () => {
  it("la sesión vence a las 8 horas", async () => {
    const { token } = await new IniciarSesion(deps()).ejecutar("ana", "s3creto");
    const obtener = new ObtenerSesion(deps());

    reloj.avanzarMinutos(8 * 60 - 1);
    expect((await obtener.ejecutar(token)).id).toBe("est-ana");
    reloj.avanzarMinutos(1);
    await expect(obtener.ejecutar(token)).rejects.toBeInstanceOf(NoAutenticado);
  });

  it("sin token, con un token desconocido o después de cerrar sesión lanza NoAutenticado", async () => {
    const { token } = await new IniciarSesion(deps()).ejecutar("ana", "s3creto");
    const obtener = new ObtenerSesion(deps());

    await new CerrarSesion(deps()).ejecutar(token);

    await expect(obtener.ejecutar(null)).rejects.toBeInstanceOf(NoAutenticado);
    await expect(obtener.ejecutar("x".repeat(43))).rejects.toBeInstanceOf(NoAutenticado);
    await expect(obtener.ejecutar(token)).rejects.toBeInstanceOf(NoAutenticado);
  });
});

describe("Sesion", () => {
  const ahora = Instante.desdeISO("2026-11-24T08:00:00-06:00");
  const base = { token: "t".repeat(43), idUsuario: "u", nombre: "U", ahora };

  it("rechaza tokens cortos, sesiones sin roles y coordinadores sin laboratorio", () => {
    expect(() => Sesion.iniciar({ ...base, token: "corto", roles: [{ rol: "ESTUDIANTE" }] })).toThrow(DatoInvalido);
    expect(() => Sesion.iniciar({ ...base, roles: [] })).toThrow(DatoInvalido);
    expect(() => Sesion.iniciar({ ...base, roles: [{ rol: "COORDINADOR_LABORATORIO" }] })).toThrow(DatoInvalido);
  });
});
