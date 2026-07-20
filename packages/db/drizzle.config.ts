import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// The monorepo keeps a single .env at the root (see .env.example).
config({ path: "../../.env" });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not defined (check the monorepo's root .env).");
}

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
