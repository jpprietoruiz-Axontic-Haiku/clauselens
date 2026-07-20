import { config } from "dotenv";
import { defineConfig } from "vitest/config";

// The monorepo keeps a single .env at the root (see .env.example). Normal
// scripts load it via Next.js/tsx, but vitest doesn't do that on its own.
config({ path: "../../.env" });

export default defineConfig({
  test: {
    // The hybridSearch integration test makes several real round trips to
    // Postgres (insert + 4 hybrid queries).
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
