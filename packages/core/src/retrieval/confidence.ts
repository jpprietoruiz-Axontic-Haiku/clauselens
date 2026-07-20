import type { RetrievedChunk } from "./types.js";

// Umbral sobre la similitud coseno del mejor resultado vectorial (no sobre
// fusedScore, que es un score de fusión de rangos sin cota interpretable).
// 0.35 es conservador para text-embedding-3-large: por debajo de eso el
// resultado suele ser temáticamente disperso. Ver DECISIONS.md (Hito 6).
export const CONFIDENCE_THRESHOLD = 0.35;

export function hasSufficientBasis(results: RetrievedChunk[]): boolean {
  const top = results[0];
  if (!top) return false;
  return (top.vectorScore ?? 0) >= CONFIDENCE_THRESHOLD;
}
