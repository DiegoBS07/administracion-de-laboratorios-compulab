// Horario semanal del laboratorio y asignación de turnos (CU-06, docs/diseno-ux-ui.md 15.6).
// Vista humilde: posiciones, textos y la revisión previa salen de presentador.ts.
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { tieneRol } from "../../app/navegacion";
import { Pagina } from "../../app/Pagina";
import { useSesion } from "../../app/sesion";
import { api, ErrorDeApi, nuevaClave, SinRespuesta } from "../../compartido/api/cliente";
import type { AsistenteParaElegir, HorarioSemanal, Laboratorio, SolicitudDeTurno, TurnoAsignado } from "../../compartido/api/tipos";
import { Cargando, Icono, Mensaje } from "../../compartido/ui/componentes";
import { hora, horaApi, horas, lunesDe, sumarDias } from "../../compartido/ui/formato";
import {
  bloquesDelDia,
  confirmacionDeTurno,
  evaluarAsistente,
  horaPasada,
  type MensajeDeError,
  mensajeDeErrorDeTurno,
  PRIMERA_HORA,
  primerInicio,
  type Propuesta,
  propuestaDesde,
  revisarPropuesta,
  semanaVista,
  ULTIMA_HORA
} from "./presentador";

const HORAS = Array.from({ length: ULTIMA_HORA - PRIMERA_HORA }, (_, i) => PRIMERA_HORA + i);

