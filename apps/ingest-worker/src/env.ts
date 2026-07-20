import { z } from "zod";

// DATABASE_URL is validated separately in @clauselens/db (loadDbEnv): that
// package owns the database configuration.
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8787),
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required (embeddings are only offered by OpenAI)"),
  EMBEDDING_MODEL: z.string().min(1).default("text-embedding-3-large"),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  return result.data;
}
