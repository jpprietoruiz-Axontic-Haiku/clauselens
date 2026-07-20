import type { RetrievedChunk } from "./types.js";

// Threshold on the cosine similarity of the best vector result (not on
// fusedScore, which is a rank-fusion score with no interpretable bound).
// 0.35 is conservative for text-embedding-3-large: below that, results
// tend to be thematically scattered. See DECISIONS.md.
export const CONFIDENCE_THRESHOLD = 0.35;

export function hasSufficientBasis(results: RetrievedChunk[]): boolean {
  const top = results[0];
  if (!top) return false;
  return (top.vectorScore ?? 0) >= CONFIDENCE_THRESHOLD;
}
