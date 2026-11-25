// Pantallas de "Reservar una máquina" (CU-11, docs/diseno-ux-ui.md 15.6) y "Mis reservas".
// Vistas humildes: el texto y las reglas de qué se ofrece salen de presentador.ts.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { Pagina } from "../../app/Pagina";
import { useSesion } from "../../app/sesion";
import { api, nuevaClave } from "../../compartido/api/cliente";
import type { Disponibilidad, Laboratorio, MisReservas, ReservaCreada } from "../../compartido/api/tipos";
import { Cargando, Hoja, Mensaje, Vacio } from "../../compartido/ui/componentes";
import { fechaDe, fechaLarga, hora, instanteApi, mayuscula, minutosDe, sumarDias } from "../../compartido/ui/formato";
import {
  avisoDeCupo,
  confirmacion,
  diasOfrecidos,
  DIAS_DE_ANTICIPACION,
  duracionesPosibles,
  iniciosPosibles,
  type MensajeDeError,
  mensajeDeErrorDeReserva,
  minutosRestantes,
  planoDelLaboratorio,
  sedesDe,
  tarjetaDeLaboratorio,
  textoDelCupo,
  textoDeFranjas,
  textoDeReserva
} from "./presentador";

const CLAVE_SEDE = "compulab-sede";
/** N-6: la aplicación recuerda la última sede usada. Si el almacenamiento no está disponible, no pasa nada. */
const sedeRecordada = () => {
  try {
    return localStorage.getItem(CLAVE_SEDE);
  } catch {
    return null;
  }
};
const recordarSede = (sede: string) => {
  try {
    localStorage.setItem(CLAVE_SEDE, sede);
  } catch {
    /* sin almacenamiento */
  }
};

function useDatosBase() {
  const [laboratorios, setLaboratorios] = useState<Laboratorio[] | null>(null);
  const [mias, setMias] = useState<MisReservas | null>(null);
  const recargarMias = useCallback(() => api.get<MisReservas>("/api/v1/reservas/mias").then((r) => setMias(r.datos)), []);
  useEffect(() => {
    void api.get<Laboratorio[]>("/api/v1/laboratorios").then((r) => setLaboratorios(r.datos));
    void recargarMias();
  }, [recargarMias]);
  return { laboratorios, mias, recargarMias };
}

function AvisoDeCupo({ mias, laboratorios }: { mias: MisReservas; laboratorios: Laboratorio[] }) {
  const aviso = avisoDeCupo(mias, laboratorios);
  if (!aviso) return null;
  return (
    <Mensaje tipo={aviso.tipo === "agotado" ? "error" : "informacion"} titulo={aviso.titulo} acciones={aviso.tipo === "activa" && <Link className="boton boton--secundario" to="/mis-reservas">Ver mis reservas</Link>}>
      {aviso.texto}
    </Mensaje>
  );
}

