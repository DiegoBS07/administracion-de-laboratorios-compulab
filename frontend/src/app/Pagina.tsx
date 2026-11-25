// Esqueleto común (docs/diseno-ux-ui.md, 15.2): menú lateral en escritorio, pestañas en el celular,
// encabezado con migas, avisos y menú de usuario. Cambia el contenido, no la forma de moverse (N-3).
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { Icono } from "../compartido/ui/componentes";
import { estaActivo, menuDeLaSesion, pestanasDe, textoDeRoles } from "./navegacion";
import { useSesion } from "./sesion";

export function Pagina({ titulo, migas, children }: { titulo: string; migas?: ReactNode; children: ReactNode }) {
  const { sesion, salir } = useSesion();
  const { pathname } = useLocation();
  const navegar = useNavigate();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const menuUsuario = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = `${titulo} | CompuLab`;
  }, [titulo]);

  useEffect(() => {
    if (!menuAbierto) return;
    const fuera = (e: MouseEvent) => {
      if (!menuUsuario.current?.contains(e.target as Node)) setMenuAbierto(false);
    };
    const escape = (e: KeyboardEvent) => e.key === "Escape" && setMenuAbierto(false);
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", escape);
    };
  }, [menuAbierto]);

  if (!sesion) return null;
  const menu = menuDeLaSesion(sesion);
  let seccion: string | undefined;

  return (
    <div className="app">
      <nav className="lateral" aria-label="Navegación principal">
        <div className="lateral__marca">
          <strong>CompuLab</strong>
          <span>Escuela de Computación, Tecnológico de Costa Rica</span>
        </div>
        {menu.map((item) => {
          const titulo = item.seccion && item.seccion !== seccion ? item.seccion : null;
          seccion = item.seccion ?? seccion;
          return (
            <span key={item.ruta} style={{ display: "contents" }}>
              {titulo && <div className="lateral__seccion">{titulo}</div>}
              <Link to={item.ruta} aria-current={estaActivo(item, pathname, sesion) ? "page" : undefined}>
                <Icono nombre={item.icono} />
                <span>{item.texto}</span>
              </Link>
            </span>
          );
        })}
      </nav>

      <div className="principal">
        <header className="cabecera">
          <div className="cabecera__titulo">
            {migas && <div className="migas">{migas}</div>}
            <h1>{titulo}</h1>
          </div>
          <Link className="icono-boton" to="/avisos" aria-label="Avisos">
            <Icono nombre="campana" />
          </Link>
          <div className="usuario" ref={menuUsuario}>
            <button className="icono-boton" aria-expanded={menuAbierto} aria-label={`Menú de ${sesion.nombre}`} onClick={() => setMenuAbierto((a) => !a)}>
              <Icono nombre="usuario" />
            </button>
            {menuAbierto && (
              <div className="usuario__menu">
                <p>{sesion.nombre}</p>
                <small>{textoDeRoles(sesion)}</small>
                <button
                  className="boton boton--secundario boton--ancho"
                  onClick={async () => {
                    await salir();
                    navegar("/ingresar", { replace: true });
                  }}
                >
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </header>
        <main className="contenido" id="contenido">
          {children}
        </main>
      </div>

      <nav className="pestanas" aria-label="Navegación principal">
        {pestanasDe(menu).map((item) => (
          <Link key={item.ruta} to={item.ruta} aria-current={estaActivo(item, pathname, sesion) || pathname === item.ruta ? "page" : undefined}>
            <Icono nombre={item.icono} />
            <span>{item.corto ?? item.texto}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
