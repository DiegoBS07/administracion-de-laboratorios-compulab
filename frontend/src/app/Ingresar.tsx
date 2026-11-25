// Ingreso (docs/diseno-ux-ui.md, 15.7). En la versión de demostración se elige un usuario del
// Directorio de demostración; sin esa lista se muestra el formulario normal de usuario y contraseña.
import { type FormEvent, useEffect, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router";
import { api, ErrorDeApi, SinRespuesta } from "../compartido/api/cliente";
import type { UsuarioDeDemostracion } from "../compartido/api/tipos";
import { inicioDe } from "./navegacion";
import { useSesion } from "./sesion";

/** Contraseña de los usuarios del Directorio de demostración (backend/src/arranque/datos-de-demostracion.ts). */
const SECRETO_DE_DEMOSTRACION = "demo";

function mensajeDeIngreso(error: unknown): string {
  if (error instanceof ErrorDeApi && error.codigo === "CREDENCIALES_INVALIDAS") return "El usuario o la contraseña no son correctos.";
  if (error instanceof ErrorDeApi && error.codigo === "DIRECTORIO_NO_DISPONIBLE") return "El directorio institucional no responde; intente en unos minutos.";
  if (error instanceof ErrorDeApi && error.codigo === "SIN_PERMISO") return "Tu cuenta no tiene acceso a CompuLab.";
  if (error instanceof SinRespuesta) return "No hay conexión con el servidor. Intenta de nuevo.";
  return "No se pudo iniciar sesión. Intenta de nuevo.";
}

/** Solo rutas internas: evita redirigir a otro sitio con ?volver= (redirección abierta). */
const destinoSeguro = (volver: string | null) => (volver && volver.startsWith("/") && !volver.startsWith("//") ? volver : null);

export function Ingresar() {
  const { sesion, ingresar } = useSesion();
  const navegar = useNavigate();
  const [parametros] = useSearchParams();
  const [usuarios, setUsuarios] = useState<UsuarioDeDemostracion[] | null>(null);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formulario, setFormulario] = useState({ usuario: "", secreto: "" });

  useEffect(() => {
    document.title = "Ingresar | CompuLab";
    api.get<UsuarioDeDemostracion[]>("/api/v1/sesion/usuarios-de-demostracion").then(
      (r) => setUsuarios(r.datos),
      () => setUsuarios([])
    );
  }, []);

  if (sesion) return <Navigate to={destinoSeguro(parametros.get("volver")) ?? inicioDe(sesion)} replace />;

  async function entrar(usuario: string, secreto: string) {
    setEnviando(usuario);
    setError(null);
    try {
      const nueva = await ingresar(usuario, secreto);
      navegar(destinoSeguro(parametros.get("volver")) ?? inicioDe(nueva), { replace: true });
    } catch (e) {
      setError(mensajeDeIngreso(e));
      setEnviando(null);
    }
  }

  const enviarFormulario = (e: FormEvent) => {
    e.preventDefault();
    void entrar(formulario.usuario.trim(), formulario.secreto);
  };

  return (
    <main className="ingreso">
      <div className="ingreso__caja">
        <p className="ingreso__institucion">Tecnológico de Costa Rica</p>
        <h1 className="ingreso__marca">CompuLab</h1>
        <p className="ingreso__sub">Laboratorios de la Escuela de Computación</p>
        {error && (
          <div className="mensaje mensaje--error" role="alert" style={{ marginTop: 20 }}>
            <p>{error}</p>
          </div>
        )}
        {usuarios === null ? (
          <p className="cargando" role="status">
            Cargando…
          </p>
        ) : usuarios.length > 0 ? (
          <>
            <p className="ingreso__nota">Versión de demostración: no se conecta al directorio institucional. Elige con quién entrar para recorrer la aplicación con ese rol.</p>
            <ul className="directorio">
              {usuarios.map((u) => (
                <li key={u.usuario}>
                  <button onClick={() => void entrar(u.usuario, SECRETO_DE_DEMOSTRACION)} disabled={enviando !== null} aria-busy={enviando === u.usuario}>
                    <span className="directorio__rol">{u.nombre}</span>
                    <span className="directorio__persona">{u.descripcion}</span>
                    <span className="directorio__entrar">{enviando === u.usuario ? "Entrando…" : "Entrar"}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <form className="pila" style={{ marginTop: 24 }} onSubmit={enviarFormulario}>
            <div className="campo">
              <label htmlFor="usuario">Usuario institucional</label>
              <input id="usuario" className="entrada" autoComplete="username" required value={formulario.usuario} onChange={(e) => setFormulario({ ...formulario, usuario: e.target.value })} />
            </div>
            <div className="campo">
              <label htmlFor="secreto">Contraseña</label>
              <input id="secreto" className="entrada" type="password" autoComplete="current-password" required value={formulario.secreto} onChange={(e) => setFormulario({ ...formulario, secreto: e.target.value })} />
            </div>
            <button className="boton boton--ancho" disabled={enviando !== null}>
              {enviando ? "Entrando…" : "Ingresar"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
