/**
 * Funciones de aptitud del frontend (docs/07-arquitectura.md, 7.3 "Frontend"). Se ejecutan con
 * `npm run aptitud`, antes de las pruebas y del build.
 */
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "FF-1-presentadores-sin-react",
      comment:
        "Humble Object: el presentador convierte la respuesta de la API en el modelo de vista sin React ni el navegador, para probarse sin renderizar.",
      severity: "error",
      from: { path: "presentador\.ts$" },
      to: { path: "(^node_modules/(react|react-dom|react-router)/|\.tsx$)" }
    },
    {
      name: "FF-2-funcionalidades-aisladas",
      comment: "Una funcionalidad no importa a otra; lo común va en src/compartido/.",
      severity: "error",
      from: { path: "^src/funcionalidades/([^/]+)/" },
      to: { path: "^src/funcionalidades/", pathNot: "^src/funcionalidades/$1/" }
    },
    {
      name: "FF-3-compartido-no-conoce-pantallas",
      comment: "src/compartido/ no depende de las funcionalidades ni de src/app/.",
      severity: "error",
      from: { path: "^src/compartido/" },
      to: { path: "^src/(funcionalidades|app)/" }
    },
    {
      name: "FF-4-sin-ciclos",
      severity: "error",
      from: { path: "^src/" },
      to: { circular: true }
    },
    {
      name: "sin-importaciones-sin-resolver",
      severity: "error",
      from: {},
      to: { couldNotResolve: true }
    }
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" },
    enhancedResolveOptions: {
      extensions: [".ts", ".tsx", ".js", ".json", ".css"],
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"]
    }
  }
};
