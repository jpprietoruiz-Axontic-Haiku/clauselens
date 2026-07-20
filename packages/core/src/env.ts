import { z } from "zod";

const baseSchema = z.object({
  LLM_PROVIDER: z.enum(["anthropic", "openai"]).default("anthropic"),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  // Los embeddings solo los ofrece OpenAI, así que esta clave es obligatoria
  // con independencia de qué proveedor de chat esté activo.
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY es obligatorio (los embeddings solo los ofrece OpenAI)"),
  ANTHROPIC_MODEL: z.string().min(1).default("claude-sonnet-5"),
  OPENAI_MODEL: z.string().min(1).default("gpt-5"),
  EMBEDDING_MODEL: z.string().min(1).default("text-embedding-3-large"),
});

const envSchema = baseSchema.superRefine((env, ctx) => {
  if (env.LLM_PROVIDER === "anthropic" && !env.ANTHROPIC_API_KEY) {
    ctx.addIssue({
      code: "custom",
      path: ["ANTHROPIC_API_KEY"],
      message: "ANTHROPIC_API_KEY es obligatorio cuando LLM_PROVIDER=anthropic",
    });
  }
});

export type CoreEnv = z.infer<typeof envSchema>;

export function loadCoreEnv(source: NodeJS.ProcessEnv = process.env): CoreEnv {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    throw new Error(`Configuración de entorno inválida: ${issues}`);
  }
  return result.data;
}
