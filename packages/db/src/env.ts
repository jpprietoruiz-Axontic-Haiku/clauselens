import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
});

export function loadDbEnv(source: NodeJS.ProcessEnv = process.env): { DATABASE_URL: string } {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    throw new Error(`Invalid database configuration: ${issues}`);
  }
  return result.data;
}
