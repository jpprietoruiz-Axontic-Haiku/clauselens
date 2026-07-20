import type { RetrievedChunk } from "../retrieval/types.js";

const ARTICLE_NUMBER_RE = /Article\s+(\d+[a-zA-Z]?)/;

function extractArticleNumber(ref: string | null): string | null {
  if (!ref) return null;
  const match = ARTICLE_NUMBER_RE.exec(ref);
  return match?.[1] ?? null;
}

/**
 * Heuristic (not LLM-as-judge): fraction of retrieved chunks whose article
 * number is among those expected by the golden set. For out-of-corpus
 * questions (expectedArticleRefs = []), any retrieved chunk counts as
 * "not expected", so the score tends to 0 — exactly the signal we want
 * when the question shouldn't find real support in the corpus.
 */
export function contextPrecision(retrieved: RetrievedChunk[], expectedArticleRefs: string[]): number {
  if (retrieved.length === 0) return 0;

  const expectedNumbers = new Set(
    expectedArticleRefs.map((ref) => extractArticleNumber(ref)).filter((n): n is string => n !== null),
  );

  const relevantCount = retrieved.filter((chunk) => {
    const number = extractArticleNumber(chunk.articleRef);
    return number !== null && expectedNumbers.has(number);
  }).length;

  return relevantCount / retrieved.length;
}
