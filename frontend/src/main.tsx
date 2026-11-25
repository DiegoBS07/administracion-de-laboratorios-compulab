// Punto de entrada del frontend. Roboto se sirve desde el propio sitio (@fontsource), sin depender
// de servicios externos (R-3).
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
import "@fontsource/roboto/900.css";
import "./compartido/ui/estilos.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";

const raiz = document.getElementById("raiz");
if (!raiz) throw new Error("Falta el elemento #raiz en index.html.");

createRoot(raiz).render(
  <StrictMode>
    <App />
  </StrictMode>
);
