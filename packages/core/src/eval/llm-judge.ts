import { generateText, Output, type LanguageModel } from "ai";
import { z } from "zod";

const judgeScoreSchema = z.object({
  score: z.number().min(0).max(1),
  reasoning: z.string(),
});

export interface JudgeScore {
  score: number;
  reasoning: string;
}

/** Are all the claims in the answer backed by the retrieved context? */
export async function judgeFaithfulness(model: LanguageModel, answer: string, context: string): Promise<JudgeScore> {
  const { output } = await generateText({
    model,
    output: Output.object({ schema: judgeScoreSchema }),
    prompt: `You are a strict evaluator of a regulatory RAG system. You are given a CONTEXT (fragments retrieved from a legal corpus) and an ANSWER generated from that context.

Evaluate whether ALL the claims in the ANSWER are backed by the CONTEXT, without adding made-up information. Return:
- score = 1 if every claim in the answer is supported by the context.
- score = 0 if the answer makes up information that is not in the context (hallucination).
- an intermediate value if only part of the answer is supported.

If the answer explicitly says "I don't have enough basis" or equivalent, score = 1 (it doesn't assert anything that could be false).

CONTEXT:
${context || "(no context: no fragment was retrieved)"}

ANSWER:
${answer}`,
  });
  return output;
}

/** Does the answer directly address what was asked? */
export async function judgeAnswerRelevancy(model: LanguageModel, question: string, answer: string): Promise<JudgeScore> {
  const { output } = await generateText({
    model,
    output: Output.object({ schema: judgeScoreSchema }),
    prompt: `You are a strict evaluator of a regulatory RAG system. Given a QUESTION and an ANSWER, evaluate how directly the answer addresses what was asked. Return:
- score = 1 if the answer fully and directly addresses the question.
- score = 0 if it is irrelevant, evasive, or doesn't answer what was asked.
- an intermediate value if it only answers partially.

If the question is outside the scope of the corpus and the answer honestly says so instead of making something up (e.g. "I don't have enough basis"), score = 1: that's the correct answer for an unsupported question.

QUESTION: ${question}

ANSWER: ${answer}`,
  });
  return output;
}