export function PantallaHorario() {
  const { sesion, hoy, ahora } = useSesion();
  const navegar = useNavigate();
  const { idLaboratorio = "" } = useParams();
  const [parametros] = useSearchParams();
  const lunes = lunesDe(parametros.get("semana") ?? hoy());
  const [laboratorios, setLaboratorios] = useState<Laboratorio[] | null>(null);
  const [horario, setHorario] = useState<HorarioSemanal | null>(null);
  const [asistentes, setAsistentes] = useState<AsistenteParaElegir[] | null>(null);
  const [propuesta, setPropuesta] = useState<Propuesta | null>(null);
  const [clave, setClave] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [reintentando, setReintentando] = useState(false);
  const [error, setError] = useState<MensajeDeError | null>(null);
  const [confirmado, setConfirmado] = useState<{ texto: string; idTurno: string } | null>(null);

  const cargarSemana = useCallback(async () => {
    const [h, a] = await Promise.all([
      api.get<HorarioSemanal>(`/api/v1/laboratorios/${idLaboratorio}/turnos?semana=${lunes}`),
      api.get<AsistenteParaElegir[]>(`/api/v1/laboratorios/${idLaboratorio}/asistentes?semana=${lunes}`)
    ]);
    setHorario(h.datos);
    setAsistentes(a.datos);
  }, [idLaboratorio, lunes]);

  useEffect(() => {
    void api.get<Laboratorio[]>("/api/v1/laboratorios").then((r) => setLaboratorios(r.datos));
  }, []);
  useEffect(() => {
    setHorario(null);
    setPropuesta(null);
    void cargarSemana();
  }, [cargarSemana]);

  const laboratorio = laboratorios?.find((l) => l.id === idLaboratorio);
  const esSoporte = sesion ? tieneRol(sesion, "COORDINADOR_SOPORTE") : false;
  const migas = esSoporte ? (
    <>
      <Link to="/laboratorios">Laboratorios</Link> › Sede {laboratorio?.campus ?? ""} › {laboratorio?.nombre ?? ""} › <span aria-current="page">Horario</span>
    </>
  ) : (
    <>
      {laboratorio?.nombre ?? ""} › <span aria-current="page">Horario</span>
    </>
  );
  const titulo = esSoporte ? (laboratorio?.nombre ?? "Horario") : "Horario";

  if (!horario || !asistentes) {
    return (
      <Pagina titulo={titulo} migas={migas}>
        <Cargando />
      </Pagina>
    );
  }

  const semana = semanaVista(lunes, hoy());
  const irASemana = (delta: number) => navegar(`/laboratorios/${idLaboratorio}/horario?semana=${sumarDias(lunes, delta)}`);
  const cambiarPropuesta = (cambio: Partial<Propuesta>) => {
    setPropuesta((p) => (p ? { ...p, ...cambio } : p));
    setClave(null); // otra intención: otra clave de solicitud
    setError(null);
  };
  const abrirEn = (fecha: string, horaDelDia: number) => {
    setPropuesta(propuestaDesde(fecha, horaDelDia));
    setClave(null);
    setError(null);
    setConfirmado(null);
  };
  const primerDiaLibre = semana.dias.find((d) => !horaPasada(d.fecha, ULTIMA_HORA - 1, ahora()));

  async function asignar() {
    if (!propuesta?.idAsistente) return;
    const claveDeLaIntencion = clave ?? nuevaClave();
    setClave(claveDeLaIntencion);
    setEnviando(true);
    setReintentando(false);
    setError(null);
    const cuerpo: SolicitudDeTurno = { idAsistente: propuesta.idAsistente, fecha: propuesta.fecha, horaInicio: horaApi(propuesta.ini), horaFin: horaApi(propuesta.fin) };
    try {
      const { datos } = await api.post<TurnoAsignado>(`/api/v1/laboratorios/${idLaboratorio}/turnos`, {
        cuerpo,
        clave: claveDeLaIntencion,
        alReintentar: () => setReintentando(true)
      });
      setConfirmado({ texto: confirmacionDeTurno(datos), idTurno: datos.id });
      setPropuesta(null);
      setClave(null);
      await cargarSemana();
    } catch (e) {
      if (e instanceof ErrorDeApi && e.codigo === "SIN_PERMISO_SOBRE_LABORATORIO") {
        navegar("/sin-permiso");
        return;
      }
      setError(mensajeDeErrorDeTurno(e, { laboratorios: laboratorios ?? [], asistentes: asistentes ?? [], idAsistente: propuesta.idAsistente }));
      // Sin respuesta se conserva la clave: volver a pulsar "Asignar" es la misma intención (ADR-0010).
      if (!(e instanceof SinRespuesta)) setClave(null);
      if (e instanceof ErrorDeApi) void cargarSemana();
    } finally {
      setEnviando(false);
      setReintentando(false);
    }
  }

  return (
    <Pagina titulo={titulo} migas={migas}>
      <div className="pila">
        <div className="barra-semana">
          <div className="barra-semana__nav">
            <button className="icono-boton" aria-label="Semana anterior" disabled={!semana.puedeIrAtras} onClick={() => irASemana(-7)}>
              <Icono nombre="atras" />
            </button>
            <strong>{semana.titulo}</strong>
            <button className="icono-boton" aria-label="Semana siguiente" onClick={() => irASemana(7)}>
              <Icono nombre="adelante" />
            </button>
          </div>
          <button className="boton" disabled={!primerDiaLibre} onClick={() => primerDiaLibre && abrirEn(primerDiaLibre.fecha, Math.max(PRIMERA_HORA, Math.ceil(primerInicio(primerDiaLibre.fecha, ahora()) / 60)))}>
            Asignar turno
          </button>
        </div>
        {confirmado && <Mensaje>{confirmado.texto}</Mensaje>}
        <div className="leyenda">
          <span>
            <i className="asignado" />
            Asignado
          </span>
          <span>
            <i className="pendiente" />
            Pendiente de que el asistente acepte
          </span>
          <span>
            <i />
            Libre: toca para asignar
          </span>
          <span>
            <i className="paso" />
            Ya pasó
          </span>
        </div>
        <div className="horario-marco">
          <div className="horario-desplazable">
            <div className="horario">
              <div className="horario__cabeza" />
              {semana.dias.map((d) => (
                <div key={d.fecha} className={`horario__cabeza${d.esHoy ? " horario__cabeza--hoy" : ""}`}>
                  <strong>{d.etiqueta}</strong>
                  <small>{d.detalle}</small>
                </div>
              ))}
              <div className="horario__horas" aria-hidden="true">
                {HORAS.map((h) => (
                  <span key={h}>{h}:00</span>
                ))}
              </div>
              {semana.dias.map((d) => (
                <div key={d.fecha} className="horario__dia" role="group" aria-label={d.nombreLargo}>
                  {HORAS.map((h) => {
                    const pasada = horaPasada(d.fecha, h, ahora());
                    const elegida = propuesta && propuesta.fecha === d.fecha && h * 60 >= propuesta.ini && h * 60 < propuesta.fin;
                    return (
                      <button
                        key={h}
                        className={`horario__celda${elegida ? " horario__celda--elegida" : ""}`}
                        disabled={pasada}
                        aria-label={`${d.nombreLargo}, ${h}:00${pasada ? ", ya pasó" : ", asignar turno"}`}
                        onClick={() => abrirEn(d.fecha, h)}
                      />
                    );
                  })}
                  {bloquesDelDia(horario, d.fecha).map((b) => (
                    <div key={b.id} className={`${b.clase}${confirmado?.idTurno === b.id ? " turno--nuevo" : ""}`} style={{ top: b.arriba, height: b.alto }}>
                      <strong>{b.nombre}</strong>
                      {b.horario}
                      {b.nota && (
                        <>
                          <br />
                          {b.nota}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
          {propuesta && (
            <PanelAsignar
              propuesta={propuesta}
              horario={horario}
              asistentes={asistentes}
              dias={semana.dias.filter((d) => !horaPasada(d.fecha, ULTIMA_HORA - 1, ahora()))}
              primerInicio={primerInicio(propuesta.fecha, ahora())}
              enviando={enviando}
              reintentando={reintentando}
              error={error}
              alCambiar={cambiarPropuesta}
              alCerrar={() => setPropuesta(null)}
              alAsignar={() => void asignar()}
            />
          )}
        </div>
      </div>
    </Pagina>
  );
}

interface PropsDelPanel {
  propuesta: Propuesta;
  horario: HorarioSemanal;
  asistentes: AsistenteParaElegir[];
  dias: { fecha: string; nombreLargo: string }[];
  primerInicio: number;
  enviando: boolean;
  reintentando: boolean;
  error: MensajeDeError | null;
  alCambiar: (cambio: Partial<Propuesta>) => void;
  alCerrar: () => void;
  alAsignar: () => void;
}

function opcionesDeHora(desde: number, hasta: number): number[] {
  const opciones: number[] = [];
  for (let m = desde; m <= hasta; m += 30) opciones.push(m);
  return opciones;
}

function PanelAsignar(p: PropsDelPanel) {
  const { propuesta } = p;
  const revision = revisarPropuesta(propuesta, p.horario, p.asistentes);
  const habilitado = propuesta.idAsistente !== null && revision.bloqueo === null && !p.enviando;
  const inicioMinimo = Math.min(p.primerInicio, ULTIMA_HORA * 60 - 30);

  return (
    <aside className="panel" aria-labelledby="titulo-panel">
      <div className="panel__cabeza">
        <h2 id="titulo-panel">Asignar turno</h2>
        <button className="boton boton--texto" onClick={p.alCerrar}>
          Cerrar
        </button>
      </div>
      <div className="pila">
        <div className="campos">
          <div className="campo campo--ancho">
            <label htmlFor="p-fecha">Día</label>
            <select id="p-fecha" value={propuesta.fecha} onChange={(e) => p.alCambiar({ fecha: e.target.value })}>
              {p.dias.map((d) => (
                <option key={d.fecha} value={d.fecha}>
                  {d.nombreLargo}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="p-ini">Desde</label>
            <select id="p-ini" value={propuesta.ini} onChange={(e) => p.alCambiar({ ini: Number(e.target.value) })}>
              {opcionesDeHora(inicioMinimo, ULTIMA_HORA * 60 - 30).map((m) => (
                <option key={m} value={m}>
                  {hora(m)}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="p-fin">Hasta</label>
            <select id="p-fin" value={propuesta.fin} onChange={(e) => p.alCambiar({ fin: Number(e.target.value) })}>
              {opcionesDeHora(inicioMinimo + 30, ULTIMA_HORA * 60).map((m) => (
                <option key={m} value={m}>
                  {hora(m)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <fieldset className="campo" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend>Asistente</legend>
          {p.asistentes.length === 0 ? (
            <p className="subtitulo">Este laboratorio no tiene asistentes activos.</p>
          ) : (
            <ul className="personas">
              {p.asistentes.map((a) => {
                const evaluacion = evaluarAsistente(a, p.horario, propuesta);
                return (
                  <li key={a.id}>
                    <label className="persona">
                      <input type="radio" name="asistente" value={a.id} checked={propuesta.idAsistente === a.id} onChange={() => p.alCambiar({ idAsistente: a.id })} />
                      <span className="persona__nombre">
                        {a.nombre}, categoría {a.categoria}
                      </span>
                      <span className="medidor__texto">
                        Esta semana tiene {horas(a.minutosProgramadosSemana)} asignadas; su tope es de {horas(a.topeSemanalMinutos)}.
                      </span>
                      <span className={`persona__estado persona__estado--${evaluacion.estado}`}>{evaluacion.texto}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </fieldset>
        {revision.bloqueo && <Mensaje tipo="error">{revision.bloqueo}</Mensaje>}
        {revision.aviso && <Mensaje tipo="pendiente">{revision.aviso}</Mensaje>}
        {p.reintentando && <Mensaje tipo="pendiente">No llegó la respuesta. Reintentando con la misma solicitud…</Mensaje>}
        {p.error && (
          <Mensaje tipo="error" titulo={p.error.titulo}>
            {p.error.texto}
          </Mensaje>
        )}
        <button className="boton boton--ancho" disabled={!habilitado} aria-busy={p.enviando} onClick={p.alAsignar}>
          {p.enviando ? "Asignando…" : "Asignar turno"}
        </button>
      </div>
    </aside>
  );
}
