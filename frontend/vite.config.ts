/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// En desarrollo, /api se reenvía al backend (en el contenedor lo hace Nginx: nginx.conf).
export default defineConfig({
  plugins: [react()],
  // Sin recursos incrustados como data: URI: la política de seguridad de Nginx solo permite archivos propios.
  build: { assetsInlineLimit: 0 },
  server: {
    port: 5173,
    proxy: { "/api": process.env["COMPULAB_API"] ?? "http://localhost:2000" }
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"]
  }
});