export function PantallaReservar() {
  const { hoy } = useSesion();
  const [parametros, setParametros] = useSearchParams();
  const { laboratorios, mias } = useDatosBase();
  const [sede, setSede] = useState<string | null>(sedeRecordada());
  const [disponibilidad, setDisponibilidad] = useState<Map<string, Disponibilidad> | null>(null);
  const abiertoPorFecha = useMemo(() => {
    const mapa = new Map<string, boolean>();
    for (const d of disponibilidad?.values() ?? []) mapa.set(d.fecha, (mapa.get(d.fecha) ?? false) || d.franjasAbiertas.length > 0);
    return mapa;
  }, [disponibilidad]);
  // Sin día elegido, se muestra el primer día con algún laboratorio abierto (N-7: no se ofrece un día cerrado).
  const primerDiaAbierto = [...abiertoPorFecha].filter(([, abierto]) => abierto).map(([f]) => f).sort()[0];
  const fecha = parametros.get("fecha") ?? primerDiaAbierto ?? hoy();
  const sedes = useMemo(() => (laboratorios ? sedesDe(laboratorios) : []), [laboratorios]);
  const sedeValida = sede && sedes.includes(sede) ? sede : null;
  const labsDeLaSede = useMemo(() => (laboratorios ?? []).filter((l) => l.campus === sedeValida), [laboratorios, sedeValida]);

  // Disponibilidad de los 7 días para marcar los días sin laboratorios abiertos.
  useEffect(() => {
    if (labsDeLaSede.length === 0) return;
    setDisponibilidad(null);
    const dias = Array.from({ length: DIAS_DE_ANTICIPACION + 1 }, (_, i) => sumarDias(hoy(), i));
    const pedidos = labsDeLaSede.flatMap((l) => dias.map((d) => api.get<Disponibilidad>(`/api/v1/laboratorios/${l.id}/disponibilidad?fecha=${d}`).then((r) => r.datos)));
    void Promise.all(pedidos).then((lista) => setDisponibilidad(new Map(lista.map((d) => [`${d.idLaboratorio}|${d.fecha}`, d]))));
  }, [labsDeLaSede, hoy]);

  const elegirSede = (s: string) => {
    recordarSede(s);
    setSede(s);
  };

  if (!laboratorios || !mias) {
    return (
      <Pagina titulo="Reservar una máquina">
        <Cargando />
      </Pagina>
    );
  }

  if (!sedeValida) {
    return (
      <Pagina titulo="Reservar una máquina">
        <div className="pila">
          <h2>¿En qué sede vas a trabajar?</h2>
          <p className="subtitulo">La recordaremos para la próxima vez. Puedes cambiarla cuando quieras.</p>
          <div className="acciones">
            {sedes.map((s) => (
              <button key={s} className="boton boton--secundario" onClick={() => elegirSede(s)}>
                {s}
              </button>
            ))}
          </div>
        </div>
      </Pagina>
    );
  }


  return (
    <Pagina titulo="Reservar una máquina" migas={<>Sede {sedeValida}</>}>
      <div className="pila-l">
        <div className="pila">
          <div className="segmentado" role="group" aria-label="Sede">
            {sedes.map((s) => (
              <button key={s} aria-pressed={s === sedeValida} onClick={() => elegirSede(s)}>
                {s}
              </button>
            ))}
          </div>
          <p className="medidor__texto">{textoDelCupo(mias)}</p>
          <AvisoDeCupo mias={mias} laboratorios={laboratorios} />
        </div>
        <section className="pila">
          <h2>¿Qué día?</h2>
          <div className="chips" role="group" aria-label="Día">
            {diasOfrecidos(hoy(), abiertoPorFecha).map((d) => (
              <button key={d.fecha} className="chip" aria-pressed={d.fecha === fecha} disabled={d.cerrado} onClick={() => setParametros({ fecha: d.fecha })}>
                <span>{d.etiqueta}</span>
                <small>{d.detalle}</small>
              </button>
            ))}
          </div>
        </section>
        <section className="pila">
          <h2>
            Laboratorios de {sedeValida}, {fechaLarga(fecha)}
          </h2>
          {!disponibilidad ? (
            <Cargando />
          ) : (
            <ul className="labs">
              {labsDeLaSede.map((l) => {
                const d = disponibilidad.get(`${l.id}|${fecha}`);
                if (!d) return null;
                const t = tarjetaDeLaboratorio(l, d);
                return (
                  <li key={l.id}>
                    {t.abierto ? (
                      <Link className="lab" to={`/reservar/${l.id}?fecha=${fecha}`}>
                        <div className="lab__fila">
                          <span className="lab__nombre">{t.nombre}</span>
                          <span className="lab__estado">{t.maquinas}</span>
                        </div>
                        <span className="lab__horario">{t.horario}</span>
                      </Link>
                    ) : (
                      <div className="lab lab--cerrado">
                        <div className="lab__fila">
                          <span className="lab__nombre">{t.nombre}</span>
                          <span className="lab__estado">{t.horario}</span>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </Pagina>
  );
}

interface Eleccion {
  inicio: number | null;
  minutos: number | null;
  maquina: string | null;
}

export function PantallaReservarLaboratorio() {
  const { ahora, hoy } = useSesion();
  const { idLaboratorio = "" } = useParams();
  const [parametros] = useSearchParams();
  const fecha = parametros.get("fecha") ?? hoy();
  const { laboratorios, mias, recargarMias } = useDatosBase();
  const [disponibilidad, setDisponibilidad] = useState<Disponibilidad | null>(null);
  const [eleccion, setEleccion] = useState<Eleccion>({ inicio: null, minutos: null, maquina: null });
  const [clave, setClave] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [reintentando, setReintentando] = useState(false);
  const [error, setError] = useState<MensajeDeError | null>(null);
  const [hecha, setHecha] = useState<ReservaCreada | null>(null);

  const cargarDisponibilidad = useCallback(
    () => api.get<Disponibilidad>(`/api/v1/laboratorios/${idLaboratorio}/disponibilidad?fecha=${fecha}`).then((r) => setDisponibilidad(r.datos)),
    [idLaboratorio, fecha]
  );
  useEffect(() => {
    void cargarDisponibilidad();
  }, [cargarDisponibilidad]);

  const laboratorio = laboratorios?.find((l) => l.id === idLaboratorio);
  const titulo = laboratorio?.nombre ?? "Reservar una máquina";
  const migas = (
    <>
      <Link to={`/reservar?fecha=${fecha}`}>Sede {laboratorio?.campus ?? ""}</Link> › <span aria-current="page">{titulo}</span>
    </>
  );

  if (!disponibilidad || !mias || !laboratorios) {
    return (
      <Pagina titulo={titulo} migas={migas}>
        <Cargando />
      </Pagina>
    );
  }

  if (hecha) {
    const f = fechaDe(hecha.inicio);
    const codigo = disponibilidad.maquinas.find((m) => m.id === hecha.idMaquina)?.codigo ?? hecha.idMaquina;
    return (
      <Pagina titulo="Reserva confirmada" migas={migas}>
        <div className="confirmado pila" role="status">
          <span className="confirmado__cinta">{codigo}</span>
          <p className="confirmado__hora">Antes de las {hora(minutosDe(hecha.limitePresentacion))}</p>
          <p>
            Preséntate en el {titulo} el {fechaLarga(f)}. Tu reserva es de {hora(minutosDe(hecha.inicio))} a {hora(minutosDe(hecha.fin, f))}; si no llegas en los primeros 15 minutos, la máquina se libera.
          </p>
          <div className="acciones">
            <Link className="boton" to="/mis-reservas">
              Ver mis reservas
            </Link>
            <Link className="boton boton--secundario" to="/reservar">
              Volver a la sede
            </Link>
          </div>
        </div>
      </Pagina>
    );
  }

  const tieneActiva = mias.activa !== null;
  const restante = minutosRestantes(mias);
  const inicios = iniciosPosibles(disponibilidad, ahora());
  const duraciones = duracionesPosibles(disponibilidad, eleccion.inicio, restante, tieneActiva);
  const filas = planoDelLaboratorio(disponibilidad, eleccion.inicio, eleccion.minutos, eleccion.maquina, tieneActiva);
  const maquina = disponibilidad.maquinas.find((m) => m.id === eleccion.maquina);
  const listo = eleccion.inicio !== null && eleccion.minutos !== null && maquina !== undefined;

  // Cambiar la elección es una intención nueva: se descarta la clave de solicitud anterior.
  const elegir = (cambio: Partial<Eleccion>) => {
    setEleccion((e) => ({ ...e, ...cambio }));
    setClave(null);
    setError(null);
  };

  async function reservar() {
    if (eleccion.inicio === null || eleccion.minutos === null || !maquina || !clave) return;
    setEnviando(true);
    setReintentando(false);
    setError(null);
    try {
      const { datos } = await api.post<ReservaCreada>("/api/v1/reservas", {
        clave,
        alReintentar: () => setReintentando(true),
        cuerpo: { idMaquina: maquina.id, inicio: instanteApi(fecha, eleccion.inicio), fin: instanteApi(fecha, eleccion.inicio + eleccion.minutos) }
      });
      setHecha(datos);
      void recargarMias();
    } catch (e) {
      const mensaje = mensajeDeErrorDeReserva(e);
      setError(mensaje);
      setClave(null);
      if (mensaje.accion === "otra-maquina") {
        setEleccion((x) => ({ ...x, maquina: null }));
        void cargarDisponibilidad();
      }
      if (mensaje.accion === "mis-reservas") void recargarMias();
    } finally {
      setEnviando(false);
      setReintentando(false);
    }
  }

  const conf = listo && eleccion.inicio !== null && eleccion.minutos !== null && maquina ? confirmacion(maquina.codigo, titulo, fecha, eleccion.inicio, eleccion.minutos, restante) : null;

  return (
    <Pagina titulo={titulo} migas={migas}>
      <div className="pila-l">
        <p className="subtitulo">
          {mayuscula(fechaLarga(fecha))}. {disponibilidad.franjasAbiertas.length ? `Abierto ${textoDeFranjas(disponibilidad.franjasAbiertas, fecha)}.` : "Cerrado este día."}
        </p>
        <AvisoDeCupo mias={mias} laboratorios={laboratorios} />
        {error && (
          <Mensaje
            tipo="error"
            titulo={error.titulo}
            acciones={error.accion === "mis-reservas" && <Link className="boton boton--secundario" to="/mis-reservas">Ir a mis reservas</Link>}
          >
            {error.texto}
          </Mensaje>
        )}
        <section className="pila">
          <h2>¿A qué hora llegas?</h2>
          {inicios.length === 0 ? (
            <p className="subtitulo">Ya no quedan horas disponibles en este día.</p>
          ) : (
            <div className="chips" role="group" aria-label="Hora de inicio">
              {inicios.map((m) => (
                <button key={m} className="chip" aria-pressed={eleccion.inicio === m} disabled={tieneActiva} onClick={() => elegir({ inicio: m, minutos: null, maquina: null })}>
                  {hora(m)}
                </button>
              ))}
            </div>
          )}
        </section>
        <section className="pila">
          <h2>¿Cuánto tiempo?</h2>
          <div className="chips" role="group" aria-label="Duración">
            {duraciones.map((d) => (
              <button key={d.minutos} className="chip" aria-pressed={eleccion.minutos === d.minutos} disabled={!d.habilitada} onClick={() => elegir({ minutos: d.minutos, maquina: null })}>
                <span>{d.texto}</span>
                {d.razon && !d.habilitada && <small>{d.razon}</small>}
              </button>
            ))}
          </div>
        </section>
        <section className="pila">
          <h2>Elige una máquina</h2>
          {(eleccion.inicio === null || eleccion.minutos === null) && <p className="subtitulo">Elige la hora y la duración para ver qué máquinas están libres.</p>}
          <div className="plano">
            <div className="plano__frente">Pizarra y puerta</div>
            <div className="plano__filas">
              {filas.map((fila, i) => (
                <div className="plano__fila" key={i}>
                  {[0, 1, null, 2, 3].map((posicion) => {
                    if (posicion === null) return <span key="pasillo" className="plano__pasillo" aria-hidden="true" />;
                    const p = fila[posicion];
                    if (!p) return <span key={posicion} />;
                    const clase = `puesto${p.estado === "fuera" ? " puesto--danado" : p.estado === "ocupada" ? " puesto--ocupado" : p.estado === "espera" ? " puesto--espera" : ""}`;
                    return (
                      <button key={p.id} className={clase} aria-label={p.etiqueta} aria-pressed={p.elegida} disabled={!p.habilitado} onClick={() => elegir({ maquina: p.id })}>
                        <span className="cinta">{p.codigo}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          <div className="leyenda">
            <span>
              <i />
              Libre
            </span>
            <span>
              <i className="ocupado" />
              Reservada en ese horario
            </span>
            <span>
              <i className="danado" />
              Fuera de servicio
            </span>
            <span>
              <i className="elegido" />
              Tu elección
            </span>
          </div>
          {conf && (
            <div className="barra-accion">
              <p>
                <strong>{conf.codigo}</strong>
                <small>{conf.horario}</small>
              </p>
              <button className="boton" onClick={() => setClave(nuevaClave())}>
                Reservar {conf.codigo}
              </button>
            </div>
          )}
        </section>
      </div>
      {conf && clave && (
        <Hoja titulo="Confirma tu reserva" alCerrar={() => !enviando && setClave(null)}>
          <dl className="detalle">
            <dt>Máquina</dt>
            <dd>{conf.codigo}</dd>
            <dt>Laboratorio</dt>
            <dd>{conf.laboratorio}</dd>
            <dt>Día</dt>
            <dd>{conf.dia}</dd>
            <dt>Horario</dt>
            <dd>{conf.horario}</dd>
          </dl>
          <div className="pila">
            <p>
              Tienes hasta las <strong>{conf.limite}</strong> para presentarte; si no llegas, la máquina se libera para otra persona.
            </p>
            <p>Después de esta reserva te quedarán {conf.quedan} esta semana.</p>
            {reintentando && <Mensaje tipo="pendiente">No llegó la respuesta. Reintentando con la misma solicitud…</Mensaje>}
            <div className="acciones">
              <button className="boton boton--secundario" onClick={() => setClave(null)} disabled={enviando}>
                Volver
              </button>
              <button className="boton" onClick={() => void reservar()} disabled={enviando} aria-busy={enviando}>
                {enviando ? "Reservando…" : `Reservar ${conf.codigo}`}
              </button>
            </div>
          </div>
        </Hoja>
      )}
    </Pagina>
  );
}

const ESTADO_DE_RESERVA: Record<string, string> = {
  ACTIVA: "Activa",
  EN_USO: "En uso",
  FINALIZADA: "Usada",
  LIBERADA: "Liberada por no presentarse",
  CANCELADA_POR_ESTUDIANTE: "Cancelada",
  CANCELADA_POR_SISTEMA: "Cancelada por el sistema"
};

export function PantallaMisReservas() {
  const { laboratorios, mias } = useDatosBase();
  if (!laboratorios || !mias) {
    return (
      <Pagina titulo="Mis reservas">
        <Cargando />
      </Pagina>
    );
  }
  return (
    <Pagina titulo="Mis reservas">
      <div className="pila-l">
        <section className="pila">
          <h2>Esta semana</h2>
          <p className="medidor__texto">{textoDelCupo(mias)}</p>
        </section>
        <section className="pila">
          <h2>Reserva activa</h2>
          {mias.activa ? (
            <ul className="lista">
              <li>
                <strong>{textoDeReserva(mias.activa, laboratorios)}</strong>
                <small>Preséntate antes de las {hora(minutosDe(mias.activa.limitePresentacion))}.</small>
              </li>
            </ul>
          ) : (
            <Vacio titulo="No tienes reservas activas." acciones={<Link className="boton" to="/reservar">Reservar una máquina</Link>} />
          )}
        </section>
        <section className="pila">
          <h2>Reservas de esta semana</h2>
          {mias.deLaSemana.length === 0 ? (
            <p className="subtitulo">Todavía no has reservado esta semana.</p>
          ) : (
            <ul className="lista">
              {mias.deLaSemana.map((r) => (
                <li key={r.id}>
                  {textoDeReserva(r, laboratorios)}
                  <small>{ESTADO_DE_RESERVA[r.estado] ?? r.estado}</small>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Pagina>
  );
}
