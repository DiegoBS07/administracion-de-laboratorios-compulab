// Pantallas comunes y las que quedan fuera del núcleo ejecutable (docs/diseno-ux-ui.md, 15.5):
// estas últimas muestran un estado vacío que explica qué contendrán, como en el prototipo.
import { type ReactNode, useEffect, useState } from "react";
import { Link, Navigate, useLocation, useParams } from "react-router";
import { api } from "../compartido/api/cliente";
import type { Laboratorio, MesDelAnio, Rol } from "../compartido/api/tipos";
import { Cargando, Mensaje, Vacio } from "../compartido/ui/componentes";
import { MESES, mayuscula } from "../compartido/ui/formato";
import { inicioDe, menuDeLaSesion, puedeVerLaboratorio, tieneRol } from "./navegacion";
import { Pagina } from "./Pagina";
import { useSesion } from "./sesion";

/** Protección de rutas, nivel 2 de 15.5: sin sesión → /ingresar; sin el rol → /sin-permiso. */
export function Protegida({ roles, porLaboratorio = false, children }: { roles: Rol[] | null; porLaboratorio?: boolean; children: ReactNode }) {
  const { sesion } = useSesion();
  const { pathname, search } = useLocation();
  const { idLaboratorio } = useParams();
  if (!sesion) return <Navigate to={`/ingresar?volver=${encodeURIComponent(pathname + search)}`} replace />;
  const permitido = (!roles || tieneRol(sesion, ...roles)) && (!porLaboratorio || puedeVerLaboratorio(sesion, idLaboratorio ?? ""));
  return permitido ? <>{children}</> : <Navigate to="/sin-permiso" replace />;
}

export function Inicio() {
  const { sesion } = useSesion();
  return <Navigate to={sesion ? inicioDe(sesion) : "/ingresar"} replace />;
}

export function FueraDelNucleo({ titulo, texto, acciones }: { titulo: string; texto: string; acciones?: ReactNode }) {
  return (
    <Pagina titulo={titulo}>
      <Vacio titulo={titulo} acciones={acciones}>
        <p>{texto}</p>
        <p className="subtitulo">Esta pantalla está fuera del núcleo ejecutable y se implementará en una siguiente iteración.</p>
      </Vacio>
    </Pagina>
  );
}

export function SinPermiso() {
  const { sesion } = useSesion();
  return (
    <Pagina titulo="Sin permiso">
      <Vacio titulo="Esta pantalla no está disponible para tu rol." acciones={sesion && <Link className="boton" to={inicioDe(sesion)}>Ir a mi inicio</Link>}>
        <p>Si crees que deberías tener acceso, pídelo a la Coordinación de Soporte.</p>
      </Vacio>
    </Pagina>
  );
}

export function Avisos() {
  return (
    <Pagina titulo="Avisos">
      <Vacio titulo="No hay avisos para mostrar.">
        <p>Aquí aparecerán las reservas canceladas o liberadas, los turnos por aceptar y el estado del cierre del mes. La bandeja de avisos se conecta en una siguiente iteración.</p>
      </Vacio>
    </Pagina>
  );
}

export function Mas() {
  const { sesion } = useSesion();
  if (!sesion) return null;
  return (
    <Pagina titulo="Más opciones">
      <ul className="lista">
        {menuDeLaSesion(sesion)
          .slice(4)
          .map((i) => (
            <li key={i.ruta}>
              <Link to={i.ruta}>{i.texto}</Link>
            </li>
          ))}
      </ul>
    </Pagina>
  );
}

/** Laboratorios agrupados por sede (selector del coordinador de soporte, 15.4). */
function useLaboratorios(): Laboratorio[] | null {
  const [laboratorios, setLaboratorios] = useState<Laboratorio[] | null>(null);
  useEffect(() => {
    api.get<Laboratorio[]>("/api/v1/laboratorios").then((r) => setLaboratorios(r.datos), () => setLaboratorios([]));
  }, []);
  return laboratorios;
}

function porSede(laboratorios: Laboratorio[]): [string, Laboratorio[]][] {
  const grupos = new Map<string, Laboratorio[]>();
  for (const l of laboratorios) grupos.set(l.campus, [...(grupos.get(l.campus) ?? []), l]);
  return [...grupos];
}

export function ListaDeLaboratorios() {
  const laboratorios = useLaboratorios();
  return (
    <Pagina titulo="Laboratorios">
      {!laboratorios ? (
        <Cargando />
      ) : (
        <div className="pila-l">
          {porSede(laboratorios).map(([sede, labs]) => (
            <section className="pila" key={sede}>
              <h2>Sede {sede}</h2>
              <ul className="labs">
                {labs.map((l) => (
                  <li key={l.id}>
                    <Link className="lab" to={`/laboratorios/${l.id}/horario`}>
                      <div className="lab__fila">
                        <span className="lab__nombre">{l.nombre}</span>
                        <span className="lab__estado">Ver horario y asignar turnos</span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Pagina>
  );
}

/** Panel del coordinador de soporte (N-2): lo que requiere atención, con datos reales del núcleo. */
export function Panel() {
  const { hoy } = useSesion();
  const laboratorios = useLaboratorios();
  const [porCerrar, setPorCerrar] = useState<MesDelAnio[] | null>(null);
  const anio = Number(hoy().slice(0, 4));

  useEffect(() => {
    Promise.all([api.get<MesDelAnio[]>(`/api/v1/cierres?anio=${anio}`), api.get<MesDelAnio[]>(`/api/v1/cierres?anio=${anio - 1}`)]).then(
      ([actual, anterior]) => setPorCerrar([...anterior.datos, ...actual.datos].filter((m) => m.estado === "POR_CERRAR").slice(-3)),
      () => setPorCerrar([])
    );
  }, [anio]);

  return (
    <Pagina titulo="Panel">
      <div className="pila-l">
        <section className="pila">
          <h2>Requiere atención</h2>
          {!porCerrar ? (
            <Cargando />
          ) : porCerrar.length === 0 ? (
            <Mensaje>Todos los meses terminados están cerrados.</Mensaje>
          ) : (
            <ul className="lista">
              {porCerrar.map((m) => (
                <li key={`${m.anio}-${m.mes}`}>
                  <Link to={`/cierres/${m.anio}/${m.mes}`}>
                    {mayuscula(MESES[m.mes - 1] ?? "")} de {m.anio} todavía no se ha cerrado
                  </Link>
                  <small>Puedes cerrarlo ahora y descargar el archivo para Becas.</small>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="pila">
          <h2>Laboratorios</h2>
          {!laboratorios ? (
            <Cargando />
          ) : (
            <ul className="labs">
              {laboratorios.map((l) => (
                <li key={l.id}>
                  <Link className="lab" to={`/laboratorios/${l.id}/horario`}>
                    <div className="lab__fila">
                      <span className="lab__nombre">{l.nombre}</span>
                      <span className="lab__estado">Sede {l.campus}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Pagina>
  );
}

export function PendientesDelLaboratorio() {
  const { idLaboratorio } = useParams();
  return (
    <FueraDelNucleo
      titulo="Pendientes"
      texto="Turnos vacantes de la semana, turnos sin entrada hoy, cambios por aprobar y máquinas fuera de servicio, cada uno con un enlace a su pantalla."
      acciones={
        <Link className="boton" to={`/laboratorios/${idLaboratorio ?? ""}/horario`}>
          Ir al horario
        </Link>
      }
    />
  );
}
