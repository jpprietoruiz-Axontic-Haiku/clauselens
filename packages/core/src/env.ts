import { z } from "zod";

const baseSchema = z.object({
  LLM_PROVIDER: z.enum(["anthropic", "openai"]).default("anthropic"),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  // Embeddings are only offered by OpenAI, so this key is required
  // regardless of which chat provider is active.
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required (embeddings are only offered by OpenAI)"),
  ANTHROPIC_MODEL: z.string().min(1).default("claude-sonnet-5"),
  OPENAI_MODEL: z.string().min(1).default("gpt-5"),
  EMBEDDING_MODEL: z.string().min(1).default("text-embedding-3-large"),
});

const envSchema = baseSchema.superRefine((env, ctx) => {
  if (env.LLM_PROVIDER === "anthropic" && !env.ANTHROPIC_API_KEY) {
    ctx.addIssue({
      code: "custom",
      path: ["ANTHROPIC_API_KEY"],
      message: "ANTHROPIC_API_KEY is required when LLM_PROVIDER=anthropic",
    });
  }
});

export type CoreEnv = z.infer<typeof envSchema>;

export function loadCoreEnv(source: NodeJS.ProcessEnv = process.env): CoreEnv {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  return result.data;
}
