import type { RetrievedChunk } from "../retrieval/types.js";

const ARTICLE_NUMBER_RE = /Article\s+(\d+[a-zA-Z]?)/;

function extractArticleNumber(ref: string | null): string | null {
  if (!ref) return null;
  const match = ARTICLE_NUMBER_RE.exec(ref);
  return match?.[1] ?? null;
}

/**
 * Heurística (no LLM-as-judge): fracción de los chunks recuperados cuyo
 * número de artículo está entre los esperados por el golden set. Para
 * preguntas fuera de corpus (expectedArticleRefs = []), cualquier chunk
 * recuperado cuenta como "no esperado", así que el score tiende a 0 —
 * exactamente la señal que interesa cuando la pregunta no debería
 * encontrar soporte real en el corpus.
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
