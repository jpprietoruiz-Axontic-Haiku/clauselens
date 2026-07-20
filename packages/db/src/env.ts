import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL es obligatorio"),
});

export function loadDbEnv(source: NodeJS.ProcessEnv = process.env): { DATABASE_URL: string } {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    throw new Error(`Configuración de base de datos inválida: ${issues}`);
  }
  return result.data;
}
