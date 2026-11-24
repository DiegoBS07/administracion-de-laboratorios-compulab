import { defineConfig } from "vitest/config";

// Pruebas con dobles, sin base de datos (R-8). Viven en tests/, separadas de src/.
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node"
  }
});
