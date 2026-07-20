import type { Database } from "@clauselens/db";
import { generateText, type LanguageModel } from "ai";
import { buildChatMessages, buildContextBlock, NO_BASIS_MESSAGE } from "../chat/build-prompt.js";
import { type Embedder, embedOne } from "../embed.js";
import { hasSufficientBasis } from "../retrieval/confidence.js";
import { hybridSearch } from "../retrieval/hybrid.js";
import { contextPrecision } from "./context-precision.js";
import { estimateCostUsd } from "./cost.js";
import { judgeAnswerRelevancy, judgeFaithfulness } from "./llm-judge.js";
import type { EvalResult, GoldenQuestion } from "./types.js";

export interface RunEvalDeps {
  db: Database;
  embedder: Embedder;
  chatModel: LanguageModel;
  chatModelId: string;
  /** Model used as the judge (can be the same as chatModel). */
  judgeModel: LanguageModel;
}

export async function evaluateQuestion(deps: RunEvalDeps, golden: GoldenQuestion): Promise<EvalResult> {
  const start = Date.now();

  const queryEmbedding = await embedOne(deps.embedder, golden.question);
  const retrieved = await hybridSearch(deps.db, queryEmbedding, golden.question, { topK: 5 });

  let answer: string;
  let costUsd = 0;

  if (!hasSufficientBasis(retrieved)) {
    answer = NO_BASIS_MESSAGE;
  } else {
    const result = await generateText({
      model: deps.chatModel,
      messages: buildChatMessages(golden.question, retrieved),
    });
    answer = result.text;
    costUsd = estimateCostUsd(deps.chatModelId, result.usage);
  }

  const context = buildContextBlock(retrieved);
  const [faithfulness, answerRelevancy] = await Promise.all([
    judgeFaithfulness(deps.judgeModel, answer, context),
    judgeAnswerRelevancy(deps.judgeModel, golden.question, answer),
  ]);

  return {
    questionId: golden.id,
    question: golden.question,
    answer,
    retrievedChunkIds: retrieved.map((chunk) => chunk.chunkId),
    faithfulness: faithfulness.score,
    answerRelevancy: answerRelevancy.score,
    contextPrecision: contextPrecision(retrieved, golden.expectedArticleRefs),
    latencyMs: Date.now() - start,
    costUsd,
  };
}

export async function evaluateGoldenSet(deps: RunEvalDeps, goldenSet: GoldenQuestion[]): Promise<EvalResult[]> {
  const results: EvalResult[] = [];
  // Sequential on purpose: makes progress logs easier to read and avoids
  // hammering the LLM API all at once as the golden set grows.
  for (const golden of goldenSet) {
    results.push(await evaluateQuestion(deps, golden));
  }
  return results;
}
