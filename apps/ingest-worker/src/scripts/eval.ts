import { execSync } from "node:child_process";
import {
  createOpenAiEmbedder,
  evaluateGoldenSet,
  getChatModel,
  loadCoreEnv,
  loadGoldenSet,
  type RunEvalDeps,
} from "@clauselens/core";
import { createDb, evalResults, evalRuns, loadDbEnv } from "@clauselens/db";

function currentGitSha(): string {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf-8" }).trim();
  } catch {
    return "unknown";
  }
}

function average(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
}

async function main(): Promise<void> {
  const coreEnv = loadCoreEnv();
  const { DATABASE_URL } = loadDbEnv();
  const db = createDb(DATABASE_URL);

  const deps: RunEvalDeps = {
    db,
    embedder: createOpenAiEmbedder(coreEnv.OPENAI_API_KEY, coreEnv.EMBEDDING_MODEL),
    chatModel: getChatModel(coreEnv),
    chatModelId: coreEnv.LLM_PROVIDER === "anthropic" ? coreEnv.ANTHROPIC_MODEL : coreEnv.OPENAI_MODEL,
    // Se usa el mismo modelo de chat como juez: mantiene el harness simple y
    // barato para un portfolio; nada impide apuntar el juez a otro proveedor
    // más adelante si se quiere evitar el sesgo de "el modelo se juzga a sí mismo".
    judgeModel: getChatModel(coreEnv),
  };

  const goldenSet = loadGoldenSet();
  console.log(JSON.stringify({ level: "info", msg: "eval_start", questions: goldenSet.length }));

  const results = await evaluateGoldenSet(deps, goldenSet);

  const [run] = await db.insert(evalRuns).values({ gitSha: currentGitSha() }).returning({ id: evalRuns.id });
  if (!run) {
    throw new Error("No se pudo crear el registro de eval_runs.");
  }

  await db.insert(evalResults).values(
    results.map((result) => ({
      runId: run.id,
      question: result.question,
      faithfulness: result.faithfulness,
      answerRelevancy: result.answerRelevancy,
      contextPrecision: result.contextPrecision,
      latencyMs: result.latencyMs,
      costUsd: result.costUsd.toFixed(6),
    })),
  );

  console.log(
    JSON.stringify({
      level: "info",
      msg: "eval_done",
      runId: run.id,
      avgFaithfulness: average(results.map((r) => r.faithfulness)),
      avgAnswerRelevancy: average(results.map((r) => r.answerRelevancy)),
      avgContextPrecision: average(results.map((r) => r.contextPrecision)),
      totalCostUsd: results.reduce((sum, r) => sum + r.costUsd, 0),
    }),
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ level: "error", msg: "eval_failed", error: message }));
  process.exitCode = 1;
});
