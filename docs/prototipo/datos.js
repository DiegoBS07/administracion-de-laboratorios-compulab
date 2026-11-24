/* Datos de demostración del prototipo de CompuLab.
   Son ficticios y fijos: "hoy" es el martes 24 de noviembre de 2026 a las 10:00. */
(function () {
  "use strict";

  var HOY = { fecha: "2026-11-24", minutos: 10 * 60 };

  var campus = [
    { id: "cartago", nombre: "Cartago" },
    { id: "sanjose", nombre: "San José" }
  ];

  var laboratorios = [
    { id: "c1", nombre: "Laboratorio Cartago 1", campus: "cartago", prefijo: "C1", fueraDeServicio: [5, 12] },
    { id: "c2", nombre: "Laboratorio Cartago 2", campus: "cartago", prefijo: "C2", fueraDeServicio: [9] },
    { id: "s1", nombre: "Laboratorio San José 1", campus: "sanjose", prefijo: "S1", fueraDeServicio: [] },
    { id: "s2", nombre: "Laboratorio San José 2", campus: "sanjose", prefijo: "S2", fueraDeServicio: [3, 14] }
  ];

  // dia: 1 = lunes ... 7 = domingo; horas en minutos desde la medianoche
  var asistentes = [
    { id: "a1", nombre: "Diego Solís", carne: "2023104578", categoria: "B", topeMin: 20 * 60,
      disponibilidad: [1, 2, 3, 4, 5].map(function (d) { return { dia: d, ini: 420, fin: 780 }; }) },
    { id: "a2", nombre: "María Fernanda Quesada", carne: "2022087741", categoria: "A", topeMin: 10 * 60,
      disponibilidad: [1, 2, 3].map(function (d) { return { dia: d, ini: 780, fin: 1260 }; }) },
    { id: "a3", nombre: "José Pablo Mora", carne: "2021150233", categoria: "A", topeMin: 18 * 60,
      disponibilidad: [{ dia: 2, ini: 420, fin: 1260 }, { dia: 4, ini: 420, fin: 1260 }, { dia: 6, ini: 480, fin: 840 }] },
    { id: "a4", nombre: "Valeria Chaves", carne: "2022110964", categoria: "B", topeMin: 20 * 60,
      disponibilidad: [1, 2, 3, 4, 5, 6].map(function (d) { return { dia: d, ini: 840, fin: 1260 }; }) },
    { id: "a5", nombre: "Andrés Brenes", carne: "2023058812", categoria: "A", topeMin: 8 * 60,
      disponibilidad: [1, 2, 3, 4, 5].map(function (d) { return { dia: d, ini: 420, fin: 720 }; }) }
  ];

  var n = 0;
  function t(lab, asistente, fecha, ini, fin, estado) {
    n += 1;
    return { id: "t" + n, lab: lab, asistente: asistente, fecha: fecha,
      ini: ini * 60, fin: fin * 60, estado: estado || "ASIGNADO" };
  }

  var turnos = [
    // Laboratorio Cartago 1, semana del 23 de noviembre
    t("c1", "a1", "2026-11-23", 7, 13), t("c1", "a2", "2026-11-23", 13, 17), t("c1", "a4", "2026-11-23", 17, 21),
    t("c1", "a1", "2026-11-24", 7, 13, "EN_CURSO"), t("c1", "a3", "2026-11-24", 13, 17), t("c1", "a4", "2026-11-24", 17, 21),
    t("c1", "a5", "2026-11-25", 7, 11), t("c1", "a2", "2026-11-25", 13, 17), t("c1", "a4", "2026-11-25", 17, 21),
    t("c1", "a5", "2026-11-26", 7, 11), t("c1", "a3", "2026-11-26", 11, 17), t("c1", "a4", "2026-11-26", 17, 21),
    t("c1", "a1", "2026-11-27", 7, 13), t("c1", "a4", "2026-11-27", 17, 21),
    t("c1", "a3", "2026-11-28", 8, 14),
    // Laboratorio Cartago 1, semana del 30 de noviembre
    t("c1", "a1", "2026-11-30", 7, 13), t("c1", "a2", "2026-11-30", 13, 17),
    t("c1", "a1", "2026-12-01", 7, 13),
    t("c1", "a2", "2026-12-02", 13, 17), t("c1", "a4", "2026-12-02", 17, 21),
    t("c1", "a3", "2026-12-03", 11, 17),
    t("c1", "a5", "2026-12-04", 13, 15, "PENDIENTE_ACEPTACION"),
    t("c1", "a3", "2026-12-05", 8, 14),
    // Turnos de los mismos asistentes en otros laboratorios (para los traslapes)
    t("c2", "a3", "2026-12-01", 8, 12),
    t("s1", "a5", "2026-12-02", 7, 11)
  ];

  // Horario de apertura de los otros laboratorios (turnos de asistentes que no se muestran)
  function abrir(lab, dias, tramos) {
    var lunes = ["2026-11-23", "2026-11-30"];
    lunes.forEach(function (l) {
      dias.forEach(function (d) {
        var f = new Date(l + "T12:00:00Z");
        f.setUTCDate(f.getUTCDate() + d - 1);
        var fecha = f.toISOString().slice(0, 10);
        tramos.forEach(function (tr) { turnos.push(t(lab, "x", fecha, tr[0], tr[1])); });
      });
    });
  }
  abrir("c2", [1, 2, 3, 4, 5], [[8, 12], [13, 20]]);
  abrir("s1", [1, 2, 3, 4, 5], [[7, 13], [17, 21]]);
  abrir("s2", [1, 2, 3, 4, 5, 6], [[9, 18]]);

  var tarifas = [
    { vigenteDesde: "2026-07-01", vigenteHasta: null, porHoraCentimos: { A: 215000, B: 260000 }, porcentajeRecargo: 25 }
  ];

  // Líneas de liquidación base (minutos). Los montos se calculan en app.js con la tarifa.
  var liquidaciones = {
    "2026-9": [
      { asistente: "a1", normales: 3240, recargo: 0, noPagados: [] },
      { asistente: "a2", normales: 2280, recargo: 480, noPagados: [] },
      { asistente: "a3", normales: 1680, recargo: 1440, noPagados: [] },
      { asistente: "a4", normales: 900, recargo: 3600, noPagados: [] },
      { asistente: "a5", normales: 1560, recargo: 0, noPagados: [] }
    ],
    "2026-10": [
      { asistente: "a1", normales: 3360, recargo: 0, noPagados: [] },
      { asistente: "a2", normales: 2400, recargo: 480, noPagados: [{ semana: "2026-10-12", motivo: "SOBRE_TOPE", minutos: 120 }] },
      { asistente: "a3", normales: 1800, recargo: 1440, noPagados: [] },
      { asistente: "a4", normales: 960, recargo: 3840, noPagados: [] },
      { asistente: "a5", normales: 1500, recargo: 0, noPagados: [{ semana: "2026-10-19", motivo: "MARCA_INCOMPLETA", minutos: 240 }] }
    ]
  };

  var usuarios = [
    { id: "ana", nombre: "Ana Lucía Vargas", roles: ["ESTUDIANTE"],
      descripcion: "Estudiante de Computación. Reserva máquinas para trabajar." },
    { id: "diego", nombre: "Diego Solís", roles: ["ASISTENTE", "ESTUDIANTE"], asistente: "a1",
      descripcion: "Asistente del Laboratorio Cartago 1. También reserva como estudiante." },
    { id: "laura", nombre: "Laura Jiménez", roles: ["COORDINADOR_LABORATORIO"], laboratorio: "c1",
      descripcion: "Coordina el Laboratorio Cartago 1: horario y cambios de turno." },
    { id: "marco", nombre: "Marco Rojas", roles: ["COORDINADOR_SOPORTE"],
      descripcion: "Coordina soporte: todos los laboratorios, asistentes y pagos." }
  ];

  window.DATOS = {
    HOY: HOY, campus: campus, laboratorios: laboratorios, asistentes: asistentes,
    turnos: turnos, tarifas: tarifas, liquidaciones: liquidaciones, usuarios: usuarios,
    maquinasPorLaboratorio: 16, limiteSemanalMin: 360, duracionMaximaMin: 120
  };
})();
