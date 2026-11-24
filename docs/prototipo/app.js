/* CompuLab · prototipo navegable
   Implementa la navegación por rol de docs/diseno-ux-ui.md con rutas por hash (#/ruta),
   para que funcione abriendo index.html directamente y cada pantalla tenga su propia URL. */
(function () {
  "use strict";

  var D = window.DATOS;
  var raiz = document.getElementById("raiz");
  var vivo = document.getElementById("vivo");

  /* ================= Utilidades ================= */

  var DIAS = ["", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
  var DIAS_CORTOS = ["", "lun", "mar", "mié", "jue", "vie", "sáb", "dom"];
  var MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
    "septiembre", "octubre", "noviembre", "diciembre"];

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fecha(s) { return new Date(s + "T12:00:00Z"); }
  function iso(d) { return d.toISOString().slice(0, 10); }
  function sumarDias(s, n) { var d = fecha(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); }
  function diaSemana(s) { return fecha(s).getUTCDay() || 7; }
  function lunesDe(s) { return sumarDias(s, 1 - diaSemana(s)); }
  function diaMes(s) { return fecha(s).getUTCDate(); }
  function nombreMes(s) { return MESES[fecha(s).getUTCMonth()]; }
  function fechaLarga(s) { return DIAS[diaSemana(s)] + " " + diaMes(s) + " de " + nombreMes(s); }
  function hora(m) { return Math.floor(m / 60) + ":" + String(m % 60).padStart(2, "0"); }
  function duracion(m) {
    var h = Math.floor(m / 60), r = m % 60;
    if (!h) return r + " min";
    return r ? h + " h " + r + " min" : h + " h";
  }
  function horasTabla(m) { return m ? duracion(m) : "0 h"; }
  function horas(m) { return (m / 60).toLocaleString("es-CR", { maximumFractionDigits: 1 }) + " h"; }
  var colones = new Intl.NumberFormat("es-CR", { style: "currency", currency: "CRC" });
  function dinero(c) { return colones.format(c / 100); }
  function seTraslapan(a1, b1, a2, b2) { return a1 < b2 && a2 < b1; }
  function anunciar(t) { vivo.textContent = ""; setTimeout(function () { vivo.textContent = t; }, 30); }
  function lab(id) { return D.laboratorios.filter(function (l) { return l.id === id; })[0]; }
  function asistente(id) { return D.asistentes.filter(function (a) { return a.id === id; })[0]; }
  function campusDe(l) { return D.campus.filter(function (c) { return c.id === l.campus; })[0]; }

  function guardar(clave, valor) { try { localStorage.setItem("compulab-" + clave, JSON.stringify(valor)); } catch (e) { /* sin almacenamiento */ } }
  function leer(clave) { try { return JSON.parse(localStorage.getItem("compulab-" + clave)); } catch (e) { return null; } }

  var ICONOS = {
    reservar: '<path d="M4 6h16v10H4z"/><path d="M9 20h6M12 16v4"/>',
    lista: '<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
    postulacion: '<path d="M6 3h9l3 3v15H6z"/><path d="M9 12h6M9 16h6"/>',
    campana: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',
    reloj: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
    calendario: '<rect x="4" y="5" width="16" height="15" rx="1"/><path d="M4 10h16M9 3v4M15 3v4"/>',
    intercambio: '<path d="M4 8h13l-3-3M20 16H7l3 3"/>',
    inicio: '<path d="M4 11l8-7 8 7v9H4z"/>',
    cambios: '<path d="M5 12l4 4 10-10"/>',
    cobertura: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    maquinas: '<rect x="3" y="4" width="18" height="12" rx="1"/><path d="M8 20h8"/>',
    laboratorios: '<path d="M3 20h18M5 20V8l7-4 7 4v12"/><path d="M9 20v-6h6v6"/>',
    personas: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5"/><circle cx="17" cy="9" r="2"/><path d="M15 15c3 0 6 1 6 4"/>',
    seleccion: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4-4"/>',
    cierre: '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M8 8h8M8 12h8M8 16h4"/>',
    tarifas: '<path d="M12 3v18M16 7c0-2-2-3-4-3s-4 1-4 3 2 3 4 3 4 1 4 3-2 3-4 3-4-1-4-3"/>',
    uso: '<path d="M4 20V14M10 20V8M16 20v-9M22 20H2"/>',
    mas: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
    usuario: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
    atras: '<path d="M15 5l-7 7 7 7"/>',
    adelante: '<path d="M9 5l7 7-7 7"/>'
  };
  function icono(n) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONOS[n] + "</svg>";
  }

  /* ================= Estado del prototipo ================= */

  var estado = {
    usuario: null,
    escenario: "normal",
    menuUsuario: false,
    sede: leer("sede"),
    estudiante: { minutosSemana: 120, reservaActiva: null },
    reserva: { fecha: D.HOY.fecha, inicio: null, dur: null, maquina: null, confirmar: false, enviando: false, error: null, hecha: null, reintento: false },
    reservasExtra: [],
    horario: { semana: lunesDe(D.HOY.fecha), panel: null },
    cierres: { cerrados: { "2026-9": "2026-10-01T00:05" }, confirmar: false, calculando: false, error: null },
    marca: { entrada: "6:58", salida: null },
    clave: null
  };
  var sesion = leer("sesion");
  if (sesion) estado.usuario = D.usuarios.filter(function (u) { return u.id === sesion; })[0] || null;

  function nuevaClave() { return "k-" + Math.random().toString(36).slice(2, 10); }

  /* ================= Roles y navegación ================= */

  var NAV = {
    ESTUDIANTE: [
      { ruta: "/reservar", texto: "Reservar", icono: "reservar" },
      { ruta: "/mis-reservas", texto: "Mis reservas", icono: "lista" },
      { ruta: "/postulacion", texto: "Postulación", icono: "postulacion" },
      { ruta: "/avisos", texto: "Avisos", icono: "campana" }
    ],
    ASISTENTE: [
      { ruta: "/mi-turno", texto: "Mi turno", icono: "reloj" },
      { ruta: "/mis-turnos", texto: "Mis turnos", icono: "calendario" },
      { ruta: "/ofertas", texto: "Ofertas", icono: "intercambio" },
      { ruta: "/reservar", texto: "Reservar", icono: "reservar" },
      { ruta: "/mis-reservas", texto: "Mis reservas", icono: "lista" }
    ],
    COORDINADOR_LABORATORIO: function (u) {
      var b = "/laboratorios/" + u.laboratorio;
      return [
        { ruta: b + "/pendientes", texto: "Pendientes", icono: "inicio" },
        { ruta: b + "/horario", texto: "Horario", icono: "calendario" },
        { ruta: b + "/cambios", texto: "Cambios por aprobar", corto: "Cambios", icono: "cambios" },
        { ruta: b + "/cobertura", texto: "Cobertura", icono: "cobertura" },
        { ruta: b + "/maquinas", texto: "Máquinas", icono: "maquinas" }
      ];
    },
    COORDINADOR_SOPORTE: [
      { ruta: "/panel", texto: "Panel", icono: "inicio" },
      { ruta: "/laboratorios", texto: "Laboratorios", icono: "laboratorios", seccion: "Operación" },
      { ruta: "/seleccion", texto: "Selección de asistentes", corto: "Selección", icono: "seleccion", seccion: "Operación" },
      { ruta: "/asistentes", texto: "Asistentes", icono: "personas", seccion: "Operación" },
      { ruta: "/cierres", texto: "Cierre mensual", corto: "Cierres", icono: "cierre", seccion: "Pagos" },
      { ruta: "/tarifas", texto: "Tarifas", icono: "tarifas", seccion: "Pagos" },
      { ruta: "/uso-de-maquinas", texto: "Uso de máquinas", corto: "Uso", icono: "uso", seccion: "Informes" }
    ]
  };
  var PRIORIDAD = ["COORDINADOR_SOPORTE", "COORDINADOR_LABORATORIO", "ASISTENTE", "ESTUDIANTE"];
  var NOMBRE_ROL = {
    ESTUDIANTE: "Estudiante", ASISTENTE: "Asistente",
    COORDINADOR_LABORATORIO: "Coordinación de laboratorio", COORDINADOR_SOPORTE: "Coordinación de soporte"
  };

  function rolPrincipal(u) { return PRIORIDAD.filter(function (r) { return u.roles.indexOf(r) >= 0; })[0]; }
  function navDe(u) {
    var vistos = {}, items = [];
    PRIORIDAD.forEach(function (r) {
      if (u.roles.indexOf(r) < 0) return;
      var lista = typeof NAV[r] === "function" ? NAV[r](u) : NAV[r];
      lista.forEach(function (i) { if (!vistos[i.ruta]) { vistos[i.ruta] = 1; items.push(i); } });
    });
    // Con varios roles, Avisos sale del menú: ya está en la campana del encabezado (N-4).
    if (u.roles.length > 1) items = items.filter(function (i) { return i.ruta !== "/avisos"; });
    return items;
  }
  function inicioDe(u) {
    var r = rolPrincipal(u);
    if (r === "COORDINADOR_SOPORTE") return "/panel";
    if (r === "COORDINADOR_LABORATORIO") return "/laboratorios/" + u.laboratorio + "/pendientes";
    if (r === "ASISTENTE") return "/mi-turno";
    return "/reservar";
  }
  function tiene(r) { return estado.usuario && estado.usuario.roles.indexOf(r) >= 0; }

  /* ================= Rutas ================= */

  var EST = ["ESTUDIANTE", "ASISTENTE"], CS = ["COORDINADOR_SOPORTE"], TODOS = null;

  var RUTAS = [
    { re: /^\/reservar$/, roles: EST, vista: vReservar, titulo: "Reservar una máquina" },
    { re: /^\/reservar\/(\w+)$/, roles: EST, vista: vReservarLab, titulo: "Reservar una máquina" },
    { re: /^\/mis-reservas$/, roles: EST, vista: vMisReservas, titulo: "Mis reservas" },
    { re: /^\/postulacion$/, roles: ["ESTUDIANTE"], vista: vPendienteDe("Postulación", "Aquí el estudiante marcará en una cuadrícula semanal los bloques en que puede trabajar y elegirá los laboratorios que le interesan."), titulo: "Postulación" },
    { re: /^\/mi-turno$/, roles: ["ASISTENTE"], vista: vMiTurno, titulo: "Mi turno" },
    { re: /^\/mis-turnos$/, roles: ["ASISTENTE"], vista: vPendienteDe("Mis turnos", "Sus turnos por semana, con la opción de aceptar los pendientes y de ofrecer un turno."), titulo: "Mis turnos" },
    { re: /^\/ofertas$/, roles: ["ASISTENTE"], vista: vPendienteDe("Ofertas", "Turnos que otros asistentes de sus laboratorios ofrecen para que los cubra."), titulo: "Ofertas" },
    { re: /^\/laboratorios$/, roles: CS, vista: vLaboratorios, titulo: "Laboratorios" },
    { re: /^\/laboratorios\/(\w+)\/(pendientes|horario|cambios|cobertura|maquinas)$/, roles: ["COORDINADOR_LABORATORIO", "COORDINADOR_SOPORTE"], vista: vLaboratorio, titulo: null },
    { re: /^\/panel$/, roles: CS, vista: vPanel, titulo: "Panel" },
    { re: /^\/seleccion$/, roles: CS, vista: vPendienteDe("Selección de asistentes", "Convocatoria del semestre, postulaciones por evaluar, entrevistas y decisión."), titulo: "Selección de asistentes" },
    { re: /^\/asistentes$/, roles: CS, vista: vPendienteDe("Asistentes", "Asistentes del semestre: corregir el tope de horas o dar de baja."), titulo: "Asistentes" },
    { re: /^\/tarifas$/, roles: CS, vista: vPendienteDe("Tarifas", "Tarifa por hora de cada categoría y porcentaje de recargo, con su fecha de vigencia."), titulo: "Tarifas" },
    { re: /^\/uso-de-maquinas$/, roles: CS, vista: vPendienteDe("Uso de máquinas", "Por laboratorio y semana: máquinas fuera de servicio y porcentaje de uso de las demás."), titulo: "Uso de máquinas" },
    { re: /^\/cierres$/, roles: CS, vista: vCierres, titulo: "Cierre mensual" },
    { re: /^\/cierres\/(\d{4})\/(\d{1,2})$/, roles: CS, vista: vCierreMes, titulo: "Cierre mensual" },
    { re: /^\/avisos$/, roles: TODOS, vista: vAvisos, titulo: "Avisos" },
    { re: /^\/mas$/, roles: TODOS, vista: vMas, titulo: "Más opciones" },
    { re: /^\/sin-permiso$/, roles: TODOS, vista: vSinPermiso, titulo: "Sin permiso" }
  ];

  function ir(ruta) { location.hash = "#" + ruta; }

  function leerRuta() {
    var h = location.hash.replace(/^#/, "") || "/";
    var partes = h.split("?");
    var q = {};
    (partes[1] || "").split("&").forEach(function (p) {
      if (!p) return;
      var kv = p.split("=");
      q[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || "");
    });
    return { ruta: partes[0], q: q };
  }

  function render() {
    var r = leerRuta();
    estado.menuUsuario = false;
    if (!estado.usuario) {
      if (r.ruta !== "/ingresar") { ir("/ingresar"); return; }
      raiz.innerHTML = vIngresar();
      conectar();
      document.title = "CompuLab";
      return;
    }
    if (r.ruta === "/ingresar" || r.ruta === "/") { ir(inicioDe(estado.usuario)); return; }

    var encontrada = null, m = null;
    for (var i = 0; i < RUTAS.length; i++) {
      m = r.ruta.match(RUTAS[i].re);
      if (m) { encontrada = RUTAS[i]; break; }
    }
    if (!encontrada) { ir(inicioDe(estado.usuario)); return; }

    var permitido = !encontrada.roles || encontrada.roles.some(tiene);
    if (permitido && encontrada.vista === vLaboratorio && !tiene("COORDINADOR_SOPORTE")) {
      permitido = estado.usuario.laboratorio === m[1];
    }
    if (!permitido) { ir("/sin-permiso"); return; }

    var vista = encontrada.vista(m, r.q);
    raiz.innerHTML = esqueleto(r.ruta, vista);
    conectar();
    var h1 = raiz.querySelector(".cabecera h1");
    document.title = (h1 ? h1.textContent + " | " : "") + "CompuLab";
  }

  /* ================= Esqueleto ================= */

  function esqueleto(ruta, vista) {
    var u = estado.usuario;
    var nav = navDe(u);
    var activa = function (i) {
      return ruta === i.ruta || (i.ruta === "/reservar" && ruta.indexOf("/reservar/") === 0) ||
        (i.ruta === "/cierres" && ruta.indexOf("/cierres/") === 0) ||
        (i.ruta === "/laboratorios" && ruta.indexOf("/laboratorios/") === 0 && tiene("COORDINADOR_SOPORTE"));
    };

    var lateral = '<nav class="lateral" aria-label="Navegación principal"><div class="lateral__marca"><strong>CompuLab</strong><span>Escuela de Computación, Tecnológico de Costa Rica</span></div>';
    var seccion = null;
    nav.forEach(function (i) {
      if (i.seccion && i.seccion !== seccion) { seccion = i.seccion; lateral += '<div class="lateral__seccion">' + seccion + "</div>"; }
      lateral += '<a href="#' + i.ruta + '"' + (activa(i) ? ' aria-current="page"' : "") + ">" + icono(i.icono) + "<span>" + i.texto + "</span></a>";
    });
    lateral += '<div class="lateral__pie">Prototipo navegable. Datos de demostración.</div></nav>';

    var pest = nav.length > 5 ? nav.slice(0, 4).concat([{ ruta: "/mas", texto: "Más", icono: "mas" }]) : nav;
    var pestanas = '<nav class="pestanas" aria-label="Navegación principal">' + pest.map(function (i) {
      var act = activa(i) || (i.ruta === "/mas" && ruta === "/mas");
      return '<a href="#' + i.ruta + '"' + (act ? ' aria-current="page"' : "") + ">" + icono(i.icono) + "<span>" + (i.corto || i.texto) + "</span></a>";
    }).join("") + "</nav>";

    var noLeidos = avisosDe(u).length;
    var cabecera = '<header class="cabecera">' +
      '<div class="cabecera__titulo">' + (vista.migas ? '<div class="migas">' + vista.migas + "</div>" : "") + "<h1>" + esc(vista.titulo) + "</h1></div>" +
      '<a class="icono-boton" href="#/avisos" aria-label="Avisos, ' + noLeidos + ' nuevos">' + icono("campana") + (noLeidos ? '<span class="contador" aria-hidden="true"></span>' : "") + "</a>" +
      '<div class="usuario"><button class="icono-boton" data-accion="menu-usuario" aria-expanded="false" aria-label="Menú de ' + esc(u.nombre) + '">' + icono("usuario") + "</button>" +
      '<div class="usuario__menu" hidden><p>' + esc(u.nombre) + "</p><small>" + u.roles.map(function (r) { return NOMBRE_ROL[r]; }).join(" y ") + "</small>" +
      '<button class="boton boton--secundario boton--ancho" data-accion="salir">Cerrar sesión</button></div></div>' +
      "</header>";

    var escenario = '<details class="escenario"' + (estado.escenario !== "normal" ? " open" : "") + "><summary>Prototipo</summary>" +
      '<label for="escenario">Simular respuesta del servidor</label>' +
      '<select id="escenario" data-accion="escenario">' +
      opcion("normal", "Normal") + opcion("conflicto", "Conflicto (otra persona se adelantó)") + opcion("sin-respuesta", "Sin respuesta (reintento)") +
      "</select></details>";

    return '<div class="app">' + lateral + '<div class="principal">' + cabecera +
      '<main class="contenido" id="contenido">' + vista.html + "</main></div>" + pestanas + escenario + (vista.extra || "") + "</div>";
  }
  function opcion(v, t) { return '<option value="' + v + '"' + (estado.escenario === v ? " selected" : "") + ">" + t + "</option>"; }

  /* ================= Ingreso (selector de rol simulado, 15.7) ================= */

  function vIngresar() {
    return '<main class="ingreso"><div class="ingreso__caja">' +
      '<p class="ingreso__institucion">Tecnológico de Costa Rica</p>' +
      '<h1 class="ingreso__marca">CompuLab</h1>' +
      '<p class="ingreso__sub">Laboratorios de la Escuela de Computación</p>' +
      '<p class="ingreso__nota">Este prototipo no se conecta al directorio institucional. Elige con quién entrar para recorrer la aplicación como ese rol.</p>' +
      '<ul class="directorio">' + D.usuarios.map(function (u) {
        return '<li><button data-accion="entrar" data-usuario="' + u.id + '">' +
          '<span class="directorio__rol">' + u.roles.map(function (r) { return NOMBRE_ROL[r]; }).join(" y ") + "</span>" +
          '<span class="directorio__persona">' + esc(u.nombre) + ". " + esc(u.descripcion) + "</span>" +
          '<span class="directorio__entrar">Entrar</span></button></li>';
      }).join("") + "</ul></div></main>";
  }

  /* ================= Datos derivados ================= */

  var CUBREN = { ASIGNADO: 1, EN_CURSO: 1 };
  var OCUPAN = { ASIGNADO: 1, EN_CURSO: 1, PENDIENTE_ACEPTACION: 1 };

  function franjasAbiertas(labId, f) {
    var ts = D.turnos.filter(function (t) { return t.lab === labId && t.fecha === f && CUBREN[t.estado]; })
      .sort(function (a, b) { return a.ini - b.ini; });
    var r = [];
    ts.forEach(function (t) {
      var u = r[r.length - 1];
      if (u && t.ini <= u.fin) u.fin = Math.max(u.fin, t.fin);
      else r.push({ ini: t.ini, fin: t.fin });
    });
    return r;
  }

  function hash(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }

  function reservasDe(labId, f) {
    var fr = franjasAbiertas(labId, f), r = [];
    if (!fr.length) return r;
    for (var i = 1; i <= D.maquinasPorLaboratorio; i++) {
      var h = hash(labId + f + i);
      if (h % 3 !== 0) continue;
      var tramo = fr[h % fr.length];
      var largo = (h % 2 ? 120 : 60);
      var huecos = Math.max(1, Math.floor((tramo.fin - tramo.ini - largo) / 60) + 1);
      var ini = tramo.ini + ((h >> 3) % huecos) * 60;
      if (ini + largo > tramo.fin) ini = tramo.fin - largo;
      if (ini < tramo.ini) continue;
      r.push({ maquina: i, ini: ini, fin: ini + largo });
    }
    return r.concat(estado.reservasExtra.filter(function (x) { return x.lab === labId && x.fecha === f; }));
  }

  function avisosDe(u) {
    var r = rolPrincipal(u);
    if (r === "COORDINADOR_SOPORTE") return [
      { t: "Octubre de 2026 todavía no se ha cerrado.", s: "El cierre automático del día 1 no se ejecutó.", ruta: "/cierres/2026/10" },
      { t: "El Laboratorio Cartago 1 no tiene responsable el viernes 27 de 13:00 a 17:00.", s: "Turno vacante.", ruta: "/laboratorios/c1/horario" }
    ];
    if (r === "COORDINADOR_LABORATORIO") return [
      { t: "Andrés Brenes no ha aceptado su turno del viernes 4 de diciembre.", s: "Se le asignó fuera de su disponibilidad.", ruta: "/laboratorios/c1/horario?semana=2026-11-30" },
      { t: "El viernes 27 no hay responsable de 13:00 a 17:00.", s: "Turno vacante en tu laboratorio.", ruta: "/laboratorios/c1/horario" }
    ];
    if (r === "ASISTENTE") return [
      { t: "José Pablo Mora ofrece su turno del sábado 28 de 8:00 a 14:00.", s: "Laboratorio Cartago 1.", ruta: "/ofertas" }
    ];
    return [
      { t: "Tu reserva del lunes 23 en la máquina C2-04 terminó.", s: "Llevas 2 h reservadas esta semana.", ruta: "/mis-reservas" }
    ];
  }

  /* ================= Estudiante: reservar (CU-11) ================= */

  function bannerReserva() {
    var e = estado.estudiante;
    var restante = D.limiteSemanalMin - e.minutosSemana;
    if (e.reservaActiva) {
      var a = e.reservaActiva;
      return '<div class="mensaje"><p><strong>Ya tienes una reserva activa:</strong> ' + a.maquina + ", " + fechaLarga(a.fecha) + " de " + hora(a.ini) + " a " + hora(a.fin) +
        ".</p><p>Solo se permite una reserva a la vez. Podrás hacer otra cuando termine o si la cancelas.</p><div class=\"acciones\"><a class=\"boton boton--secundario\" href=\"#/mis-reservas\">Ver mis reservas</a></div></div>";
    }
    if (restante <= 0) return '<div class="mensaje mensaje--error"><p><strong>Ya usaste tus 6 horas de esta semana.</strong></p><p>El lunes vuelves a tener 6 horas disponibles.</p></div>';
    return "";
  }

  function medidorSemana() {
    var usados = estado.estudiante.minutosSemana;
    var restante = Math.max(0, D.limiteSemanalMin - usados);
    return '<p class="medidor__texto">Esta semana has reservado ' + duracion(usados) + ". " +
      (restante ? "Te quedan " + duracion(restante) + " de las 6 h permitidas." : "Ya usaste las 6 h permitidas.") + "</p>";
  }

  function vReservar(m, q) {
    if (!estado.sede) {
      return { titulo: "Reservar una máquina", html: '<div class="pila"><h2>¿En qué sede vas a trabajar?</h2>' +
        '<p class="subtitulo">La recordaremos para la próxima vez. Puedes cambiarla cuando quieras.</p>' +
        '<div class="acciones">' + D.campus.map(function (c) {
          return '<button class="boton boton--secundario" data-accion="sede" data-sede="' + c.id + '">' + c.nombre + "</button>";
        }).join("") + "</div></div>" };
    }
    var f = q.fecha || estado.reserva.fecha;
    estado.reserva.fecha = f;

    var dias = "";
    for (var i = 0; i < 7; i++) {
      var d = sumarDias(D.HOY.fecha, i);
      var cerrado = D.laboratorios.filter(function (l) { return l.campus === estado.sede && franjasAbiertas(l.id, d).length; }).length === 0;
      dias += '<button class="chip" data-accion="dia" data-fecha="' + d + '" aria-pressed="' + (d === f) + '"' + (cerrado ? " disabled" : "") + ">" +
        "<span>" + (i === 0 ? "Hoy" : DIAS_CORTOS[diaSemana(d)]) + "</span><small>" + (cerrado ? "cerrado" : diaMes(d) + " " + nombreMes(d).slice(0, 3)) + "</small></button>";
    }

    var labs = D.laboratorios.filter(function (l) { return l.campus === estado.sede; }).map(function (l) {
      var fr = franjasAbiertas(l.id, f);
      var enServicio = D.maquinasPorLaboratorio - l.fueraDeServicio.length;
      if (!fr.length) {
        return '<li><div class="lab lab--cerrado"><div class="lab__fila"><span class="lab__nombre">' + l.nombre + '</span><span class="lab__estado">Cerrado este día</span></div></div></li>';
      }
      return '<li><a class="lab" href="#/reservar/' + l.id + "?fecha=" + f + '"><div class="lab__fila"><span class="lab__nombre">' + l.nombre + "</span>" +
        '<span class="lab__estado">' + enServicio + " de " + D.maquinasPorLaboratorio + " máquinas en servicio</span></div>" +
        '<span class="lab__horario">Abierto ' + textoFranjas(fr) + "</span></a></li>";
    }).join("");

    var sedeActual = D.campus.filter(function (c) { return c.id === estado.sede; })[0];
    return {
      titulo: "Reservar una máquina",
      migas: "Sede " + sedeActual.nombre,
      html: '<div class="pila-l">' +
        '<div class="pila"><div class="segmentado" role="group" aria-label="Sede">' + D.campus.map(function (c) {
          return '<button data-accion="sede" data-sede="' + c.id + '" aria-pressed="' + (c.id === estado.sede) + '">' + c.nombre + "</button>";
        }).join("") + "</div>" + medidorSemana() + bannerReserva() + "</div>" +
        '<section class="pila"><h2>¿Qué día?</h2><div class="chips" role="group" aria-label="Día">' + dias + "</div></section>" +
        '<section class="pila"><h2>Laboratorios de ' + sedeActual.nombre + ", " + fechaLarga(f) + '</h2><ul class="labs">' + labs + "</ul></section></div>"
    };
  }

  function textoFranjas(fr) {
    return fr.map(function (x) { return "de " + hora(x.ini) + " a " + hora(x.fin); }).join(" y ");
  }

  function vReservarLab(m, q) {
    var l = lab(m[1]);
    var f = q.fecha || estado.reserva.fecha;
    var R = estado.reserva;
    if (R.fecha !== f) { R.fecha = f; R.inicio = null; R.dur = null; R.maquina = null; }
    var migas = '<a href="#/reservar?fecha=' + f + '">Sede ' + campusDe(l).nombre + "</a> › <span aria-current=\"page\">" + l.nombre + "</span>";

    if (R.hecha) return { titulo: "Reserva confirmada", migas: migas, html: vistaConfirmada(R.hecha) };

    var fr = franjasAbiertas(l.id, f);
    var activa = !!estado.estudiante.reservaActiva;
    var restante = D.limiteSemanalMin - estado.estudiante.minutosSemana;
    var ahora = f === D.HOY.fecha ? D.HOY.minutos : -1;

    var inicios = "";
    fr.forEach(function (x) {
      for (var s = x.ini; s <= x.fin - 30; s += 30) {
        if (s <= ahora) continue;
        inicios += '<button class="chip" data-accion="inicio" data-v="' + s + '" aria-pressed="' + (R.inicio === s) + '"' + (activa ? " disabled" : "") + ">" + hora(s) + "</button>";
      }
    });
    if (!inicios) inicios = '<p class="subtitulo">Ya no quedan horas disponibles en este día.</p>';

    var finFranja = null;
    if (R.inicio !== null) fr.forEach(function (x) { if (R.inicio >= x.ini && R.inicio < x.fin) finFranja = x.fin; });
    var durs = [30, 60, 90, 120].map(function (d) {
      var ok = R.inicio !== null && R.inicio + d <= finFranja && d <= restante && !activa;
      var razon = R.inicio === null ? "" : (R.inicio + d > finFranja ? "cierra antes" : (d > restante ? "pasa tus 6 h" : ""));
      return '<button class="chip" data-accion="dur" data-v="' + d + '" aria-pressed="' + (R.dur === d) + '"' + (ok ? "" : " disabled") + ">" +
        "<span>" + duracion(d) + "</span>" + (razon && !ok ? "<small>" + razon + "</small>" : "") + "</button>";
    }).join("");

    var listo = R.inicio !== null && R.dur !== null;
    var ocupadas = listo ? reservasDe(l.id, f).filter(function (x) { return seTraslapan(x.ini, x.fin, R.inicio, R.inicio + R.dur); }).map(function (x) { return x.maquina; }) : [];
    var filas = "";
    for (var fila = 0; fila < 4; fila++) {
      var celdas = [];
      for (var c = 1; c <= 4; c++) {
        var num = fila * 4 + c;
        var id = l.prefijo + "-" + String(num).padStart(2, "0");
        var danada = l.fueraDeServicio.indexOf(num) >= 0;
        var ocupada = ocupadas.indexOf(num) >= 0;
        var clase = "puesto" + (danada ? " puesto--danado" : ocupada ? " puesto--ocupado" : !listo ? " puesto--espera" : "");
        var etiqueta = id + (danada ? ", fuera de servicio" : ocupada ? ", reservada en ese horario" : !listo ? "" : ", libre");
        var deshabilitada = danada || ocupada || !listo || activa;
        celdas.push('<button class="' + clase + '" data-accion="maquina" data-v="' + num + '" aria-label="' + etiqueta + '" aria-pressed="' + (R.maquina === num) + '"' + (deshabilitada ? " disabled" : "") + '><span class="cinta">' + id + "</span></button>");
      }
      filas += '<div class="plano__fila">' + celdas[0] + celdas[1] + '<span class="plano__pasillo" aria-hidden="true"></span>' + celdas[2] + celdas[3] + "</div>";
    }

    var error = R.error ? '<div class="mensaje mensaje--error" role="alert"><p><strong>' + R.error.titulo + "</strong></p><p>" + R.error.texto + "</p></div>" : "";
    var reintento = R.reintento ? '<div class="mensaje mensaje--pendiente" role="status"><p>No llegó la respuesta. Reintentando con la misma solicitud…</p></div>' : "";

    var barra = "";
    if (listo && R.maquina) {
      var idM = l.prefijo + "-" + String(R.maquina).padStart(2, "0");
      barra = '<div class="barra-accion"><p><strong>' + idM + "</strong><small>" + DIAS_CORTOS[diaSemana(f)] + " " + diaMes(f) + ", de " + hora(R.inicio) + " a " + hora(R.inicio + R.dur) + "</small></p>" +
        '<button class="boton" data-accion="pedir-confirmacion">Reservar ' + idM + "</button></div>";
    }

    var extra = R.confirmar ? hojaConfirmacion(l, f) : "";

    return {
      titulo: l.nombre, migas: migas, extra: extra,
      html: '<div class="pila-l">' +
        '<p class="subtitulo">' + fechaLarga(f).replace(/^./, function (c) { return c.toUpperCase(); }) + ". Abierto " + textoFranjas(fr) + ".</p>" +
        bannerReserva() + reintento + error +
        '<section class="pila"><h2>¿A qué hora llegas?</h2><div class="chips" role="group" aria-label="Hora de inicio">' + inicios + "</div></section>" +
        '<section class="pila"><h2>¿Cuánto tiempo?</h2><div class="chips" role="group" aria-label="Duración">' + durs + "</div></section>" +
        '<section class="pila"><h2>Elige una máquina</h2>' + (listo ? "" : '<p class="subtitulo">Elige la hora y la duración para ver qué máquinas están libres.</p>') +
        '<div class="plano"><div class="plano__frente">Pizarra y puerta</div><div class="plano__filas">' + filas + "</div></div>" +
        '<div class="leyenda"><span><i></i>Libre</span><span><i class="ocupado"></i>Reservada en ese horario</span><span><i class="danado"></i>Fuera de servicio</span><span><i class="elegido"></i>Tu elección</span></div>' +
        barra + "</section></div>"
    };
  }

  function hojaConfirmacion(l, f) {
    var R = estado.reserva;
    var idM = l.prefijo + "-" + String(R.maquina).padStart(2, "0");
    var quedan = D.limiteSemanalMin - estado.estudiante.minutosSemana - R.dur;
    return '<div class="velo" data-accion="cerrar-hoja"><div class="hoja" role="dialog" aria-modal="true" aria-labelledby="titulo-hoja">' +
      '<h2 id="titulo-hoja">Confirma tu reserva</h2>' +
      '<dl class="detalle"><dt>Máquina</dt><dd>' + idM + "</dd><dt>Laboratorio</dt><dd>" + l.nombre + "</dd><dt>Día</dt><dd>" + fechaLarga(f) +
      "</dd><dt>Horario</dt><dd>De " + hora(R.inicio) + " a " + hora(R.inicio + R.dur) + "</dd></dl>" +
      '<div class="pila"><p>Tienes hasta las <strong>' + hora(R.inicio + 15) + "</strong> para presentarte; si no llegas, la máquina se libera para otra persona.</p>" +
      "<p>Después de esta reserva te quedarán " + duracion(Math.max(0, quedan)) + " esta semana.</p>" +
      '<div class="acciones"><button class="boton boton--secundario" data-accion="cancelar-hoja">Volver</button>' +
      '<button class="boton" data-accion="confirmar-reserva"' + (R.enviando ? ' disabled aria-busy="true"' : "") + ">" + (R.enviando ? "Reservando…" : "Reservar " + idM) + "</button></div></div></div></div>";
  }

  function vistaConfirmada(h) {
    return '<div class="confirmado pila" role="status"><span class="confirmado__cinta">' + h.maquina + "</span>" +
      '<p class="confirmado__hora">Antes de las ' + hora(h.ini + 15) + "</p>" +
      "<p>Preséntate en el " + h.labNombre + " el " + fechaLarga(h.fecha) + ". Tu reserva es de " + hora(h.ini) + " a " + hora(h.fin) + "; si no llegas en los primeros 15 minutos, la máquina se libera.</p>" +
      '<div class="acciones"><a class="boton" href="#/mis-reservas">Ver mis reservas</a><a class="boton boton--secundario" href="#/reservar">Volver a la sede</a></div></div>';
  }

  function vMisReservas() {
    var a = estado.estudiante.reservaActiva;
    var activa = a
      ? '<ul class="lista"><li><strong>' + a.maquina + ", " + a.labNombre + "</strong><small>" + fechaLarga(a.fecha) + " de " + hora(a.ini) + " a " + hora(a.fin) +
        ". Preséntate antes de las " + hora(a.ini + 15) + '.</small><div class="acciones" style="margin-top:10px"><button class="boton boton--secundario" data-accion="cancelar-reserva">Cancelar esta reserva</button></div></li></ul>'
      : '<div class="vacio"><p>No tienes reservas activas.</p><div class="acciones"><a class="boton" href="#/reservar">Reservar una máquina</a></div></div>';
    return { titulo: "Mis reservas", html: '<div class="pila-l"><section class="pila"><h2>Esta semana</h2>' + medidorSemana() + "</section>" +
      '<section class="pila"><h2>Reserva activa</h2>' + activa + "</section>" +
      '<section class="pila"><h2>Anteriores</h2><ul class="lista"><li>C2-04, Laboratorio Cartago 2<small>Lunes 23 de noviembre de 9:00 a 11:00. Usada.</small></li></ul></section></div>' };
  }

  /* ================= Asistente: mi turno ================= */

  function vMiTurno() {
    var M = estado.marca;
    var boton = M.salida
      ? '<p class="subtitulo" style="margin-top:16px">Salida registrada a las ' + M.salida + ". Gracias.</p>"
      : '<button class="boton boton--marcar" data-accion="marcar-salida">Marcar salida</button>';
    return { titulo: "Mi turno", html: '<div class="pila-l"><div class="reloj"><p class="subtitulo">Laboratorio Cartago 1, hoy</p>' +
      '<p class="reloj__hora">7:00 a 13:00</p><p>Entrada marcada a las ' + M.entrada + ".</p>" + boton + "</div>" +
      '<section class="pila"><h2>En este turno</h2><ul class="lista"><li><a href="#/mi-turno">Reportar una máquina dañada</a><small>Las reservas futuras de esa máquina se cancelan y se avisa a los estudiantes.</small></li>' +
      '<li><a href="#/mi-turno">Registrar que una máquina se reparó</a><small>C1-05 y C1-12 están fuera de servicio.</small></li></ul></section></div>' };
  }

  /* ================= Coordinación: laboratorio ================= */

  function vLaboratorios() {
    return { titulo: "Laboratorios", html: '<div class="pila-l">' + D.campus.map(function (c) {
      return '<section class="pila"><h2>Sede ' + c.nombre + '</h2><ul class="labs">' + D.laboratorios.filter(function (l) { return l.campus === c.id; }).map(function (l) {
        var hoy = franjasAbiertas(l.id, D.HOY.fecha);
        return '<li><a class="lab" href="#/laboratorios/' + l.id + '/horario"><div class="lab__fila"><span class="lab__nombre">' + l.nombre + '</span><span class="lab__estado">' +
          (D.maquinasPorLaboratorio - l.fueraDeServicio.length) + " de " + D.maquinasPorLaboratorio + " máquinas en servicio</span></div>" +
          '<span class="lab__horario">Hoy: ' + (hoy.length ? "abierto " + textoFranjas(hoy) : "cerrado") + "</span></a></li>";
      }).join("") + "</ul></section>";
    }).join("") + "</div>" };
  }

  function vLaboratorio(m, q) {
    var l = lab(m[1]), seccion = m[2];
    var esCS = tiene("COORDINADOR_SOPORTE");
    var nombres = { pendientes: "Pendientes", horario: "Horario", cambios: "Cambios por aprobar", cobertura: "Cobertura", maquinas: "Máquinas" };
    var migas = esCS
      ? '<a href="#/laboratorios">Laboratorios</a> › Sede ' + campusDe(l).nombre + " › " + l.nombre + ' › <span aria-current="page">' + nombres[seccion] + "</span>"
      : l.nombre + ' › <span aria-current="page">' + nombres[seccion] + "</span>";
    var pestanasLocales = esCS ? '<div class="segmentado" role="navigation" aria-label="Secciones del laboratorio" style="margin-bottom:20px">' +
      ["horario", "cambios", "cobertura", "maquinas"].map(function (s) {
        return '<button data-accion="ir" data-ruta="/laboratorios/' + l.id + "/" + s + '" aria-pressed="' + (s === seccion) + '">' + nombres[s] + "</button>";
      }).join("") + "</div>" : "";

    var v;
    if (seccion === "horario") v = vHorario(l, q);
    else if (seccion === "pendientes") v = { html: vPendientesLab(l) };
    else v = { html: vacioPendiente(nombres[seccion], "Esta sección se diseña en la siguiente iteración del prototipo.") };
    return { titulo: esCS ? l.nombre : nombres[seccion], migas: migas, html: pestanasLocales + v.html, extra: v.extra };
  }

  function vPendientesLab(l) {
    return '<div class="pila-l"><section class="pila"><h2>Esta semana</h2><ul class="lista">' +
      '<li><a href="#/laboratorios/' + l.id + '/horario">Viernes 27: no hay responsable de 13:00 a 17:00</a><small>El laboratorio quedaría cerrado en esa franja. Asigna un turno.</small></li>' +
      '<li><a href="#/laboratorios/' + l.id + '/horario?semana=2026-11-30">Andrés Brenes no ha aceptado su turno del viernes 4 de diciembre</a><small>Se le asignó fuera de su disponibilidad.</small></li>' +
      '<li><a href="#/laboratorios/' + l.id + '/cambios">1 cambio de turno por aprobar</a><small>Valeria Chaves tomó el turno del sábado 28 que ofreció José Pablo Mora.</small></li>' +
      "</ul></section>" +
      '<section class="pila"><h2>Máquinas fuera de servicio</h2><ul class="lista">' + l.fueraDeServicio.map(function (n) {
        return "<li><strong>" + l.prefijo + "-" + String(n).padStart(2, "0") + "</strong><small>Reportada por Diego Solís el lunes 23.</small></li>";
      }).join("") + "</ul></section></div>";
  }

  /* ---------- Horario y asignación (CU-06) ---------- */

  function turnosDeLaSemana(asId, lunes) {
    var fin = sumarDias(lunes, 7);
    return D.turnos.filter(function (t) { return t.asistente === asId && t.fecha >= lunes && t.fecha < fin && OCUPAN[t.estado]; });
  }
  function minutos(ts) { return ts.reduce(function (s, t) { return s + t.fin - t.ini; }, 0); }

  function evaluar(a, labId, f, ini, fin) {
    var lunes = lunesDe(f);
    var semana = turnosDeLaSemana(a.id, lunes);
    var choque = semana.filter(function (t) { return t.fecha === f && seTraslapan(t.ini, t.fin, ini, fin); })[0];
    var programados = minutos(semana);
    var tope = programados + (fin - ini) > a.topeMin;
    var dia = diaSemana(f);
    var dentro = a.disponibilidad.some(function (b) { return b.dia === dia && b.ini <= ini && fin <= b.fin; });
    return { choque: choque, programados: programados, tope: tope, dentro: dentro };
  }

  function vHorario(l, q) {
    var H = estado.horario;
    if (q.semana) H.semana = q.semana;
    var lunes = H.semana;
    var horasCol = "";
    for (var hh = 7; hh < 21; hh++) horasCol += "<span>" + hh + ":00</span>";

    var columnas = "";
    for (var i = 0; i < 7; i++) {
      var f = sumarDias(lunes, i);
      var esHoy = f === D.HOY.fecha;
      var celdas = "";
      for (var h = 7; h < 21; h++) {
        var pasada = f < D.HOY.fecha || (esHoy && h * 60 < D.HOY.minutos);
        var elegida = H.panel && H.panel.fecha === f && h * 60 >= H.panel.ini && h * 60 < H.panel.fin;
        celdas += '<button class="horario__celda' + (elegida ? " horario__celda--elegida" : "") + '" data-accion="celda" data-fecha="' + f + '" data-h="' + h + '"' +
          (pasada ? " disabled" : "") + ' aria-label="' + fechaLarga(f) + ", " + h + ":00" + (pasada ? ", ya pasó" : ", asignar turno") + '"></button>';
      }
      var bloques = D.turnos.filter(function (t) { return t.lab === l.id && t.fecha === f && t.estado !== "DESCARTADO"; }).map(function (t) {
        var a = asistente(t.asistente);
        var top = (t.ini - 420) / 60 * 44, alto = (t.fin - t.ini) / 60 * 44 - 2;
        var pend = t.estado === "PENDIENTE_ACEPTACION";
        return '<div class="turno turno--' + t.estado.toLowerCase() + (pend ? " turno--pendiente" : "") + (t.nuevo ? " turno--nuevo" : "") + '" style="top:' + top + "px;height:" + alto + 'px">' +
          "<strong>" + esc(a ? a.nombre : "Asistente") + "</strong>" + hora(t.ini) + " a " + hora(t.fin) + (pend ? "<br>Pendiente de aceptar" : t.estado === "EN_CURSO" ? "<br>En curso" : "") + "</div>";
      }).join("");
      columnas += '<div class="horario__dia" role="group" aria-label="' + fechaLarga(f) + '">' + celdas + bloques + "</div>";
    }

    var cabezas = '<div class="horario__cabeza"></div>';
    for (var k = 0; k < 7; k++) {
      var fk = sumarDias(lunes, k);
      cabezas += '<div class="horario__cabeza' + (fk === D.HOY.fecha ? " horario__cabeza--hoy" : "") + '"><strong>' + DIAS_CORTOS[diaSemana(fk)] + " " + diaMes(fk) + "</strong><small>" + (fk === D.HOY.fecha ? "hoy" : nombreMes(fk).slice(0, 3)) + "</small></div>";
    }

    var finSemana = sumarDias(lunes, 6);
    var titulo = "Semana del " + diaMes(lunes) + (nombreMes(lunes) !== nombreMes(finSemana) ? " de " + nombreMes(lunes) : "") + " al " + diaMes(finSemana) + " de " + nombreMes(finSemana);
    var puedeAtras = lunes > lunesDe(D.HOY.fecha);

    var html = '<div class="pila">' +
      '<div class="barra-semana"><div class="barra-semana__nav">' +
      '<button class="icono-boton" data-accion="semana" data-delta="-7" aria-label="Semana anterior"' + (puedeAtras ? "" : " disabled") + ">" + icono("atras") + "</button>" +
      "<strong>" + titulo + "</strong>" +
      '<button class="icono-boton" data-accion="semana" data-delta="7" aria-label="Semana siguiente">' + icono("adelante") + "</button></div>" +
      '<button class="boton" data-accion="abrir-panel">Asignar turno</button></div>' +
      '<div class="leyenda"><span><i class="asignado"></i>Asignado</span><span><i class="pendiente"></i>Pendiente de que el asistente acepte</span><span><i></i>Libre: toca para asignar</span><span><i class="paso"></i>Ya pasó</span></div>' +
      '<div class="horario-marco"><div class="horario-desplazable"><div class="horario">' + cabezas +
      '<div class="horario__horas" aria-hidden="true">' + horasCol + "</div>" + columnas + "</div></div>" +
      (H.panel ? panelAsignar(l) : "") + "</div></div>";
    return { html: html };
  }

  function panelAsignar(l) {
    var P = estado.horario.panel;
    var lunes = estado.horario.semana;
    var opcionesFecha = "";
    for (var i = 0; i < 7; i++) {
      var f = sumarDias(lunes, i);
      if (f < D.HOY.fecha) continue;
      opcionesFecha += '<option value="' + f + '"' + (f === P.fecha ? " selected" : "") + ">" + DIAS[diaSemana(f)] + " " + diaMes(f) + "</option>";
    }
    var opHora = function (sel, desde, hasta) {
      var o = "";
      for (var m = desde; m <= hasta; m += 30) o += '<option value="' + m + '"' + (m === sel ? " selected" : "") + ">" + hora(m) + "</option>";
      return o;
    };
    var minIni = P.fecha === D.HOY.fecha ? Math.ceil((D.HOY.minutos + 1) / 30) * 30 : 420;

    var ocupada = D.turnos.filter(function (t) { return t.lab === l.id && t.fecha === P.fecha && OCUPAN[t.estado] && seTraslapan(t.ini, t.fin, P.ini, P.fin); })[0];
    var valida = P.fin > P.ini;

    var personas = D.asistentes.map(function (a) {
      var ev = evaluar(a, l.id, P.fecha, P.ini, P.fin);
      var est, cls;
      if (ev.choque) {
        var lc = lab(ev.choque.lab);
        est = "Ya tiene turno de " + hora(ev.choque.ini) + " a " + hora(ev.choque.fin) + " en " + lc.nombre; cls = "mal";
      } else if (ev.tope) {
        est = "Pasaría su tope: " + horas(ev.programados + P.fin - P.ini) + " de " + horas(a.topeMin); cls = "mal";
      } else if (!ev.dentro) {
        est = "Fuera de su disponibilidad: quedará pendiente de que acepte"; cls = "pendiente";
      } else { est = "Disponible en ese horario"; cls = "bien"; }
      return '<li><label class="persona"><input type="radio" name="asistente" value="' + a.id + '" data-accion="elegir-asistente"' + (P.asistente === a.id ? " checked" : "") + ">" +
        '<span class="persona__nombre">' + esc(a.nombre) + ", categoría " + a.categoria + "</span>" +
        '<span class="medidor__texto">Esta semana tiene ' + horas(ev.programados) + " asignadas; su tope es de " + horas(a.topeMin) + ".</span>" +
        '<span class="persona__estado persona__estado--' + cls + '">' + est + "</span></label></li>";
    }).join("");

    var elegido = P.asistente ? asistente(P.asistente) : null;
    var evE = elegido ? evaluar(elegido, l.id, P.fecha, P.ini, P.fin) : null;
    var bloqueo = !valida ? "La hora de fin debe ser posterior a la de inicio." :
      ocupada ? "Ese horario ya tiene responsable en este laboratorio (" + esc(asistente(ocupada.asistente) ? asistente(ocupada.asistente).nombre : "otro asistente") + ", de " + hora(ocupada.ini) + " a " + hora(ocupada.fin) + ")." :
        !elegido ? null :
          evE.choque ? esc(elegido.nombre) + " ya tiene un turno de " + hora(evE.choque.ini) + " a " + hora(evE.choque.fin) + " en " + lab(evE.choque.lab).nombre + "." :
            evE.tope ? esc(elegido.nombre) + " llegaría a " + horas(evE.programados + P.fin - P.ini) + " esta semana y su tope es de " + horas(elegido.topeMin) + "." : null;
    var aviso = bloqueo ? '<div class="mensaje mensaje--error" role="alert"><p>' + bloqueo + "</p></div>" :
      (elegido && !evE.dentro ? '<div class="mensaje mensaje--pendiente"><p>Ese horario está fuera de la disponibilidad que ' + esc(elegido.nombre) + " declaró. El turno quedará pendiente hasta que lo acepte, y se le avisará.</p></div>" : "");
    var errorServidor = P.error ? '<div class="mensaje mensaje--error" role="alert"><p><strong>' + P.error.titulo + "</strong></p><p>" + P.error.texto + "</p></div>" : "";
    var reintento = P.reintento ? '<div class="mensaje mensaje--pendiente" role="status"><p>No llegó la respuesta. Reintentando con la misma solicitud…</p></div>' : "";
    var habilitado = elegido && !bloqueo && !P.enviando;

    return '<aside class="panel" aria-labelledby="titulo-panel"><div class="panel__cabeza"><h2 id="titulo-panel">Asignar turno</h2>' +
      '<button class="boton boton--texto" data-accion="cerrar-panel">Cerrar</button></div><div class="pila">' +
      '<div class="campos"><div class="campo campo--ancho"><label for="p-fecha">Día</label><select id="p-fecha" data-accion="p-campo" data-campo="fecha">' + opcionesFecha + "</select></div>" +
      '<div class="campo"><label for="p-ini">Desde</label><select id="p-ini" data-accion="p-campo" data-campo="ini">' + opHora(P.ini, minIni, 1230) + "</select></div>" +
      '<div class="campo"><label for="p-fin">Hasta</label><select id="p-fin" data-accion="p-campo" data-campo="fin">' + opHora(P.fin, minIni + 30, 1260) + "</select></div></div>" +
      '<fieldset class="campo" style="border:0;padding:0;margin:0"><legend>Asistente</legend><ul class="personas">' + personas + "</ul></fieldset>" +
      aviso + reintento + errorServidor +
      '<button class="boton boton--ancho" data-accion="asignar"' + (habilitado ? "" : " disabled") + (P.enviando ? ' aria-busy="true"' : "") + ">" + (P.enviando ? "Asignando…" : "Asignar turno") + "</button></div></aside>";
  }

  /* ================= Coordinación de soporte ================= */

  function vPanel() {
    return { titulo: "Panel", html: '<div class="pila-l"><section class="pila"><h2>Requiere atención</h2><ul class="lista">' +
      '<li><a href="#/cierres/2026/10">Octubre de 2026 todavía no se ha cerrado</a><small>El cierre automático del día 1 no se ejecutó. Puedes cerrarlo ahora.</small></li>' +
      '<li><a href="#/laboratorios/c1/horario">Laboratorio Cartago 1: viernes 27 sin responsable de 13:00 a 17:00</a><small>Turno vacante.</small></li>' +
      '<li><a href="#/seleccion">2 postulaciones por evaluar</a><small>Convocatoria del primer semestre de 2027.</small></li>' +
      "</ul></section>" +
      '<section class="pila"><h2>Laboratorios hoy</h2><ul class="labs">' + D.laboratorios.map(function (l) {
        var hoy = franjasAbiertas(l.id, D.HOY.fecha);
        return '<li><a class="lab" href="#/laboratorios/' + l.id + '/horario"><div class="lab__fila"><span class="lab__nombre">' + l.nombre + '</span><span class="lab__estado">' + l.fueraDeServicio.length + " fuera de servicio</span></div>" +
          '<span class="lab__horario">Hoy: ' + (hoy.length ? "abierto " + textoFranjas(hoy) : "cerrado") + "</span></a></li>";
      }).join("") + "</ul></section></div>" };
  }

  /* ---------- Cierre mensual (CU-14) ---------- */

  function estadoMes(a, m) {
    var clave = a + "-" + m;
    if (estado.cierres.cerrados[clave]) return "CERRADO";
    if (a === 2026 && m === 11) return "EN_CURSO";
    if (a === 2026 && m === 12) return "FUTURO";
    if (a === 2026 && m === 10) return "POR_CERRAR";
    return "CERRADO";
  }

  function vCierres() {
    var meses = "";
    for (var m = 1; m <= 12; m++) {
      var e = estadoMes(2026, m);
      var texto = { CERRADO: "Cerrado", POR_CERRAR: "Por cerrar", EN_CURSO: "En curso", FUTURO: "Aún no empieza" }[e];
      var clase = "mes" + (e === "POR_CERRAR" ? " mes--por-cerrar" : e === "FUTURO" ? " mes--futuro" : "");
      var contenido = "<strong>" + MESES[m - 1].replace(/^./, function (c) { return c.toUpperCase(); }) + "</strong><small>" + texto + "</small>";
      meses += e === "FUTURO" ? '<div class="' + clase + '">' + contenido + "</div>" : '<a class="' + clase + '" href="#/cierres/2026/' + m + '">' + contenido + "</a>";
    }
    return { titulo: "Cierre mensual", html: '<div class="pila"><h2>2026</h2><div class="meses">' + meses + "</div></div>" };
  }

  function lineasDe(a, m) {
    var base = D.liquidaciones[a + "-" + m] || D.liquidaciones["2026-9"];
    var tar = D.tarifas[0];
    return base.map(function (b) {
      var as = asistente(b.asistente);
      var t = tar.porHoraCentimos[as.categoria];
      var monto = Math.round(b.normales / 60 * t + b.recargo / 60 * t * (1 + tar.porcentajeRecargo / 100));
      var noPag = b.noPagados.reduce(function (s, x) { return s + x.minutos; }, 0);
      return { as: as, normales: b.normales, recargo: b.recargo, noPagados: b.noPagados, minNoPag: noPag, monto: monto };
    });
  }

  function vCierreMes(mm) {
    var a = +mm[1], m = +mm[2];
    var e = estadoMes(a, m);
    var nombre = MESES[m - 1].replace(/^./, function (c) { return c.toUpperCase(); }) + " de " + a;
    var migas = '<a href="#/cierres">Cierre mensual</a> › <span aria-current="page">' + nombre + "</span>";
    var C = estado.cierres;

    if (e === "EN_CURSO" || e === "FUTURO") {
      return { titulo: nombre, migas: migas, html: '<div class="vacio"><p><strong>Este mes todavía no termina.</strong></p><p>Se podrá cerrar a partir del día 1 del mes siguiente.</p>' +
        '<div class="acciones"><button class="boton" disabled>Cerrar mes</button></div></div>' };
    }
    if (e === "POR_CERRAR") {
      var extra = C.confirmar ? '<div class="velo" data-accion="cerrar-modal"><div class="hoja" role="dialog" aria-modal="true" aria-labelledby="titulo-cierre">' +
        '<h2 id="titulo-cierre">¿Cerrar ' + nombre.toLowerCase() + "?</h2><div class=\"pila\"><p>El sistema calculará las horas y el pago de cada asistente con las marcas de entrada y salida, y generará el archivo para Becas.</p>" +
        "<p><strong>Un mes cerrado no se puede recalcular ni corregir.</strong> Si hay un error, se arregla fuera del sistema y se deja una constancia.</p>" +
        '<div class="acciones"><button class="boton boton--secundario" data-accion="cancelar-cierre">Volver</button><button class="boton" data-accion="confirmar-cierre"' + (C.calculando ? " disabled aria-busy=\"true\"" : "") + ">" + (C.calculando ? "Cerrando el mes…" : "Cerrar mes") + "</button></div></div></div></div>" : "";
      var err = C.error ? '<div class="mensaje mensaje--error" role="alert"><p><strong>' + C.error.titulo + "</strong></p><p>" + C.error.texto + '</p><div class="acciones"><a class="boton boton--secundario" href="#/tarifas">Ir a tarifas</a></div></div>' : "";
      return { titulo: nombre, migas: migas, extra: extra, html: '<div class="pila">' + err + '<div class="vacio"><p><strong>Este mes aún no se ha cerrado.</strong></p>' +
        "<p>El cierre automático del 1 de noviembre no se ejecutó. Puedes cerrarlo ahora; si ya lo hizo otra persona, verás el mismo resultado.</p>" +
        '<div class="acciones"><button class="boton" data-accion="pedir-cierre">Cerrar mes</button></div></div></div>' };
    }

    var lineas = lineasDe(a, m);
    var total = lineas.reduce(function (s, x) { return s + x.monto; }, 0);
    var cerradoEn = C.cerrados[a + "-" + m] || (a + "-" + String(m + 1).padStart(2, "0") + "-01T00:05");
    var fc = cerradoEn.slice(0, 10), hc = cerradoEn.slice(11);
    var filas = lineas.map(function (x) {
      var nota = x.noPagados.map(function (n) {
        return '<span class="nota-fila">' + duracion(n.minutos) + (n.motivo === "SOBRE_TOPE" ? " sobre su tope" : " sin marca de salida") + " en la semana del " + diaMes(n.semana) + " de " + nombreMes(n.semana) + ". No se pagan.</span>";
      }).join("");
      return "<tr" + (x.minNoPag ? ' class="resaltada"' : "") + "><td><strong>" + esc(x.as.nombre) + '</strong><span class="carne">Carné ' + x.as.carne + "</span>" + nota + "</td>" +
        "<td>" + x.as.categoria + '</td><td class="num">' + horasTabla(x.normales) + '</td><td class="num">' + horasTabla(x.recargo) + '</td><td class="num">' + horasTabla(x.minNoPag) + '</td><td class="num">' + dinero(x.monto) + "</td></tr>";
    }).join("");
    var tar = D.tarifas[0];
    var conNoPag = lineas.filter(function (x) { return x.minNoPag; }).length;

    return { titulo: nombre, migas: migas, html: '<div class="pila-l">' +
      '<div class="barra-semana"><div><p class="cifra">' + dinero(total) + '</p><p class="subtitulo">Total a pagar a ' + lineas.length + " asistentes. Cerrado el " + diaMes(fc) + " de " + nombreMes(fc) + " a las " + hc.replace(/^0/, "") + ".</p></div>" +
      '<button class="boton" data-accion="descargar" data-anio="' + a + '" data-mes="' + m + '">Descargar archivo para Becas</button></div>' +
      (conNoPag ? '<div class="mensaje mensaje--pendiente"><p>' + conNoPag + " asistentes tienen horas que no se pagan. Están resaltados en la tabla.</p></div>" : "") +
      '<div class="tabla-marco"><table><caption class="visualmente-oculto">Liquidación por asistente</caption><thead><tr><th scope="col">Asistente</th><th scope="col">Categoría</th><th scope="col" class="num">Horas normales</th><th scope="col" class="num">Con recargo</th><th scope="col" class="num">No pagadas</th><th scope="col" class="num">Monto</th></tr></thead>' +
      "<tbody>" + filas + '</tbody><tfoot><tr><td colspan="5">Total</td><td class="num">' + dinero(total) + "</td></tr></tfoot></table></div>" +
      '<section class="pila"><h2>Tarifas aplicadas</h2><div class="tabla-marco"><table><thead><tr><th scope="col">Vigente desde</th><th scope="col" class="num">Categoría A, por hora</th><th scope="col" class="num">Categoría B, por hora</th><th scope="col" class="num">Recargo</th></tr></thead>' +
      "<tbody><tr><td>" + diaMes(tar.vigenteDesde) + " de " + nombreMes(tar.vigenteDesde) + " de 2026</td><td class=\"num\">" + dinero(tar.porHoraCentimos.A) + '</td><td class="num">' + dinero(tar.porHoraCentimos.B) + '</td><td class="num">' + tar.porcentajeRecargo + " %</td></tr></tbody></table></div>" +
      '<p class="subtitulo">El recargo aplica a los turnos que empiezan a las 18:00 o después y a los de sábado y domingo.</p></section></div>' };
  }

  function descargarCsv(a, m) {
    var lineas = lineasDe(a, m);
    var dos = function (min) { return (min / 60).toFixed(2); };
    var filas = ["mes,carne,nombre,categoria,horas_normales,horas_con_recargo,horas_no_pagadas,monto_colones"].concat(lineas.map(function (x) {
      return [a + "-" + String(m).padStart(2, "0"), x.as.carne, '"' + x.as.nombre + '"', x.as.categoria, dos(x.normales), dos(x.recargo), dos(x.minNoPag), (x.monto / 100).toFixed(2)].join(",");
    }));
    var blob = new Blob([filas.join("\n") + "\n"], { type: "text/csv;charset=utf-8" });
    var enlace = document.createElement("a");
    enlace.href = URL.createObjectURL(blob);
    enlace.download = "becas-" + a + "-" + String(m).padStart(2, "0") + ".csv";
    document.body.appendChild(enlace); enlace.click(); enlace.remove();
    anunciar("Archivo para Becas descargado.");
  }

  /* ================= Otras vistas ================= */

  function vacioPendiente(titulo, texto) {
    return '<div class="vacio"><p><strong>' + titulo + "</strong></p><p>" + texto + "</p><p class=\"subtitulo\">Esta pantalla está fuera del núcleo ejecutable y se diseñará en la siguiente iteración.</p></div>";
  }
  function vPendienteDe(titulo, texto) { return function () { return { titulo: titulo, html: vacioPendiente(titulo, texto) }; }; }

  function vAvisos() {
    return { titulo: "Avisos", html: '<ul class="lista">' + avisosDe(estado.usuario).map(function (a) {
      return '<li><a href="#' + a.ruta + '">' + a.t + "</a><small>" + a.s + "</small></li>";
    }).join("") + "</ul>" };
  }
  function vMas() {
    return { titulo: "Más opciones", html: '<ul class="lista">' + navDe(estado.usuario).slice(4).map(function (i) {
      return '<li><a href="#' + i.ruta + '">' + i.texto + "</a></li>";
    }).join("") + "</ul>" };
  }
  function vSinPermiso() {
    return { titulo: "Sin permiso", html: '<div class="vacio"><p><strong>Esta pantalla no está disponible para tu rol.</strong></p><p>Si crees que deberías tener acceso, pídelo a la Coordinación de Soporte.</p>' +
      '<div class="acciones"><a class="boton" href="#' + inicioDe(estado.usuario) + '">Ir a mi inicio</a></div></div>' };
  }

  /* ================= Simulación del servidor ================= */

  function servidor(exito, conflicto, forzarNormal) {
    // Normal: responde a los 600 ms. Conflicto: otra persona se adelantó. Sin respuesta: reintenta con la misma clave.
    var esc_ = forzarNormal ? "normal" : estado.escenario;
    return new Promise(function (resolver) {
      if (esc_ === "conflicto") { setTimeout(function () { resolver({ ok: false, error: conflicto }); }, 600); return; }
      if (esc_ === "sin-respuesta") { setTimeout(function () { resolver({ ok: false, reintentar: true }); }, 900); return; }
      setTimeout(function () { resolver({ ok: true, valor: exito }); }, 600);
    });
  }

  /* ================= Eventos ================= */

  function conectar() {
    raiz.querySelectorAll("[data-accion]").forEach(function (el) {
      var accion = el.getAttribute("data-accion");
      var evento = el.tagName === "SELECT" || (el.tagName === "INPUT" && el.type === "radio") ? "change" : "click";
      el.addEventListener(evento, function (ev) { manejar(accion, el, ev); });
    });
  }

  function manejar(accion, el, ev) {
    var R = estado.reserva, H = estado.horario, C = estado.cierres;
    switch (accion) {
      case "entrar":
        estado.usuario = D.usuarios.filter(function (u) { return u.id === el.getAttribute("data-usuario"); })[0];
        guardar("sesion", estado.usuario.id);
        ir(inicioDe(estado.usuario));
        return;
      case "salir":
        estado.usuario = null; guardar("sesion", null); ir("/ingresar"); return;
      case "menu-usuario":
        var menu = el.parentNode.querySelector(".usuario__menu");
        menu.hidden = !menu.hidden; el.setAttribute("aria-expanded", String(!menu.hidden)); return;
      case "escenario":
        estado.escenario = el.value; anunciar("Escenario: " + el.options[el.selectedIndex].text); return;
      case "ir":
        ir(el.getAttribute("data-ruta")); return;

      // Reservar
      case "sede":
        estado.sede = el.getAttribute("data-sede"); guardar("sede", estado.sede); render(); return;
      case "dia":
        R.inicio = R.dur = R.maquina = null; R.error = null; ir("/reservar?fecha=" + el.getAttribute("data-fecha")); return;
      case "inicio":
        R.inicio = +el.getAttribute("data-v"); R.dur = null; R.maquina = null; R.error = null; render(); return;
      case "dur":
        R.dur = +el.getAttribute("data-v"); R.maquina = null; R.error = null; render(); return;
      case "maquina":
        R.maquina = +el.getAttribute("data-v"); R.error = null; R.confirmar = false; render(); return;
      case "pedir-confirmacion":
        R.confirmar = true; estado.clave = nuevaClave(); render();
        var b = raiz.querySelector('[data-accion="confirmar-reserva"]'); if (b) b.focus(); return;
      case "cerrar-hoja":
        if (ev.target !== el) return;
        R.confirmar = false; render(); return;
      case "cancelar-hoja":
        R.confirmar = false; render(); return;
      case "confirmar-reserva":
        confirmarReserva(); return;
      case "cancelar-reserva":
        estado.estudiante.minutosSemana -= (estado.estudiante.reservaActiva.fin - estado.estudiante.reservaActiva.ini);
        estado.estudiante.reservaActiva = null; anunciar("Reserva cancelada."); render(); return;

      // Mi turno
      case "marcar-salida":
        estado.marca.salida = hora(D.HOY.minutos); anunciar("Salida registrada."); render(); return;

      // Horario
      case "semana":
        H.panel = null; ir(location.hash.split("#")[1].split("?")[0] + "?semana=" + sumarDias(H.semana, +el.getAttribute("data-delta"))); return;
      case "celda":
        var hh = +el.getAttribute("data-h") * 60;
        H.panel = { fecha: el.getAttribute("data-fecha"), ini: hh, fin: Math.min(hh + 240, 1260), asistente: null };
        render(); enfocar("#p-fecha"); return;
      case "abrir-panel":
        var f0 = H.semana < D.HOY.fecha ? D.HOY.fecha : H.semana;
        var i0 = f0 === D.HOY.fecha ? Math.ceil((D.HOY.minutos + 1) / 30) * 30 : 420;
        H.panel = { fecha: f0, ini: i0, fin: Math.min(i0 + 240, 1260), asistente: null };
        render(); enfocar("#p-fecha"); return;
      case "cerrar-panel":
        H.panel = null; render(); return;
      case "p-campo":
        var campo = el.getAttribute("data-campo");
        H.panel[campo] = campo === "fecha" ? el.value : +el.value;
        H.panel.error = null; render(); enfocar("#p-" + campo); return;
      case "elegir-asistente":
        H.panel.asistente = el.value; H.panel.error = null; render(); enfocar('input[value="' + el.value + '"]'); return;
      case "asignar":
        asignarTurno(); return;

      // Cierre
      case "pedir-cierre":
        C.confirmar = true; C.error = null; render(); enfocar('[data-accion="confirmar-cierre"]'); return;
      case "cerrar-modal":
        if (ev.target !== el) return;
        C.confirmar = false; render(); return;
      case "cancelar-cierre":
        C.confirmar = false; render(); return;
      case "confirmar-cierre":
        C.calculando = true; render();
        setTimeout(function () {
          C.calculando = false; C.confirmar = false;
          C.cerrados["2026-10"] = "2026-11-24T10:00";
          anunciar("Octubre de 2026 cerrado.");
          render();
        }, 1200);
        return;
      case "descargar":
        descargarCsv(+el.getAttribute("data-anio"), +el.getAttribute("data-mes")); return;
    }
  }

  function enfocar(sel) { var e = raiz.querySelector(sel); if (e) e.focus(); }

  function confirmarReserva() {
    var R = estado.reserva;
    var labId = leerRuta().ruta.split("/")[2];
    var l = lab(labId);
    var idM = l.prefijo + "-" + String(R.maquina).padStart(2, "0");
    R.enviando = true; R.error = null; render();
    servidor(null, { titulo: "Alguien acaba de reservar " + idM + " para ese horario.", texto: "Elige otra máquina; la lista ya está actualizada." })
      .then(function manejarRespuesta(res) {
        if (res.reintentar) {
          // Mismo intento, misma clave (ADR-0010): el servidor devuelve la reserva sin duplicarla.
          R.reintento = true; render();
          return servidor(null, null, true).then(function (r2) { R.reintento = false; return manejarRespuesta(r2); });
        }
        R.enviando = false;
        if (!res.ok) {
          estado.reservasExtra.push({ lab: labId, fecha: R.fecha, maquina: R.maquina, ini: R.inicio, fin: R.inicio + R.dur });
          R.error = res.error; R.confirmar = false; R.maquina = null; render();
          anunciar(res.error.titulo);
          return;
        }
        var hecha = { maquina: idM, labNombre: l.nombre, fecha: R.fecha, ini: R.inicio, fin: R.inicio + R.dur };
        estado.estudiante.reservaActiva = hecha;
        estado.estudiante.minutosSemana += R.dur;
        estado.reservasExtra.push({ lab: labId, fecha: R.fecha, maquina: R.maquina, ini: R.inicio, fin: R.inicio + R.dur });
        R.hecha = hecha; R.confirmar = false; R.inicio = R.dur = R.maquina = null;
        render(); anunciar("Reserva confirmada.");
        window.scrollTo(0, 0);
        setTimeout(function () { R.hecha = null; }, 0);
      });
  }

  function asignarTurno() {
    var H = estado.horario, P = H.panel;
    var labId = leerRuta().ruta.split("/")[2];
    var a = asistente(P.asistente);
    var ev = evaluar(a, labId, P.fecha, P.ini, P.fin);
    P.enviando = true; P.error = null; render();
    servidor(null, { titulo: "Ese horario ya tiene responsable en este laboratorio.", texto: "Otra persona asignó un turno en esa franja hace un momento. Elige otro horario." })
      .then(function manejarRespuesta(res) {
        if (res.reintentar) {
          P.reintento = true; render();
          return servidor(null, null, true).then(function (r2) { P.reintento = false; return manejarRespuesta(r2); });
        }
        P.enviando = false;
        if (!res.ok) { P.error = res.error; render(); anunciar(res.error.titulo); return; }
        var t = { id: "n" + Date.now(), lab: labId, asistente: a.id, fecha: P.fecha, ini: P.ini, fin: P.fin,
          estado: ev.dentro ? "ASIGNADO" : "PENDIENTE_ACEPTACION", nuevo: true };
        D.turnos.push(t);
        H.panel = null; render();
        anunciar(ev.dentro ? "Turno asignado a " + a.nombre + "." : "Turno pendiente. Se avisó a " + a.nombre + ".");
        t.nuevo = false;
      });
  }

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (estado.reserva.confirmar) { estado.reserva.confirmar = false; render(); }
    else if (estado.cierres.confirmar) { estado.cierres.confirmar = false; render(); }
    else if (estado.horario.panel) { estado.horario.panel = null; render(); }
  });

  window.addEventListener("hashchange", render);
  render();
})();
