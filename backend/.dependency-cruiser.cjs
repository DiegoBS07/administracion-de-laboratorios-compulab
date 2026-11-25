/**
 * Funciones de aptitud de CompuLab (docs/07-arquitectura.md, 7.5).
 * Se ejecutan con `npm run aptitud`, antes de las pruebas y antes del build:
 * si alguna regla se viola, el build falla (R-9).
 */

// Cualquier dependencia que venga de node_modules.
const PAQUETES = ["npm", "npm-dev", "npm-optional", "npm-peer", "npm-bundled", "npm-no-pkg", "npm-unknown"];

const DOMINIO = "^src/(modulos/[^/]+|compartido)/dominio/";

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "FA-1-dominio-sin-capas-externas",
      comment:
        "FA-1 · El dominio es puro: no importa aplicacion/, infraestructura/, arranque/ ni tareas-programadas/ (QA-6, R-6).",
      severity: "error",
      from: { path: DOMINIO },
      to: { path: "^src/(modulos/[^/]+/(aplicacion|infraestructura)|arranque|tareas-programadas)/" }
    },
    {
      name: "FA-1-dominio-sin-paquetes",
      comment: "FA-1 · El dominio no importa paquetes de node_modules (frameworks, bases de datos, librerías).",
      severity: "error",
      from: { path: DOMINIO },
      to: { dependencyTypes: PAQUETES }
    },
    {
      name: "FA-1-dominio-sin-modulos-nativos",
      comment: "FA-1 · El dominio no usa módulos nativos de Node (fs, http, crypto…): ni red, ni archivos, ni reloj real.",
      severity: "error",
      from: { path: DOMINIO },
      to: { dependencyTypes: ["core"] }
    },
    {
      name: "FA-2-modulos-aislados",
      comment:
        "FA-2 · Un módulo no importa a otro módulo; solo src/arranque/ los conecta mediante sus interfaces (ADR-0001).",
      severity: "error",
      from: { path: "^src/modulos/([^/]+)/" },
      to: { path: "^src/modulos/", pathNot: "^src/modulos/$1/" }
    },
    {
      name: "FA-3-aplicacion-sin-infraestructura",
      comment: "FA-3 · La capa de aplicación no depende de la infraestructura: la usa a través de puertos.",
      severity: "error",
      from: { path: "^src/modulos/[^/]+/aplicacion/" },
      to: { path: "^src/modulos/[^/]+/infraestructura/" }
    },
    {
      name: "FA-5-aplicacion-sin-paquetes",
      comment:
        "FA-5 · Los casos de uso no importan paquetes de node_modules (pg, Kysely, Fastify…): la tecnología queda en infraestructura/.",
      severity: "error",
      from: { path: "^src/modulos/[^/]+/aplicacion/" },
      to: { dependencyTypes: PAQUETES }
    },
    {
      name: "FA-4-sin-ciclos",
      comment: "FA-4 · No hay dependencias circulares en src/.",
      severity: "error",
      from: { path: "^src/" },
      to: { circular: true }
    },
    {
      name: "sin-importaciones-sin-resolver",
      comment: "Toda importación debe apuntar a un archivo que exista; si no, las demás reglas no se pueden evaluar.",
      severity: "error",
      from: {},
      to: { couldNotResolve: true }
    }
  ],
  options: {
    // No se analiza el interior de paquetes ni módulos nativos: solo nuestro código.
    doNotFollow: { path: "node_modules", dependencyTypes: PAQUETES.concat(["core"]) },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" },
    enhancedResolveOptions: {
      extensions: [".ts", ".js", ".json"]
    }
  }
};
