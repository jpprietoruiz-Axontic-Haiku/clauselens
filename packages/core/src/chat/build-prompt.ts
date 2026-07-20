import type { RetrievedChunk } from "../retrieval/types.js";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export const NO_BASIS_MESSAGE =
  "I don't have enough basis in the corpus to answer this with confidence. " +
  "Try rephrasing the question or consult the source regulation directly.";

const SYSTEM_PROMPT = `You are ClauseLens, an assistant that answers regulatory questions by citing exclusively the provided context.

Strict rules:
- Answer only with information contained in the CONTEXT. Do not use outside knowledge or invent articles.
- Every claim must be accompanied by a citation in brackets to the corresponding fragment number, e.g. [1] or [2][3].
- If the CONTEXT does not contain the answer, say so explicitly instead of making one up.
- Answer in the same language the question was asked in.`;

function chunkLabel(chunk: RetrievedChunk): string {
  return [chunk.documentTitle, chunk.articleRef, chunk.page !== null ? `p. ${chunk.page}` : null]
    .filter((part): part is string => Boolean(part))
    .join(" — ");
}

export function buildContextBlock(retrieved: RetrievedChunk[]): string {
  return retrieved.map((chunk, i) => `[${i + 1}] (${chunkLabel(chunk)})\n${chunk.content}`).join("\n\n");
}

export function buildChatMessages(question: string, retrieved: RetrievedChunk[]): ChatMessage[] {
  const context = buildContextBlock(retrieved);
  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: `CONTEXT:\n${context}\n\nQUESTION: ${question}` },
  ];
}
