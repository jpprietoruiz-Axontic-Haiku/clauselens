import { config } from "dotenv";
import { defineConfig } from "vitest/config";

// El monorepo mantiene un único .env en la raíz (ver .env.example). Los
// scripts normales lo cargan vía Next.js/tsx, pero vitest no lo hace solo.
config({ path: "../../.env" });

export default defineConfig({
  test: {
    // El test de integración de hybridSearch hace varias idas y vueltas
    // reales a Postgres (insert + 4 queries híbridas).
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
