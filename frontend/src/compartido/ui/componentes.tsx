// Componentes visuales reutilizables (docs/07-arquitectura.md, 7.3 "compartido/ui").
import { type ReactNode, useEffect, useRef } from "react";

const ICONOS: Record<string, ReactNode> = {
  reservar: (
    <>
      <path d="M4 6h16v10H4z" />
      <path d="M9 20h6M12 16v4" />
    </>
  ),
  lista: (
    <>
      <path d="M8 6h12M8 12h12M8 18h12" />
      <circle cx="4" cy="6" r="1" />
      <circle cx="4" cy="12" r="1" />
      <circle cx="4" cy="18" r="1" />
    </>
  ),
  postulacion: (
    <>
      <path d="M6 3h9l3 3v15H6z" />
      <path d="M9 12h6M9 16h6" />
    </>
  ),
  campana: (
    <>
      <path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z" />
      <path d="M10 21h4" />
    </>
  ),
  reloj: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l3 2" />
    </>
  ),
  calendario: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="1" />
      <path d="M4 10h16M9 3v4M15 3v4" />
    </>
  ),
  intercambio: <path d="M4 8h13l-3-3M20 16H7l3 3" />,
  inicio: <path d="M4 11l8-7 8 7v9H4z" />,
  cambios: <path d="M5 12l4 4 10-10" />,
  cobertura: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  maquinas: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="1" />
      <path d="M8 20h8" />
    </>
  ),
  laboratorios: (
    <>
      <path d="M3 20h18M5 20V8l7-4 7 4v12" />
      <path d="M9 20v-6h6v6" />
    </>
  ),
  personas: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3 3-5 6-5s6 2 6 5" />
      <circle cx="17" cy="9" r="2" />
      <path d="M15 15c3 0 6 1 6 4" />
    </>
  ),
  seleccion: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-4-4" />
    </>
  ),
  cierre: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="1" />
      <path d="M8 8h8M8 12h8M8 16h4" />
    </>
  ),
  tarifas: <path d="M12 3v18M16 7c0-2-2-3-4-3s-4 1-4 3 2 3 4 3 4 1 4 3-2 3-4 3-4-1-4-3" />,
  uso: <path d="M4 20V14M10 20V8M16 20v-9M22 20H2" />,
  mas: (
    <>
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="19" cy="12" r="1.5" />
    </>
  ),
  usuario: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </>
  ),
  atras: <path d="M15 5l-7 7 7 7" />,
  adelante: <path d="M9 5l7 7-7 7" />
};

export function Icono({ nombre }: { nombre: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONOS[nombre]}
    </svg>
  );
}

export type TipoDeMensaje = "informacion" | "error" | "pendiente";

/** Mensaje en la página: el color nunca es la única señal (borde y texto también cambian). */
export function Mensaje({ tipo = "informacion", titulo, children, acciones }: { tipo?: TipoDeMensaje; titulo?: string; children?: ReactNode; acciones?: ReactNode }) {
  const clase = tipo === "error" ? "mensaje mensaje--error" : tipo === "pendiente" ? "mensaje mensaje--pendiente" : "mensaje";
  return (
    <div className={clase} role={tipo === "error" ? "alert" : "status"}>
      {titulo && (
        <p>
          <strong>{titulo}</strong>
        </p>
      )}
      {typeof children === "string" ? <p>{children}</p> : children}
      {acciones && <div className="acciones">{acciones}</div>}
    </div>
  );
}

export function Cargando({ texto = "Cargando…" }: { texto?: string }) {
  return (
    <p className="cargando" role="status">
      {texto}
    </p>
  );
}

export function Vacio({ titulo, children, acciones }: { titulo: string; children?: ReactNode; acciones?: ReactNode }) {
  return (
    <div className="vacio">
      <p>
        <strong>{titulo}</strong>
      </p>
      {typeof children === "string" ? <p>{children}</p> : children}
      {acciones && <div className="acciones">{acciones}</div>}
    </div>
  );
}

/**
 * Hoja de confirmación (modal): se abre con el foco en su primer botón, se cierra con Escape o
 * tocando fuera, y devuelve el foco a donde estaba (N-9, WCAG 2.2).
 */
export function Hoja({ titulo, alCerrar, children }: { titulo: string; alCerrar: () => void; children: ReactNode }) {
  const caja = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    caja.current?.querySelector<HTMLElement>("button, a")?.focus();
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") alCerrar();
    };
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("keydown", tecla);
      anterior?.focus();
    };
  }, [alCerrar]);
  return (
    <div className="velo" onClick={(e) => e.target === e.currentTarget && alCerrar()}>
      <div className="hoja" role="dialog" aria-modal="true" aria-labelledby="titulo-hoja" ref={caja}>
        <h2 id="titulo-hoja">{titulo}</h2>
        {children}
      </div>
    </div>
  );
}
