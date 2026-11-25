// Pruebas de las funciones de aptitud (docs/07-arquitectura.md, 7.5).
// Cada prueba arma un src/ de juguete con una violación plantada a propósito, ejecuta la misma
// línea de comandos que usan `npm test` y `npm run build`, y exige que la regla la encuentre.
import { afterAll, describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const ejecutar = promisify(execFile);
const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CLI = join(RAIZ, "node_modules/dependency-cruiser/bin/dependency-cruiser.mjs");
const CONFIG = join(RAIZ, ".dependency-cruiser.cjs");
// Dentro de backend/ (para resolver los paquetes instalados como lo hace src/), ignorada por git y Docker.
const BASE_TEMPORAL = join(RAIZ, ".aptitud-tmp");

type Archivos = Record<string, string>;
interface Violacion { regla: string; desde: string; hacia: string }

const carpetas: string[] = [];
afterAll(async () => {
  await Promise.all(carpetas.map((c) => rm(c, { recursive: true, force: true })));
});

/** Un proyecto mínimo que cumple todas las reglas; cada prueba le agrega su violación. */
const LIMPIO: Archivos = {
  "src/compartido/dominio/franja.ts": "export const MINUTOS_POR_HORA = 60;\n",
  "src/modulos/horarios/dominio/turno.ts":
    'import { MINUTOS_POR_HORA } from "../../../compartido/dominio/franja.js";\nexport const duracion = 4 * MINUTOS_POR_HORA;\n',
  "src/modulos/horarios/aplicacion/asignar-turno.ts":
    'import { duracion } from "../dominio/turno.js";\nexport interface RepositorioTurnos { guardar(m: number): void }\nexport const asignar = (r: RepositorioTurnos) => r.guardar(duracion);\n',
  "src/modulos/horarios/infraestructura/repositorio-en-memoria.ts":
    'import type { RepositorioTurnos } from "../aplicacion/asignar-turno.js";\nexport const repo: RepositorioTurnos = { guardar: () => undefined };\n',
  "src/modulos/reservas/dominio/reserva.ts": "export const MAXIMO_MINUTOS = 120;\n",
  "src/arranque/servidor.ts":
    'import { asignar } from "../modulos/horarios/aplicacion/asignar-turno.js";\nimport { repo } from "../modulos/horarios/infraestructura/repositorio-en-memoria.js";\nimport { MAXIMO_MINUTOS } from "../modulos/reservas/dominio/reserva.js";\nasignar(repo);\nexport const maximo = MAXIMO_MINUTOS;\n'
};

async function armarProyecto(extra: Archivos): Promise<string> {
  await mkdir(BASE_TEMPORAL, { recursive: true });
  const carpeta = await mkdtemp(join(BASE_TEMPORAL, "aptitud-"));
  carpetas.push(carpeta);
  const archivos: Archivos = {
    ...LIMPIO,
    ...extra,
    "tsconfig.json": JSON.stringify({ compilerOptions: { module: "NodeNext", moduleResolution: "NodeNext", strict: true } })
  };
  for (const [ruta, contenido] of Object.entries(archivos)) {
    await mkdir(dirname(join(carpeta, ruta)), { recursive: true });
    await writeFile(join(carpeta, ruta), contenido);
  }
  return carpeta;
}

/** Ejecuta las funciones de aptitud como lo hace el build y devuelve las violaciones. */
async function violacionesEn(carpeta: string): Promise<Violacion[]> {
  const { stdout } = await ejecutar(process.execPath, [CLI, "src", "--config", CONFIG, "--output-type", "json"], { cwd: carpeta });
  const resultado = JSON.parse(stdout) as { summary: { violations: { rule: { name: string }; from: string; to: string }[] } };
  return resultado.summary.violations.map((v) => ({ regla: v.rule.name, desde: v.from, hacia: v.to }));
}

/** Código de salida con el reporte por omisión: distinto de 0 hace fallar npm test y npm run build. */
async function codigoDeSalida(carpeta: string): Promise<number> {
  try {
    await ejecutar(process.execPath, [CLI, "src", "--config", CONFIG], { cwd: carpeta });
    return 0;
  } catch (error) {
    return (error as { code: number }).code;
  }
}

const reglas = (v: Violacion[]) => v.map((x) => x.regla);

describe("funciones de aptitud", () => {
  it("el código real de src/ no viola ninguna regla", async () => {
    expect(await violacionesEn(RAIZ)).toEqual([]);
  });

  it("un proyecto que respeta la arquitectura no tiene violaciones y no rompe el build", async () => {
    const carpeta = await armarProyecto({});
    expect(await violacionesEn(carpeta)).toEqual([]);
    expect(await codigoDeSalida(carpeta)).toBe(0);
  });

  describe("FA-1 · el dominio es puro", () => {
    it("detecta un dominio que importa la infraestructura", async () => {
      const carpeta = await armarProyecto({
        "src/modulos/horarios/dominio/turno.ts":
          'import { repo } from "../infraestructura/repositorio-en-memoria.js";\nexport const duracion = 240;\nexport const usado = repo;\n'
      });
      expect(reglas(await violacionesEn(carpeta))).toContain("FA-1-dominio-sin-capas-externas");
    });

    it("detecta un dominio que importa un paquete de node_modules", async () => {
      const carpeta = await armarProyecto({
        "src/compartido/dominio/franja.ts": 'import { describe } from "vitest";\nexport const MINUTOS_POR_HORA = 60;\nexport const d = describe;\n'
      });
      expect(reglas(await violacionesEn(carpeta))).toContain("FA-1-dominio-sin-paquetes");
    });

    it("detecta un dominio que usa un módulo nativo de Node", async () => {
      const carpeta = await armarProyecto({
        "src/modulos/reservas/dominio/reserva.ts": 'import { readFileSync } from "node:fs";\nexport const MAXIMO_MINUTOS = 120;\nexport const leer = readFileSync;\n'
      });
      expect(reglas(await violacionesEn(carpeta))).toContain("FA-1-dominio-sin-modulos-nativos");
    });

    it("una violación rompe el build (código de salida distinto de 0)", async () => {
      const carpeta = await armarProyecto({
        "src/modulos/horarios/dominio/turno.ts": 'import { readFileSync } from "node:fs";\nexport const duracion = 240;\nexport const leer = readFileSync;\n'
      });
      expect(await codigoDeSalida(carpeta)).not.toBe(0);
    });
  });

  describe("FA-2 · los módulos no se conocen entre sí", () => {
    it("detecta un módulo que importa el interior de otro", async () => {
      const carpeta = await armarProyecto({
        "src/modulos/reservas/aplicacion/reservar-maquina.ts":
          'import { duracion } from "../../horarios/dominio/turno.js";\nexport const usar = duracion;\n'
      });
      const encontradas = await violacionesEn(carpeta);
      expect(encontradas).toContainEqual({
        regla: "FA-2-modulos-aislados",
        desde: "src/modulos/reservas/aplicacion/reservar-maquina.ts",
        hacia: "src/modulos/horarios/dominio/turno.ts"
      });
    });

    it("permite que src/arranque/ conecte varios módulos", async () => {
      const carpeta = await armarProyecto({});
      expect(reglas(await violacionesEn(carpeta))).not.toContain("FA-2-modulos-aislados");
    });
  });

  describe("FA-3 · la aplicación no depende de la infraestructura", () => {
    it("detecta un caso de uso que importa un adaptador", async () => {
      const carpeta = await armarProyecto({
        "src/modulos/horarios/aplicacion/consultar-horario.ts":
          'import { repo } from "../infraestructura/repositorio-en-memoria.js";\nexport const consultar = () => repo;\n'
      });
      expect(reglas(await violacionesEn(carpeta))).toContain("FA-3-aplicacion-sin-infraestructura");
    });
  });

  describe("FA-5 · la aplicación no importa paquetes", () => {
    it("detecta un caso de uso que importa un paquete de node_modules", async () => {
      const carpeta = await armarProyecto({
        "src/modulos/horarios/aplicacion/consultar-horario.ts": 'import { describe } from "vitest";\nexport const consultar = describe;\n'
      });
      expect(reglas(await violacionesEn(carpeta))).toContain("FA-5-aplicacion-sin-paquetes");
    });

    it("permite que la infraestructura use paquetes", async () => {
      const carpeta = await armarProyecto({
        "src/modulos/horarios/infraestructura/repositorio-sql.ts": 'import { describe } from "vitest";\nexport const repo = describe;\n'
      });
      expect(reglas(await violacionesEn(carpeta))).not.toContain("FA-5-aplicacion-sin-paquetes");
    });
  });

  describe("FA-4 · no hay ciclos", () => {
    it("detecta dos archivos que se importan mutuamente", async () => {
      const carpeta = await armarProyecto({
        "src/arranque/a.ts": 'import { b } from "./b.js";\nexport const a = () => b;\n',
        "src/arranque/b.ts": 'import { a } from "./a.js";\nexport const b = () => a;\n'
      });
      expect(reglas(await violacionesEn(carpeta))).toContain("FA-4-sin-ciclos");
    });
  });
});
