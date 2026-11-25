// Sesión y hora oficial. La hora es la del servidor (8.3: la del dispositivo nunca se usa): se pide
// una vez a GET /api/v1/hora y después se avanza con el reloj local.
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { api, ErrorDeApi } from "../compartido/api/cliente";
import type { Sesion } from "../compartido/api/tipos";
import { fechaDe, instanteDeCostaRica } from "../compartido/ui/formato";

interface EstadoDeSesion {
  sesion: Sesion | null;
  /** Instante actual en hora oficial de Costa Rica (ISO con -06:00). */
  ahora: () => string;
  /** Fecha de hoy en hora oficial ("AAAA-MM-DD"). */
  hoy: () => string;
  ingresar: (usuario: string, secreto: string) => Promise<Sesion>;
  salir: () => Promise<void>;
}

const Contexto = createContext<EstadoDeSesion | null>(null);

export function useSesion(): EstadoDeSesion {
  const estado = useContext(Contexto);
  if (!estado) throw new Error("useSesion debe usarse dentro de ProveedorDeSesion.");
  return estado;
}

type Carga = { tipo: "cargando" } | { tipo: "lista" } | { tipo: "sin-servidor" };

export function ProveedorDeSesion({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [desfase, setDesfase] = useState(0);
  const [carga, setCarga] = useState<Carga>({ tipo: "cargando" });
  const navegar = useNavigate();
  const ubicacion = useLocation();

  const cargar = useCallback(async () => {
    setCarga({ tipo: "cargando" });
    try {
      const [{ datos: hora }, actual] = await Promise.all([
        api.get<{ ahora: string }>("/api/v1/hora"),
        api.get<Sesion>("/api/v1/sesion").then(
          (r) => r.datos,
          (error: unknown) => {
            if (error instanceof ErrorDeApi && error.estado === 401) return null;
            throw error;
          }
        )
      ]);
      setDesfase(Date.parse(hora.ahora) - Date.now());
      setSesion(actual);
      setCarga({ tipo: "lista" });
    } catch {
      setCarga({ tipo: "sin-servidor" });
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  // Sesión vencida (401) en cualquier pantalla: a /ingresar y, al volver, de regreso aquí (15.8).
  useEffect(() => {
    api.alPerderSesion = () => {
      setSesion(null);
      navegar(`/ingresar?volver=${encodeURIComponent(ubicacion.pathname + ubicacion.search)}`, { replace: true });
    };
    return () => {
      api.alPerderSesion = null;
    };
  }, [navegar, ubicacion.pathname, ubicacion.search]);

  const valor = useMemo<EstadoDeSesion>(() => {
    const ahora = () => instanteDeCostaRica(Date.now() + desfase);
    return {
      sesion,
      ahora,
      hoy: () => fechaDe(ahora()),
      ingresar: async (usuario, secreto) => {
        const { datos } = await api.post<Sesion>("/api/v1/sesion", { cuerpo: { usuario, secreto } });
        setSesion(datos);
        return datos;
      },
      salir: async () => {
        await api.delete("/api/v1/sesion").catch(() => undefined);
        setSesion(null);
      }
    };
  }, [sesion, desfase]);

  if (carga.tipo === "cargando") {
    return (
      <main className="ingreso">
        <p className="cargando" role="status">
          Conectando con CompuLab…
        </p>
      </main>
    );
  }
  if (carga.tipo === "sin-servidor") {
    return (
      <main className="ingreso">
        <div className="ingreso__caja pila">
          <h1 className="ingreso__marca">CompuLab</h1>
          <div className="mensaje mensaje--error" role="alert">
            <p>
              <strong>No hay conexión con el servidor.</strong>
            </p>
            <p>Revisa tu conexión e intenta de nuevo en unos segundos.</p>
            <div className="acciones">
              <button className="boton" onClick={() => void cargar()}>
                Reintentar
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}
