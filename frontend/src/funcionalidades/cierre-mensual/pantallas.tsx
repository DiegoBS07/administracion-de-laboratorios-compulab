// Pantallas del cierre mensual (CU-14, docs/diseno-ux-ui.md 15.6). Vistas "humildes": muestran el
// modelo de vista del presentador y llaman a la API; las decisiones de texto están en presentador.ts.
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { Pagina } from "../../app/Pagina";
import { useSesion } from "../../app/sesion";
import { api, ErrorDeApi } from "../../compartido/api/cliente";
import type { MesDelAnio, ResumenDeCierre } from "../../compartido/api/tipos";
import { Cargando, Hoja, Icono, Mensaje, Vacio } from "../../compartido/ui/componentes";
import { type CierreVista, estadoSinCierre, type MensajeDeError, mensajeDeErrorDelCierre, mesesDelAnio, nombreDelMesDelAnio, vistaDelCierre } from "./presentador";

export function PantallaCierres() {
  const { hoy } = useSesion();
  const anioActual = Number(hoy().slice(0, 4));
  const [anio, setAnio] = useState(anioActual);
  const [meses, setMeses] = useState<MesDelAnio[] | null>(null);
  const [error, setError] = useState<MensajeDeError | null>(null);

  useEffect(() => {
    setMeses(null);
    api.get<MesDelAnio[]>(`/api/v1/cierres?anio=${anio}`).then(
      (r) => setMeses(r.datos),
      (e: unknown) => setError(mensajeDeErrorDelCierre(e))
    );
  }, [anio]);

  return (
    <Pagina titulo="Cierre mensual">
      <div className="pila">
        <div className="barra-semana__nav">
          <button className="icono-boton" aria-label="Año anterior" onClick={() => setAnio((a) => a - 1)}>
            <Icono nombre="atras" />
          </button>
          <h2>{anio}</h2>
          <button className="icono-boton" aria-label="Año siguiente" disabled={anio >= anioActual} onClick={() => setAnio((a) => a + 1)}>
            <Icono nombre="adelante" />
          </button>
        </div>
        {error && <Mensaje tipo="error" titulo={error.titulo}>{error.texto}</Mensaje>}
        {!meses && !error ? (
          <Cargando />
        ) : (
          <div className="meses">
            {mesesDelAnio(anio, meses ?? []).map((m) => {
              const clase = `mes${m.estado === "POR_CERRAR" ? " mes--por-cerrar" : m.estado === "FUTURO" ? " mes--futuro" : ""}`;
              const contenido = (
                <>
                  <strong>{m.nombre}</strong>
                  <small>{m.texto}</small>
                </>
              );
              return m.tieneEnlace ? (
                <Link key={m.mes} className={clase} to={`/cierres/${m.anio}/${m.mes}`}>
                  {contenido}
                </Link>
              ) : (
                <div key={m.mes} className={clase}>
                  {contenido}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Pagina>
  );
}

type Estado = { tipo: "cargando" } | { tipo: "sin-cierre" } | { tipo: "cerrado"; vista: CierreVista } | { tipo: "error"; mensaje: MensajeDeError };

export function PantallaCierreDelMes() {
  const { hoy } = useSesion();
  const parametros = useParams();
  const anio = Number(parametros["anio"]);
  const mes = Number(parametros["mes"]);
  const nombre = nombreDelMesDelAnio(anio, mes);
  const [estado, setEstado] = useState<Estado>({ tipo: "cargando" });
  const [confirmar, setConfirmar] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const [errorAlCerrar, setErrorAlCerrar] = useState<MensajeDeError | null>(null);

  const cargar = useCallback(() => {
    api.get<ResumenDeCierre>(`/api/v1/cierres/${anio}/${mes}`).then(
      (r) => setEstado({ tipo: "cerrado", vista: vistaDelCierre(r.datos) }),
      (e: unknown) =>
        setEstado(e instanceof ErrorDeApi && e.codigo === "CIERRE_NO_EXISTE" ? { tipo: "sin-cierre" } : { tipo: "error", mensaje: mensajeDeErrorDelCierre(e) })
    );
  }, [anio, mes]);

  useEffect(cargar, [cargar]);

  async function cerrarMes() {
    setCerrando(true);
    setErrorAlCerrar(null);
    try {
      // 201 si se creó, 200 si ya existía (otra persona o el cierre automático): se muestra igual.
      const { datos } = await api.post<ResumenDeCierre>("/api/v1/cierres", { cuerpo: { anio, mes } });
      setEstado({ tipo: "cerrado", vista: vistaDelCierre(datos) });
      setConfirmar(false);
    } catch (e) {
      setErrorAlCerrar(mensajeDeErrorDelCierre(e));
      setConfirmar(false);
    } finally {
      setCerrando(false);
    }
  }

  const migas = (
    <>
      <Link to="/cierres">Cierre mensual</Link> › <span aria-current="page">{nombre}</span>
    </>
  );

  let contenido;
  if (estado.tipo === "cargando") contenido = <Cargando />;
  else if (estado.tipo === "error") contenido = <Mensaje tipo="error" titulo={estado.mensaje.titulo}>{estado.mensaje.texto}</Mensaje>;
  else if (estado.tipo === "cerrado") contenido = <ResultadoDelCierre vista={estado.vista} />;
  else if (estadoSinCierre(anio, mes, hoy()) !== "POR_CERRAR") {
    contenido = (
      <Vacio titulo="Este mes todavía no termina." acciones={<button className="boton" disabled>Cerrar mes</button>}>
        <p>Se podrá cerrar a partir del día 1 del mes siguiente.</p>
      </Vacio>
    );
  } else {
    contenido = (
      <div className="pila">
        {errorAlCerrar && (
          <Mensaje
            tipo="error"
            titulo={errorAlCerrar.titulo}
            acciones={errorAlCerrar.irATarifas && <Link className="boton boton--secundario" to="/tarifas">Ir a tarifas</Link>}
          >
            {errorAlCerrar.texto}
          </Mensaje>
        )}
        <Vacio titulo="Este mes aún no se ha cerrado." acciones={<button className="boton" onClick={() => setConfirmar(true)}>Cerrar mes</button>}>
          <p>Si el cierre automático del día 1 no se ejecutó, puedes cerrarlo ahora; si ya lo hizo otra persona, verás el mismo resultado.</p>
        </Vacio>
      </div>
    );
  }

  return (
    <Pagina titulo={nombre} migas={migas}>
      {contenido}
      {confirmar && (
        <Hoja titulo={`¿Cerrar ${nombre.toLowerCase()}?`} alCerrar={() => !cerrando && setConfirmar(false)}>
          <div className="pila">
            <p>El sistema calculará las horas y el pago de cada asistente con las marcas de entrada y salida, y generará el archivo para Becas.</p>
            <p>
              <strong>Un mes cerrado no se puede recalcular ni corregir.</strong> Si hay un error, se arregla fuera del sistema y se deja una constancia.
            </p>
            <div className="acciones">
              <button className="boton boton--secundario" onClick={() => setConfirmar(false)} disabled={cerrando}>
                Volver
              </button>
              <button className="boton" onClick={() => void cerrarMes()} disabled={cerrando} aria-busy={cerrando}>
                {cerrando ? "Cerrando el mes…" : "Cerrar mes"}
              </button>
            </div>
          </div>
        </Hoja>
      )}
    </Pagina>
  );
}

function ResultadoDelCierre({ vista }: { vista: CierreVista }) {
  return (
    <div className="pila-l">
      <div className="barra-semana">
        <div>
          <p className="cifra">{vista.total}</p>
          <p className="subtitulo">{vista.subtitulo}</p>
        </div>
        <a className="boton" href={vista.archivo.url} download={vista.archivo.nombre}>
          Descargar archivo para Becas
        </a>
      </div>
      {vista.avisoNoPagados && <Mensaje tipo="pendiente">{vista.avisoNoPagados}</Mensaje>}
      <div className="tabla-marco">
        <table>
          <caption className="visualmente-oculto">Liquidación por asistente</caption>
          <thead>
            <tr>
              <th scope="col">Asistente</th>
              <th scope="col">Categoría</th>
              <th scope="col" className="num">Horas normales</th>
              <th scope="col" className="num">Con recargo</th>
              <th scope="col" className="num">No pagadas</th>
              <th scope="col" className="num">Monto</th>
            </tr>
          </thead>
          <tbody>
            {vista.lineas.map((l) => (
              <tr key={l.id} className={l.resaltada ? "resaltada" : undefined}>
                <td>
                  <strong>{l.nombre}</strong>
                  <span className="carne">Carné {l.carne}</span>
                  {l.notas.map((n) => (
                    <span key={n} className="nota-fila">
                      {n}
                    </span>
                  ))}
                </td>
                <td>{l.categoria}</td>
                <td className="num">{l.normales}</td>
                <td className="num">{l.conRecargo}</td>
                <td className="num">{l.noPagadas}</td>
                <td className="num">{l.monto}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5}>Total</td>
              <td className="num">{vista.total}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <section className="pila">
        <h2>Tarifas aplicadas</h2>
        <div className="tabla-marco">
          <table>
            <thead>
              <tr>
                <th scope="col">Vigencia</th>
                {vista.categorias.map((c) => (
                  <th key={c} scope="col" className="num">
                    Categoría {c}, por hora
                  </th>
                ))}
                <th scope="col" className="num">Recargo</th>
              </tr>
            </thead>
            <tbody>
              {vista.tarifas.map((t) => (
                <tr key={t.vigencia}>
                  <td>{t.vigencia}</td>
                  {t.valores.map((v, i) => (
                    <td key={vista.categorias[i]} className="num">
                      {v}
                    </td>
                  ))}
                  <td className="num">{t.recargo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="subtitulo">El recargo aplica a los turnos que empiezan a las 18:00 o después y a los de sábado y domingo.</p>
      </section>
    </div>
  );
}
