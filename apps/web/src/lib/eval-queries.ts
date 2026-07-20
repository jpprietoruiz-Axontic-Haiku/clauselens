import { evalResults, evalRuns } from "@clauselens/db";
import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "./deps";

export interface EvalRunSummary {
  id: string;
  gitSha: string;
  createdAt: Date;
  questionCount: number;
  avgFaithfulness: number;
  avgAnswerRelevancy: number;
  avgContextPrecision: number;
  avgLatencyMs: number;
  totalCostUsd: number;
}

const MAX_RUNS = 20;

export async function listEvalRunSummaries(): Promise<EvalRunSummary[]> {
  const db = getDb();

  // avg() over `real` columns already comes back as a native number;
  // count()/sum() over numeric/bigint return them as strings in
  // node-postgres, so they're explicitly cast to avoid leaking strings
  // into the UI.
  const rows = await db
    .select({
      id: evalRuns.id,
      gitSha: evalRuns.gitSha,
      createdAt: evalRuns.createdAt,
      questionCount: sql<number>`count(${evalResults.id})::int`,
      avgFaithfulness: sql<number>`coalesce(avg(${evalResults.faithfulness}), 0)`,
      avgAnswerRelevancy: sql<number>`coalesce(avg(${evalResults.answerRelevancy}), 0)`,
      avgContextPrecision: sql<number>`coalesce(avg(${evalResults.contextPrecision}), 0)`,
      avgLatencyMs: sql<number>`coalesce(avg(${evalResults.latencyMs}), 0)`,
      totalCostUsd: sql<number>`coalesce(sum(${evalResults.costUsd}), 0)::float8`,
    })
    .from(evalRuns)
    .leftJoin(evalResults, eq(evalResults.runId, evalRuns.id))
    .groupBy(evalRuns.id)
    .orderBy(desc(evalRuns.createdAt))
    .limit(MAX_RUNS);

  return rows;
}
