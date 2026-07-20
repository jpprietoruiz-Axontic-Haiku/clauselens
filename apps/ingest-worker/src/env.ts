import { z } from "zod";

// DATABASE_URL se valida por separado en @clauselens/db (loadDbEnv):
// ese paquete es el dueño de la configuración de base de datos.
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8787),
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY es obligatorio (los embeddings solo los ofrece OpenAI)"),
  EMBEDDING_MODEL: z.string().min(1).default("text-embedding-3-large"),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    throw new Error(`Configuración de entorno inválida: ${issues}`);
  }
  return result.data;
}
