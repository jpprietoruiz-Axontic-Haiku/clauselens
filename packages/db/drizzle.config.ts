import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// El monorepo mantiene un único .env en la raíz (ver .env.example).
config({ path: "../../.env" });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL no está definido (revisa el .env de la raíz del monorepo).");
}

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
